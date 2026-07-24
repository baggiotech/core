export { D as D1DatabaseBinding, K as KVNamespaceBinding, i as invalidateTenantCache, r as resolveTenant, a as resolveTenantById } from './context-DQ2cq12F.cjs';
export { B as BAGGIO_SESSION_COOKIE, a as BaggioAuth, C as CookieStoreLike, D as DEFAULT_SESSION_COOKIE_OPTIONS, b as DEFAULT_SESSION_TTL_SECONDS, c as DEFAULT_TOKEN_ISSUER, I as IdentityClaims, d as ImpersonationAuditEntry, S as SessionCookieOptions, V as VOLT_EFFECTIVE_TENANT_COOKIE, e as VOLT_SESSION_COOKIE, f as VerifiedSession, g as VerifyOptions, h as VoltConfigState, i as VoltLegacyPlan, j as VoltRawKvConfig, k as VoltTenantBranding, l as VoltTenantConfig, m as VoltTenantFeatures, n as VoltTenantSecurityPolicy, o as assertRole, p as assertTenantMatch, q as bridgeLegacyPlan, r as buildCorruptionId, s as extractBearerToken, t as hasRole, u as identityClaimsToUserClaims, v as logImpersonationEvent, w as maybeLogImpersonation, x as validateVoltConfig, y as verifyTokenEdDSA } from './index-DdMNkAvX.cjs';
export { P as PLAN_QUOTAS, a as PlanQuotas, c as can, g as getPlanQuotas, i as isPlanAtLeast } from './gating-Da8GdeOv.cjs';
export { T as TenantedDB, c as createTenantedDB } from './d1-B3kVO_hy.cjs';
export { BreakerStatus, CircuitBreaker, CircuitBreakerOpts, CloudflareKvRestConfig, DEFAULT_BREAKER_OPTS, R2BucketBinding, R2Object, TenantedKV, TenantedR2, cloudflareKvRestFromEnv, createCircuitBreaker, createCloudflareKvRest, createTenantedKV, createTenantedR2, getBreaker, hasCloudflareKvCredentials, resetBreakerRegistry } from './persistence/index.cjs';
export { ExportHistoryEntry, ForensicIntegrity, ForensicIntegritySummary, ForensicLogRow, ForensicTablePayload, ForensicValidationError, VerifyArchiveInput, VerifyArchiveOutput, buildArchiveKey, fetchTenantJwksKey, base64UrlToBytes as forensicsBase64UrlToBytes, hexToBytes as forensicsHexToBytes, mapToForensicRows, summarizeForensicIntegrity, verifyArchive, verifyEd25519Signature } from './forensics/index.cjs';
export { escapeSqlForLog, generateId, isValidHostname, isValidSlug, sanitizeObject, stripHtml, truncate } from './security/index.cjs';
export { buildCssVariables, getThemeVariables, invalidateThemeCache, serializeCssVars } from './theme/index.cjs';
export { C as CoreError, a as CoreErrorCode, P as PartnerID, b as Plan, R as Role, T as TenantCacheEntry, c as TenantContext, d as TenantID, e as TenantRecord, f as TenantStatus, g as ThemeConfig, U as UserClaims, h as UserID, i as asPartnerID, j as asTenantID, k as asUserID } from './index-CdIZiX7c.cjs';

declare function nowISO(): string;
interface PaginationParams {
    page: number;
    pageSize: number;
}
declare function toPaginationSQL(params: PaginationParams): {
    limit: number;
    offset: number;
};
declare function entries<T extends object>(obj: T): [keyof T, T[keyof T]][];
declare function assertDefined<T>(value: T | null | undefined, label: string): T;
declare function compactObject<T extends object>(obj: T): Partial<{
    [K in keyof T]: NonNullable<T[K]>;
}>;

export { type PaginationParams, assertDefined, compactObject, entries, nowISO, toPaginationSQL };
