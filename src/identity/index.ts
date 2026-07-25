export { resolveTenant, resolveTenantById } from "./context.ts";
export type {
  D1DatabaseBinding,
  D1PreparedStatement,
  KVNamespaceBinding,
} from "./context.ts";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./jwt.ts";
export type { IdentityClaims } from "./jwt.ts";

// Sessão & cookies
export {
  BaggioAuth,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  CORE_EFFECTIVE_TENANT_COOKIE,
  CORE_SESSION_COOKIE,
} from "./auth.ts";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./auth.ts";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./audit.ts";
export type { ImpersonationAuditEntry } from "./audit.ts";

// Schemas tenant-config (Core identity service)
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateCoreConfig,
} from "./tenant-config.ts";
export type {
  CoreConfigState,
  CoreLegacyPlan,
  CoreRawKvConfig,
  CoreTenantBranding,
  CoreTenantConfig,
  CoreTenantFeatures,
  CoreTenantSecurityPolicy,
} from "./tenant-config.ts";
