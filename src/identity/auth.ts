import { CoreError } from "../types/index";
import type { TenantID, UserClaims } from "../types/index";
import { verifyTokenEdDSA, identityClaimsToUserClaims, type IdentityClaims } from "./jwt";
import type { KVNamespaceBinding } from "./context";

// Cookies emitidos pelo serviço de identidade Core/Baggio.
// Centralizar nomes aqui evita drift entre apps que consomem a sessão.
export const BAGGIO_SESSION_COOKIE = "baggio_session";
export const CORE_SESSION_COOKIE = BAGGIO_SESSION_COOKIE;
export const CORE_EFFECTIVE_TENANT_COOKIE = "baggio_tenant_id";

export const DEFAULT_SESSION_TTL_SECONDS = 3600;
export const DEFAULT_TOKEN_ISSUER = "core-identity";

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge: number;
  // Set to ".baggio.tech" in production to enable SSO across all subdomains.
  // Leave undefined for localhost dev (cross-subdomain cookies don't work on localhost).
  domain?: string;
  // If true, prefixes the cookie with __Host- (origin-bound, forbids Domain attribute).
  // Recommended for console/admin apps.
  useHostPrefix?: boolean;
}

export const DEFAULT_SESSION_COOKIE_OPTIONS: SessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: DEFAULT_SESSION_TTL_SECONDS,
};

// Contrato mínimo compatível com Next.js cookies(), Hono c.cookies, etc.
export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: Partial<SessionCookieOptions>,
  ): void;
  delete?(name: string): void;
}

export interface VerifyOptions {
  // Caminho local: chave pública em base64url; verifica EdDSA sem hop de rede.
  publicKeyBase64Url?: string;
  // Caminho remoto: endpoint /auth/verify do Worker; garante revogação via DO.
  fallbackVerifyUrl?: string;
  // Issuer esperado no claim `iss`. Default: "core-identity".
  expectedIssuer?: string;
  // Hybrid Consistency Layer (Core PRD v2.8 §3.3): binding KV com a blacklist
  // de revogação (`revoked:{jti}`, TTL = vida restante do token). Combina a
  // validação stateless local com revogação imediata O(1), sem hop ao DO.
  revocationKV?: KVNamespaceBinding;
  // Permite override do fetch (testes).
  fetchImpl?: typeof fetch;
}

export interface VerifiedSession {
  claims: IdentityClaims;
  userClaims: UserClaims;
  tenantId: TenantID;
  effectiveTenantId: TenantID;
  role: string;
  token: string;
  // Impersonation Gate: true quando um superadmin opera como outro tenant.
  // Use isto para pintar logs/UI em "vermelho gritante" e bloquear escritas
  // críticas sem confirmação extra.
  isImpersonating: boolean;
}

function isSuperadmin(role: string | undefined): boolean {
  return role === "superadmin" || role === "admin";
}

async function verifyViaWorker(
  token: string,
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ tenant_id?: string; role?: string; sub?: string; exp?: number; iat?: number; jti?: string; iss?: string; aud?: string }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      ...({ cache: "no-store" } as any),
    });
  } catch (e) {
    throw new CoreError(
      "INFRA_FAILURE",
      `Token verify endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!response.ok) {
    throw new CoreError("INVALID_TOKEN", `Worker verify rejected token: ${response.status}`);
  }
  return response.json() as Promise<{ tenant_id?: string; role?: string }>;
}

export class BaggioAuth {
  // Persiste o JWT do Core em cookie httpOnly seguindo as defaults globais.
  static createSession(
    cookieStore: CookieStoreLike,
    token: string,
    overrides?: Partial<SessionCookieOptions>,
  ): void {
    const options: SessionCookieOptions = { ...DEFAULT_SESSION_COOKIE_OPTIONS, ...overrides };
    const cookieName = options.useHostPrefix ? `__Host-${CORE_SESSION_COOKIE}` : CORE_SESSION_COOKIE;
    
    // __Host- cookies cannot have a domain attribute
    if (options.useHostPrefix) {
      delete options.domain;
    }
    
    cookieStore.set(cookieName, token, options);
  }

  // Apaga a sessão. Use no logout/erro de verificação.
  static clearSession(cookieStore: CookieStoreLike): void {
    if (cookieStore.delete) {
      cookieStore.delete(`__Host-${CORE_SESSION_COOKIE}`);
      cookieStore.delete(CORE_SESSION_COOKIE);
      cookieStore.delete(CORE_EFFECTIVE_TENANT_COOKIE);
      return;
    }
    // Fallback: sobrescreve com maxAge=0
    cookieStore.set(`__Host-${CORE_SESSION_COOKIE}`, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0, domain: undefined });
    cookieStore.set(CORE_SESSION_COOKIE, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0 });
    cookieStore.set(CORE_EFFECTIVE_TENANT_COOKIE, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0 });
  }

  // Verifica o cookie e retorna a sessão tipada.
  // Resolve a impersonação superadmin via baggio_tenant_id.
  static async verify(
    cookieStore: CookieStoreLike,
    options: VerifyOptions,
  ): Promise<VerifiedSession> {
    const token = cookieStore.get(`__Host-${CORE_SESSION_COOKIE}`)?.value || cookieStore.get(CORE_SESSION_COOKIE)?.value;
    if (!token) {
      throw new CoreError("UNAUTHORIZED", "Missing session token");
    }

    const expectedIssuer = options.expectedIssuer ?? DEFAULT_TOKEN_ISSUER;
    let claims: IdentityClaims;

    if (options.publicKeyBase64Url) {
      claims = await verifyTokenEdDSA(token, options.publicKeyBase64Url);
      if (claims.iss !== expectedIssuer) {
        throw new CoreError("INVALID_TOKEN", `Invalid token issuer: ${claims.iss}`);
      }
    } else if (options.fallbackVerifyUrl) {
      const fetchImpl = options.fetchImpl ?? fetch;
      const remote = await verifyViaWorker(token, options.fallbackVerifyUrl, fetchImpl);
      if (!remote.tenant_id) {
        throw new CoreError("INVALID_TOKEN", "Worker verify response missing tenant_id");
      }
      claims = {
        iss: remote.iss ?? expectedIssuer,
        sub: remote.sub ?? "",
        tenant_id: remote.tenant_id,
        role: remote.role ?? "viewer",
        jti: remote.jti ?? "",
        aud: remote.aud ?? "",
        iat: remote.iat ?? Math.floor(Date.now() / 1000),
        exp: remote.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_SESSION_TTL_SECONDS,
      };
    } else {
      throw new CoreError(
        "INVALID_TOKEN",
        "BaggioAuth.verify requires publicKeyBase64Url or fallbackVerifyUrl",
      );
    }

    // Hybrid Consistency Layer (Core PRD v2.8 §3.3): após a validação
    // stateless, consulta O(1) na blacklist de revogação do KV local.
    if (options.revocationKV && claims.jti) {
      const revoked = await options.revocationKV.get(`revoked:${claims.jti}`);
      if (revoked !== null) {
        throw new CoreError("INVALID_TOKEN", "Token has been revoked");
      }
    }

    const userClaims = identityClaimsToUserClaims(claims);
    const tenantId = userClaims.tenantId;
    const effectiveRaw = cookieStore.get(CORE_EFFECTIVE_TENANT_COOKIE)?.value;
    const effectiveTenantId =
      effectiveRaw && isSuperadmin(claims.role) ? (effectiveRaw as TenantID) : tenantId;
    // Impersonation Gate: tenant-level (effectiveTenantId difere), user-level
    // (claims.act_as / claims.act preenchidos pelo worker após /admin/impersonate)
    // OU a claim estrita is_impersonated (Core PRD v2.7 §3.4) — interceptada
    // também por governance/assertImpersonationSafe para barrar acessos laterais.
    const isImpersonating =
      effectiveTenantId !== tenantId ||
      Boolean(claims.act_as) ||
      Boolean(claims.act) ||
      claims.is_impersonated === true;

    return {
      claims,
      userClaims,
      tenantId,
      effectiveTenantId,
      role: claims.role,
      token,
      isImpersonating,
    };
  }
}
