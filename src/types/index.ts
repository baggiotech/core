// Branded types — garantem que IDs distintos não sejam trocados acidentalmente
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type TenantID = Brand<string, "TenantID">;
export type UserID = Brand<string, "UserID">;
export type PartnerID = Brand<string, "PartnerID">;

export function asTenantID(id: string): TenantID {
  return id as TenantID;
}

export function asUserID(id: string): UserID {
  return id as UserID;
}

export function asPartnerID(id: string): PartnerID {
  return id as PartnerID;
}

// Tiers de plano — mesma ordem que aparece no Pricing da mkt
export type Plan = "solo" | "start" | "growth" | "agency" | "business" | "pro";

export type TenantStatus = "active" | "suspended" | "trial" | "cancelled";

export interface TenantRecord {
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

export interface ThemeConfig {
  primaryColor?: string;
  bgColor?: string;
  textColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  fontMain?: string;
}

// DTO imutável que trafega dentro de cada requisição
export interface TenantContext {
  readonly id: TenantID;
  readonly slug: string;
  readonly plan: Plan;
  readonly partnerId: PartnerID | null;
  readonly themeConfig: ThemeConfig | null;
  readonly status: TenantStatus;
}

// RBAC
export type Role = "admin" | "editor" | "viewer";

export interface UserClaims {
  sub: UserID;
  tenantId: TenantID;
  role: Role;
  email: string;
  iat: number;
  exp: number;
}

// KV cache shape
export interface TenantCacheEntry {
  tenantId: TenantID;
  plan: Plan;
  themeVars: Record<string, string>;
  status: TenantStatus;
}

// Erro tipado do Core
export type CoreErrorCode =
  | "TENANT_NOT_FOUND"
  | "TENANT_SUSPENDED"
  | "QUOTA_EXCEEDED"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "ISOLATION_VIOLATION"
  | "INFRA_FAILURE"
  | "CIRCUIT_OPEN"
  | "SCHEMA_VIOLATION"
  | "CONFIG_NOT_FOUND"
  | "IMPERSONATION_BLOCKED"
  | "KMS_UNAVAILABLE";

export class CoreError extends Error {
  constructor(
    public readonly code: CoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CoreError";
  }
}
