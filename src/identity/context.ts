import type { TenantCacheEntry, TenantContext, TenantID } from "../types/index";
import { asTenantID, CoreError } from "../types/index";
import { isValidHostname, isValidSlug } from "../security/sanitizer";

export interface KVNamespaceBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatement;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

// Resolve o tenant a partir do hostname com cache-first (KV → D1 → auto-reparo)
export async function resolveTenant(
  hostname: string,
  kv: KVNamespaceBinding,
  db: D1DatabaseBinding,
): Promise<TenantContext> {
  if (!isValidHostname(hostname) && !isValidSlug(hostname)) {
    throw new CoreError("ISOLATION_VIOLATION", `Invalid hostname format: ${hostname.slice(0, 40)}`);
  }

  const cacheKey = `tenant:host:${hostname}`;

  const cached = await kv.get(cacheKey);
  if (cached) {
    const entry = JSON.parse(cached) as TenantCacheEntry;
    return cacheEntryToContext(entry);
  }

  // Graceful degradation: KV miss → busca no D1 e auto-repara o cache
  const row = await db
    .prepare(
      "SELECT id, slug, plan_id, partner_id, theme_config, status FROM tenants WHERE (custom_domain = ? OR slug = ?) AND status != 'cancelled' LIMIT 1",
    )
    .bind(hostname, hostname)
    .first<{
      id: string;
      slug: string;
      plan_id: string;
      partner_id: string | null;
      theme_config: string | null;
      status: string;
    }>();

  if (!row) {
    throw new CoreError("TENANT_NOT_FOUND", `Tenant not found for host: ${hostname}`);
  }

  if (row.status === "suspended") {
    throw new CoreError("TENANT_SUSPENDED", `Tenant ${row.slug} is suspended`);
  }

  const themeConfig = row.theme_config ? JSON.parse(row.theme_config) : null;

  const entry: TenantCacheEntry = {
    tenantId: asTenantID(row.id),
    plan: row.plan_id as TenantContext["plan"],
    themeVars: themeConfig ?? {},
    status: row.status as TenantContext["status"],
  };

  // Auto-reparo silencioso — TTL de 5 minutos
  await kv.put(cacheKey, JSON.stringify(entry), { expirationTtl: 300 });

  return cacheEntryToContext(entry);
}

function cacheEntryToContext(entry: TenantCacheEntry): TenantContext {
  return Object.freeze({
    id: entry.tenantId,
    slug: "",
    plan: entry.plan,
    partnerId: null,
    themeConfig: null,
    status: entry.status,
  });
}

// Remove a entrada de cache para um hostname — usar após upgrade/downgrade de plano
export async function invalidateTenantCache(
  hostname: string,
  kv: KVNamespaceBinding,
): Promise<void> {
  await kv.delete(`tenant:host:${hostname}`);
}

// Resolve por tenant_id diretamente (para rotas internas/admin)
export async function resolveTenantById(
  tenantId: TenantID,
  db: D1DatabaseBinding,
): Promise<TenantContext> {
  const row = await db
    .prepare(
      "SELECT id, slug, plan_id, partner_id, theme_config, status FROM tenants WHERE id = ? LIMIT 1",
    )
    .bind(tenantId)
    .first<{
      id: string;
      slug: string;
      plan_id: string;
      partner_id: string | null;
      theme_config: string | null;
      status: string;
    }>();

  if (!row) {
    throw new CoreError("TENANT_NOT_FOUND", `Tenant not found: ${tenantId}`);
  }

  return Object.freeze({
    id: asTenantID(row.id),
    slug: row.slug,
    plan: row.plan_id as TenantContext["plan"],
    partnerId: row.partner_id as TenantContext["partnerId"],
    themeConfig: row.theme_config ? JSON.parse(row.theme_config) : null,
    status: row.status as TenantContext["status"],
  });
}
