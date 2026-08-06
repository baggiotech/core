export { resolveTenant, resolveTenantById } from "./context.js";
export type {
  D1DatabaseBinding,
  D1PreparedStatement,
  KVNamespaceBinding,
} from "./context.js";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./jwt.js";
export type { IdentityClaims } from "./jwt.js";

// Sessão & cookies
export {
  BaggioAuth,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  CORE_EFFECTIVE_TENANT_COOKIE,
  CORE_SESSION_COOKIE,
} from "./auth.js";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./auth.js";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./audit.js";
export type { ImpersonationAuditEntry } from "./audit.js";

// Schemas tenant-config (Core identity service)
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateCoreConfig,
} from "./tenant-config.js";
export type {
  CoreConfigState,
  CoreLegacyPlan,
  CoreRawKvConfig,
  CoreTenantBranding,
  CoreTenantConfig,
  CoreTenantFeatures,
  CoreTenantSecurityPolicy,
} from "./tenant-config.js";
