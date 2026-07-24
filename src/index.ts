// Identity & Multitenancy
export { invalidateTenantCache, resolveTenant, resolveTenantById } from "./identity/context.ts";
export type { D1DatabaseBinding, KVNamespaceBinding } from "./identity/context.ts";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./identity/jwt.ts";
export type { IdentityClaims } from "./identity/jwt.ts";

// Sessão & cookies (BaggioAuth)
export {
  BaggioAuth,
  BAGGIO_SESSION_COOKIE,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  VOLT_EFFECTIVE_TENANT_COOKIE,
  VOLT_SESSION_COOKIE,
} from "./identity/auth.ts";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./identity/auth.ts";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./identity/audit.ts";
export type { ImpersonationAuditEntry } from "./identity/audit.ts";

// Volt tenant-config schema
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateVoltConfig,
} from "./identity/tenant-config.ts";
export type {
  VoltConfigState,
  VoltLegacyPlan,
  VoltRawKvConfig,
  VoltTenantBranding,
  VoltTenantConfig,
  VoltTenantFeatures,
  VoltTenantSecurityPolicy,
} from "./identity/tenant-config.ts";

// Governance & Feature Gating
export { can } from "./governance/gating.ts";
export { getPlanQuotas, isPlanAtLeast, PLAN_QUOTAS } from "./governance/plans.ts";
export type { PlanQuotas } from "./governance/plans.ts";

// Persistence Adapters
export { createTenantedDB, TenantedDB } from "./persistence/d1.ts";
export { createTenantedKV, TenantedKV } from "./persistence/kv.ts";
export { createTenantedR2, TenantedR2 } from "./persistence/r2.ts";
export type { R2BucketBinding, R2Object } from "./persistence/r2.ts";
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./persistence/breaker.ts";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./persistence/breaker.ts";
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./persistence/cloudflare-rest.ts";
export type { CloudflareKvRestConfig } from "./persistence/cloudflare-rest.ts";

// Forensics (compliance / R2 audit logs)
export {
  base64UrlToBytes as forensicsBase64UrlToBytes,
  buildArchiveKey,
  fetchTenantJwksKey,
  hexToBytes as forensicsHexToBytes,
  mapToForensicRows,
  summarizeForensicIntegrity,
  verifyArchive,
  verifyEd25519Signature,
} from "./forensics/index.ts";
export type {
  ExportHistoryEntry,
  ForensicIntegrity,
  ForensicIntegritySummary,
  ForensicLogRow,
  ForensicTablePayload,
  ForensicValidationError,
  VerifyArchiveInput,
  VerifyArchiveOutput,
} from "./forensics/index.ts";

// Security
export {
  escapeSqlForLog,
  generateId,
  isValidHostname,
  isValidSlug,
  sanitizeObject,
  stripHtml,
  truncate,
} from "./security/sanitizer.ts";

// Theme & White-label
export {
  buildCssVariables,
  getThemeVariables,
  invalidateThemeCache,
  serializeCssVars,
} from "./theme/injector.ts";

// Types & DTOs
export {
  asTenantID,
  asPartnerID,
  asUserID,
  CoreError,
} from "./types/index.ts";
export type {
  CoreErrorCode,
  PartnerID,
  Plan,
  Role,
  TenantCacheEntry,
  TenantContext,
  TenantID,
  TenantRecord,
  TenantStatus,
  ThemeConfig,
  UserClaims,
  UserID,
} from "./types/index.ts";

// Utils
export {
  assertDefined,
  compactObject,
  entries,
  nowISO,
  toPaginationSQL,
} from "./utils/index.ts";
export type { PaginationParams } from "./utils/index.ts";
