import { asTenantID, asUserID, CoreError } from "../types/index.ts";
import type { Role, TenantID, UserClaims, UserID } from "../types/index.ts";

// Claims do JWT EdDSA emitido pelo serviço de identidade (alg: "EdDSA", crv: "Ed25519")
export interface IdentityClaims {
  iss: string;
  sub: string;       // email do usuário
  tenant_id: string;
  role: string;
  jti: string;
  aud: string;
  iat: number;
  exp: number;
  mfa_pending?: boolean;
  roles?: string[];
  scope?: string;
  // Quando preenchido, indica que o token é fruto de impersonation user-level
  // (workflow /admin/impersonate do Rust worker). O subject sub continua sendo
  // o admin original; act_as carrega o user_id alvo da ação.
  act_as?: string;
  // RFC 8693: o worker injeta act = { sub: <admin original> } no token de suporte.
  act?: { sub: string };
  // Volt PRD v2.7 §3.4: claim estrita emitida pelo /admin/impersonate.
  // O kernel intercepta e barra acessos laterais a faturamento, infraestrutura
  // central e comandos de deleção (ver governance/impersonation.ts).
  is_impersonated?: boolean;
  // Stable global user ID — "volt:usr:{uuid}". Present for all new sessions.
  uid?: string;
  // Product-scoped org memberships — format: "{product}:{org_id}" e.g. "crm:org_abc".
  // Gates cross-product access in each product's auth middleware.
  orgs?: string[];
}


export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// Garante que o claims.tenantId bate com o tenant da requisição
export function assertTenantMatch(claims: UserClaims, tenantId: TenantID): void {
  if (claims.tenantId !== tenantId) {
    throw new CoreError(
      "ISOLATION_VIOLATION",
      `Token tenant ${claims.tenantId} does not match request tenant ${tenantId}`,
    );
  }
}

// RBAC: verifica se um role tem permissão para uma ação
const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function assertRole(userRole: Role, requiredRole: Role): void {
  if (!hasRole(userRole, requiredRole)) {
    throw new CoreError(
      "UNAUTHORIZED",
      `Role '${userRole}' is insufficient. Required: '${requiredRole}'`,
    );
  }
}

// ─── EdDSA (Ed25519) ─────────────────────────────────────────────────────────

function base64urlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const buf = new ArrayBuffer(binary.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

// publicKeyBase64Url: campo "x" do JWK exposto pelo endpoint /jwks.json do serviço de identidade.
export async function verifyTokenEdDSA(
  token: string,
  publicKeyBase64Url: string,
): Promise<IdentityClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new CoreError("INVALID_TOKEN", "Malformed JWT: expected 3 parts");
  }

  const [header, payload, sig] = parts as [string, string, string];

  const pubKeyBytes = base64urlToBytes(publicKeyBase64Url);
  const key = await crypto.subtle.importKey(
    "raw",
    pubKeyBytes.buffer as ArrayBuffer,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  const msgBytes = new TextEncoder().encode(`${header}.${payload}`);
  const message = msgBytes.buffer.slice(msgBytes.byteOffset, msgBytes.byteOffset + msgBytes.byteLength) as ArrayBuffer;
  const sigBytes = base64urlToBytes(sig);
  const signature = sigBytes.buffer as ArrayBuffer;

  const valid = await crypto.subtle.verify("Ed25519", key, signature, message);
  if (!valid) {
    throw new CoreError("INVALID_TOKEN", "EdDSA signature verification failed");
  }

  let claims: IdentityClaims;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    ));
    claims = JSON.parse(decoded) as IdentityClaims;
  } catch {
    throw new CoreError("INVALID_TOKEN", "Failed to decode JWT payload");
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    throw new CoreError("INVALID_TOKEN", "EdDSA JWT has expired");
  }

  return claims;
}

// Mapeia roles do serviço de identidade para os roles do core
function normalizeRole(role: string): Role {
  if (role === "superadmin") return "admin";
  if (role === "user") return "viewer";
  if (role === "admin" || role === "editor" || role === "viewer") return role as Role;
  return "viewer";
}

// Converte IdentityClaims → UserClaims do Core
export function identityClaimsToUserClaims(claims: IdentityClaims): UserClaims {
  return {
    sub: asUserID(claims.sub),
    tenantId: asTenantID(claims.tenant_id),
    role: normalizeRole(claims.role),
    email: claims.sub,
    iat: claims.iat,
    exp: claims.exp,
  };
}

export type { TenantID, UserID, UserClaims, Role };
