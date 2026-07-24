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
  VOLT_EFFECTIVE_TENANT_COOKIE,
  VOLT_SESSION_COOKIE,
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

// Schemas tenant-config (Volt identity service)
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateVoltConfig,
} from "./tenant-config.ts";
export type {
  VoltConfigState,
  VoltLegacyPlan,
  VoltRawKvConfig,
  VoltTenantBranding,
  VoltTenantConfig,
  VoltTenantFeatures,
  VoltTenantSecurityPolicy,
} from "./tenant-config.ts";
