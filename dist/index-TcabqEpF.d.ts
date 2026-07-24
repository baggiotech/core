import { K as KVNamespaceBinding, D as D1DatabaseBinding } from './context-Bf66k4V3.js';
import { R as Role, U as UserClaims, d as TenantID, b as Plan } from './index-CdIZiX7c.js';

interface IdentityClaims {
    iss: string;
    sub: string;
    tenant_id: string;
    role: string;
    jti: string;
    aud: string;
    iat: number;
    exp: number;
    mfa_pending?: boolean;
    roles?: string[];
    scope?: string;
    act_as?: string;
    act?: {
        sub: string;
    };
    is_impersonated?: boolean;
    uid?: string;
    orgs?: string[];
}
declare function extractBearerToken(authHeader: string | null): string | null;
declare function assertTenantMatch(claims: UserClaims, tenantId: TenantID): void;
declare function hasRole(userRole: Role, requiredRole: Role): boolean;
declare function assertRole(userRole: Role, requiredRole: Role): void;
declare function verifyTokenEdDSA(token: string, publicKeyBase64Url: string): Promise<IdentityClaims>;
declare function identityClaimsToUserClaims(claims: IdentityClaims): UserClaims;

declare const BAGGIO_SESSION_COOKIE = "baggio_session";
declare const VOLT_SESSION_COOKIE = "baggio_session";
declare const VOLT_EFFECTIVE_TENANT_COOKIE = "baggio_tenant_id";
declare const DEFAULT_SESSION_TTL_SECONDS = 3600;
declare const DEFAULT_TOKEN_ISSUER = "volt-identity";
interface SessionCookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    path: string;
    maxAge: number;
    domain?: string;
    useHostPrefix?: boolean;
}
declare const DEFAULT_SESSION_COOKIE_OPTIONS: SessionCookieOptions;
interface CookieStoreLike {
    get(name: string): {
        value: string;
    } | undefined;
    set(name: string, value: string, options?: Partial<SessionCookieOptions>): void;
    delete?(name: string): void;
}
interface VerifyOptions {
    publicKeyBase64Url?: string;
    fallbackVerifyUrl?: string;
    expectedIssuer?: string;
    revocationKV?: KVNamespaceBinding;
    fetchImpl?: typeof fetch;
}
interface VerifiedSession {
    claims: IdentityClaims;
    userClaims: UserClaims;
    tenantId: TenantID;
    effectiveTenantId: TenantID;
    role: string;
    token: string;
    isImpersonating: boolean;
}
declare class BaggioAuth {
    static createSession(cookieStore: CookieStoreLike, token: string, overrides?: Partial<SessionCookieOptions>): void;
    static clearSession(cookieStore: CookieStoreLike): void;
    static verify(cookieStore: CookieStoreLike, options: VerifyOptions): Promise<VerifiedSession>;
}

interface ImpersonationAuditEntry {
    action: string;
    details?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
}
declare function logImpersonationEvent(db: D1DatabaseBinding, session: VerifiedSession, entry: ImpersonationAuditEntry): Promise<string>;
declare function maybeLogImpersonation(db: D1DatabaseBinding, session: VerifiedSession, entry: ImpersonationAuditEntry): Promise<string | null>;

interface VoltTenantBranding {
    appName: string;
    logoUrl?: string;
    primaryColor: string;
    faviconUrl?: string;
    supportEmail?: string;
}
interface VoltTenantFeatures {
    oauth: boolean;
    passkeys: boolean;
    mfa: boolean;
    socialProviders: boolean;
    customDomain: boolean;
    webhooks: boolean;
    compliance: boolean;
}
interface VoltTenantSecurityPolicy {
    mfaRequired: boolean;
    sessionTimeoutSeconds: number;
    maxFailedAttempts: number;
    geoFencing: boolean;
    blockedCountries: string[];
}
type VoltLegacyPlan = "free" | "starter" | "pro" | "enterprise";
interface VoltTenantConfig {
    tenantId: string;
    domain: string;
    branding: VoltTenantBranding;
    features: VoltTenantFeatures;
    security: VoltTenantSecurityPolicy;
    plan: VoltLegacyPlan;
    createdAt: string;
    updatedAt: string;
}
type VoltConfigState = {
    status: "ok";
    tenantId: string;
    config: VoltTenantConfig;
} | {
    status: "tenant_suspended";
    tenantId: string;
    reason: string;
} | {
    status: "config_corrupted";
    tenantId: string;
    reason: string;
    corruptionId: string;
} | {
    status: "infra_failure";
    tenantId: string;
    reason: string;
};
interface VoltRawKvConfig {
    suspended?: boolean;
    suspension_reason?: string;
    suspensionReason?: string;
    tenant_id?: string;
    tenantId?: string;
    domain?: string;
    branding?: Partial<VoltTenantBranding>;
    features?: Partial<VoltTenantFeatures>;
    security?: Partial<VoltTenantSecurityPolicy>;
    plan?: string;
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
    id?: string;
    brandName?: string;
    brandLogoUrl?: string;
    brandColor?: string;
    customDomain?: string | null;
    domainStatus?: string;
    shieldMaxAttempts?: number;
    blockedCountries?: string[];
    riskSensitivity?: string;
    tier?: string;
    mauLimit?: number;
    billingProvider?: string;
    subscriptionStatus?: string;
    brand_name?: string;
    brand_logo_url?: string;
    brand_color?: string;
    custom_domain?: string | null;
    domain_status?: string;
    shield_max_attempts?: number;
    blocked_countries?: string[];
    risk_sensitivity?: string;
    mau_limit?: number;
    billing_provider?: string;
    subscription_status?: string;
}
declare function buildCorruptionId(tenantId: string, reason: string): string;
declare function bridgeLegacyPlan(legacy: VoltLegacyPlan): Plan;
declare function validateVoltConfig(raw: VoltRawKvConfig, fallbackTenantId: string): VoltTenantConfig;

export { BAGGIO_SESSION_COOKIE as B, type CookieStoreLike as C, DEFAULT_SESSION_COOKIE_OPTIONS as D, type IdentityClaims as I, type SessionCookieOptions as S, VOLT_EFFECTIVE_TENANT_COOKIE as V, BaggioAuth as a, DEFAULT_SESSION_TTL_SECONDS as b, DEFAULT_TOKEN_ISSUER as c, type ImpersonationAuditEntry as d, VOLT_SESSION_COOKIE as e, type VerifiedSession as f, type VerifyOptions as g, type VoltConfigState as h, type VoltLegacyPlan as i, type VoltRawKvConfig as j, type VoltTenantBranding as k, type VoltTenantConfig as l, type VoltTenantFeatures as m, type VoltTenantSecurityPolicy as n, assertRole as o, assertTenantMatch as p, bridgeLegacyPlan as q, buildCorruptionId as r, extractBearerToken as s, hasRole as t, identityClaimsToUserClaims as u, logImpersonationEvent as v, maybeLogImpersonation as w, validateVoltConfig as x, verifyTokenEdDSA as y };
