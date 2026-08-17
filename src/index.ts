// Identity & Multitenancy
export { invalidateTenantCache, resolveTenant, resolveTenantById } from "./identity/context.js";
export type { D1DatabaseBinding, KVNamespaceBinding } from "./identity/context.js";
export {
  assertRole,
  assertTenantMatch,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  verifyTokenEdDSA,
} from "./identity/jwt.js";
export type { IdentityClaims } from "./identity/jwt.js";

// Sessão & cookies (BaggioAuth)
export {
  BaggioAuth,
  BAGGIO_SESSION_COOKIE,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  CORE_EFFECTIVE_TENANT_COOKIE,
  CORE_SESSION_COOKIE,
} from "./identity/auth.js";
export type {
  CookieStoreLike,
  SessionCookieOptions,
  VerifiedSession,
  VerifyOptions,
} from "./identity/auth.js";

// Audit do Impersonation Gate
export { logImpersonationEvent, maybeLogImpersonation } from "./identity/audit.js";
export type { ImpersonationAuditEntry } from "./identity/audit.js";

// Owner Resolution (MASTER_EMAILS centralizados)
export { isOwnerEmail, resolveOwner } from "./identity/owner.js";
export type { OwnerResolution } from "./identity/owner.js";

// Niche Dictionary
export { getDictionary, CRM_DICTIONARIES } from "./identity/niche.js";
export type { CrmDictionary, NicheType } from "./identity/niche.js";

// Core tenant-config schema
export {
  bridgeLegacyPlan,
  buildCorruptionId,
  validateCoreConfig,
} from "./identity/tenant-config.js";
export type {
  CoreConfigState,
  CoreLegacyPlan,
  CoreRawKvConfig,
  CoreTenantBranding,
  CoreTenantConfig,
  CoreTenantFeatures,
  CoreTenantSecurityPolicy,
} from "./identity/tenant-config.js";

// Governance & Feature Gating
export { can } from "./governance/gating.js";
export { getPlanQuotas, isPlanAtLeast, PLAN_QUOTAS } from "./governance/plans.js";
export type { PlanQuotas } from "./governance/plans.js";
export {
  Modules,
  WorkspaceModules,
  hasPermission,
  hasModule,
  addModule,
  removeModule,
  buildBitmask,
  serializeBitmask,
  deserializeBitmask,
} from "./governance/permissions.js";
export type { ModuleKey } from "./governance/permissions.js";
export * from "./governance/automations.js";
export * from "./governance/presets.js";
export * from "./governance/revisions.js";
export * from "./governance/field-policies.js";



// Persistence Adapters
export { createTenantedDB, TenantedDB } from "./persistence/d1.js";
export { createTenantedKV, TenantedKV } from "./persistence/kv.js";
export { createTenantedR2, TenantedR2 } from "./persistence/r2.js";
export type { R2BucketBinding, R2Object } from "./persistence/r2.js";
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./persistence/breaker.js";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./persistence/breaker.js";
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./persistence/cloudflare-rest.js";
export type { CloudflareKvRestConfig } from "./persistence/cloudflare-rest.js";

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
} from "./forensics/index.js";
export type {
  ExportHistoryEntry,
  ForensicIntegrity,
  ForensicIntegritySummary,
  ForensicLogRow,
  ForensicTablePayload,
  ForensicValidationError,
  VerifyArchiveInput,
  VerifyArchiveOutput,
} from "./forensics/index.js";

// Security
export {
  escapeSqlForLog,
  generateId,
  isValidHostname,
  isValidSlug,
  sanitizeObject,
  stripHtml,
  truncate,
} from "./security/sanitizer.js";

// Theme & White-label
export {
  buildCssVariables,
  getThemeVariables,
  invalidateThemeCache,
  serializeCssVars,
} from "./theme/injector.js";

// Types & DTOs
export {
  asTenantID,
  asPartnerID,
  asUserID,
  CoreError,
} from "./types/index.js";
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
} from "./types/index.js";

// Utils
export {
  assertDefined,
  compactObject,
  entries,
  nowISO,
  toPaginationSQL,
} from "./utils/index.js";
export type { PaginationParams } from "./utils/index.js";
