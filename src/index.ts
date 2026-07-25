// Identity & Multitenancy
export { invalidateTenantCache, resolveTenant, resolveTenantById } from "./identity/context";
export type { D1DatabaseBinding, KVNamespaceBinding } from "./identity/context";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./identity/jwt";
export type { IdentityClaims } from "./identity/jwt";

// Sessão & cookies (BaggioAuth)
export {
  BaggioAuth,
  BAGGIO_SESSION_COOKIE,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  CORE_EFFECTIVE_TENANT_COOKIE,
  CORE_SESSION_COOKIE,
} from "./identity/auth";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./identity/auth";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./identity/audit";
export type { ImpersonationAuditEntry } from "./identity/audit";

// Core tenant-config schema
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateCoreConfig,
} from "./identity/tenant-config";
export type {
  CoreConfigState,
  CoreLegacyPlan,
  CoreRawKvConfig,
  CoreTenantBranding,
  CoreTenantConfig,
  CoreTenantFeatures,
  CoreTenantSecurityPolicy,
} from "./identity/tenant-config";

// Governance & Feature Gating
export { can } from "./governance/gating";
export { getPlanQuotas, isPlanAtLeast, PLAN_QUOTAS } from "./governance/plans";
export type { PlanQuotas } from "./governance/plans";

// Persistence Adapters
export { createTenantedDB, TenantedDB } from "./persistence/d1";
export { createTenantedKV, TenantedKV } from "./persistence/kv";
export { createTenantedR2, TenantedR2 } from "./persistence/r2";
export type { R2BucketBinding, R2Object } from "./persistence/r2";
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./persistence/breaker";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./persistence/breaker";
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./persistence/cloudflare-rest";
export type { CloudflareKvRestConfig } from "./persistence/cloudflare-rest";

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
} from "./forensics/index";
export type {
  ExportHistoryEntry,
  ForensicIntegrity,
  ForensicIntegritySummary,
  ForensicLogRow,
  ForensicTablePayload,
  ForensicValidationError,
  VerifyArchiveInput,
  VerifyArchiveOutput,
} from "./forensics/index";

// Security
export {
  escapeSqlForLog,
  generateId,
  isValidHostname,
  isValidSlug,
  sanitizeObject,
  stripHtml,
  truncate,
} from "./security/sanitizer";

// Theme & White-label
export {
  buildCssVariables,
  getThemeVariables,
  invalidateThemeCache,
  serializeCssVars,
} from "./theme/injector";

// Types & DTOs
export {
  asTenantID,
  asPartnerID,
  asUserID,
  CoreError,
} from "./types/index";
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
} from "./types/index";

// Utils
export {
  assertDefined,
  compactObject,
  entries,
  nowISO,
  toPaginationSQL,
} from "./utils/index";
export type { PaginationParams } from "./utils/index";
