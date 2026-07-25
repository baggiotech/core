export { resolveTenant, resolveTenantById } from "./context";
export type {
  D1DatabaseBinding,
  D1PreparedStatement,
  KVNamespaceBinding,
} from "./context";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./jwt";
export type { IdentityClaims } from "./jwt";

// Sessão & cookies
export {
  BaggioAuth,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  CORE_EFFECTIVE_TENANT_COOKIE,
  CORE_SESSION_COOKIE,
} from "./auth";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./auth";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./audit";
export type { ImpersonationAuditEntry } from "./audit";

// Schemas tenant-config (Core identity service)
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateCoreConfig,
} from "./tenant-config";
export type {
  CoreConfigState,
  CoreLegacyPlan,
  CoreRawKvConfig,
  CoreTenantBranding,
  CoreTenantConfig,
  CoreTenantFeatures,
  CoreTenantSecurityPolicy,
} from "./tenant-config";
