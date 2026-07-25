import type { D1DatabaseBinding, KVNamespaceBinding } from "../identity/context";
import type { Plan, Role, TenantContext, TenantID, UserClaims } from "../types/index";
import { asTenantID, asUserID } from "../types/index";
import { generateId } from "../security/sanitizer";
import { createTenantedDB } from "../persistence/d1";

export const TEST_JWT_SECRET = "test-secret-baggio-core-2025";

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function toBase64UrlBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function signJwt(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${toBase64UrlBytes(new Uint8Array(sig))}`;
}

// ─── Tenant factory ───────────────────────────────────────────────────────────

export interface CreateTestTenantOptions {
  id?: string;
  name?: string;
  slug?: string;
  plan?: Plan;
  status?: TenantContext["status"];
  customDomain?: string | null;
}

// Insere um tenant no D1 de teste e aquece o cache KV.
// Retorna o TenantContext imutável pronto para uso nas suítes.
export async function createTestTenant(
  db: D1DatabaseBinding,
  kv: KVNamespaceBinding,
  options: CreateTestTenantOptions = {},
): Promise<TenantContext> {
  const id = options.id ?? generateId();
  const slug = options.slug ?? `test-${id.slice(0, 8)}`;
  const plan: Plan = options.plan ?? "solo";
  const name = options.name ?? `Test Tenant ${slug}`;
  const status: TenantContext["status"] = options.status ?? "active";
  const customDomain = options.customDomain ?? null;

  // Inserção direta na infra (não usa TenantedDB — tenants é tabela de infra)
  const rawDb = db as unknown as D1Database;
  await rawDb
    .prepare(
      "INSERT INTO tenants (id, name, slug, plan_id, status, custom_domain) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, name, slug, plan, status, customDomain)
    .run();

  const tenantId = asTenantID(id);

  // Aquece KV para o fluxo cache-first de resolveTenant
  const cacheKey = `tenant:host:${customDomain ?? slug}`;
  await kv.put(
    cacheKey,
    JSON.stringify({ tenantId, plan, themeVars: {}, status }),
    { expirationTtl: 300 },
  );

  return Object.freeze({
    id: tenantId,
    slug,
    plan,
    partnerId: null,
    themeConfig: null,
    status,
  });
}

// ─── Auth context mock ────────────────────────────────────────────────────────

export interface MockAuthResult {
  token: string;
  claims: UserClaims;
}

// Gera um JWT real (assinado com HMAC-SHA256) e os claims correspondentes.
// Aceita qualquer TenantContext para testar diferentes tiers.
export async function mockAuthContext(
  tenant: TenantContext,
  options: { role?: Role; secret?: string } = {},
): Promise<MockAuthResult> {
  const role: Role = options.role ?? "admin";
  const secret = options.secret ?? TEST_JWT_SECRET;
  const userId = generateId();
  const now = Math.floor(Date.now() / 1000);

  const claims: UserClaims = {
    sub: asUserID(userId),
    tenantId: tenant.id,
    role,
    email: `test+${userId.slice(0, 8)}@baggio.tech`,
    iat: now,
    exp: now + 3600,
  };

  const token = await signJwt(claims, secret);
  return { token, claims };
}

// ─── TenantedDB test wrapper ──────────────────────────────────────────────────

// Retorna um TenantedDB pronto para testes dado um tenant de teste.
export function testTenantedDB(db: D1DatabaseBinding, tenantId: TenantID) {
  return createTenantedDB(db, tenantId);
}

// Reseta todas as tabelas de dados entre suítes.
// Chamado manualmente em beforeEach quando o setup.ts global não é suficiente.
export async function resetTestDB(db: D1DatabaseBinding): Promise<void> {
  const rawDb = db as unknown as D1Database;
  await rawDb.exec("DELETE FROM test_items");
  await rawDb.exec("DELETE FROM plan_events");
  await rawDb.exec("DELETE FROM tenants");
}
