declare const __brand: unique symbol;
type Brand<T, B> = T & {
    readonly [__brand]: B;
};
type TenantID = Brand<string, "TenantID">;
type UserID = Brand<string, "UserID">;
type PartnerID = Brand<string, "PartnerID">;
declare function asTenantID(id: string): TenantID;
declare function asUserID(id: string): UserID;
declare function asPartnerID(id: string): PartnerID;
type Plan = "solo" | "start" | "growth" | "agency" | "business" | "pro";
type TenantStatus = "active" | "suspended" | "trial" | "cancelled";
interface TenantRecord {
    id: TenantID;
    name: string;
    slug: string;
    plan_id: Plan;
    partner_id: PartnerID | null;
    custom_domain: string | null;
    theme_config: ThemeConfig | null;
    status: TenantStatus;
    created_at: string;
}
interface ThemeConfig {
    primaryColor?: string;
    bgColor?: string;
    textColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    fontMain?: string;
}
interface TenantContext {
    readonly id: TenantID;
    readonly slug: string;
    readonly plan: Plan;
    readonly partnerId: PartnerID | null;
    readonly themeConfig: ThemeConfig | null;
    readonly status: TenantStatus;
}
type Role = "admin" | "editor" | "viewer";
interface UserClaims {
    sub: UserID;
    tenantId: TenantID;
    role: Role;
    email: string;
    iat: number;
    exp: number;
}
interface TenantCacheEntry {
    tenantId: TenantID;
    plan: Plan;
    themeVars: Record<string, string>;
    status: TenantStatus;
}
type CoreErrorCode = "TENANT_NOT_FOUND" | "TENANT_SUSPENDED" | "QUOTA_EXCEEDED" | "UNAUTHORIZED" | "INVALID_TOKEN" | "ISOLATION_VIOLATION" | "INFRA_FAILURE" | "CIRCUIT_OPEN" | "SCHEMA_VIOLATION" | "CONFIG_NOT_FOUND" | "IMPERSONATION_BLOCKED" | "KMS_UNAVAILABLE";
declare class CoreError extends Error {
    readonly code: CoreErrorCode;
    constructor(code: CoreErrorCode, message: string);
}

export { CoreError as C, type PartnerID as P, type Role as R, type TenantCacheEntry as T, type UserClaims as U, type CoreErrorCode as a, type Plan as b, type TenantContext as c, type TenantID as d, type TenantRecord as e, type TenantStatus as f, type ThemeConfig as g, type UserID as h, asPartnerID as i, asTenantID as j, asUserID as k };
