import type { Plan } from "../types/index";
import { CoreError } from "../types/index";

// ─── Tipos globais do Core Identity Service ───────────────────────────────────
// Vivem no Core para que outros apps (Burnite, Basalt) possam consumir o
// estado do tenant sem reimplementar contratos.

export interface CoreTenantBranding {
  appName: string;
  logoUrl?: string;
  primaryColor: string;
  faviconUrl?: string;
  supportEmail?: string;
}

export interface CoreTenantFeatures {
  oauth: boolean;
  passkeys: boolean;
  mfa: boolean;
  socialProviders: boolean;
  customDomain: boolean;
  webhooks: boolean;
  compliance: boolean;
}

export interface CoreTenantSecurityPolicy {
  mfaRequired: boolean;
  sessionTimeoutSeconds: number;
  maxFailedAttempts: number;
  geoFencing: boolean;
  blockedCountries: string[];
}

// Plano herdado do Core (legacy) — mapeado para o Plan canônico do Core.
export type CoreLegacyPlan = "free" | "starter" | "pro" | "enterprise";

export interface CoreTenantConfig {
  tenantId: string;
  domain: string;
  branding: CoreTenantBranding;
  features: CoreTenantFeatures;
  security: CoreTenantSecurityPolicy;
  plan: CoreLegacyPlan;
  createdAt: string;
  updatedAt: string;
}

// Estado de configuração com falhas modeladas como first-class domain states.
export type CoreConfigState =
  | { status: "ok"; tenantId: string; config: CoreTenantConfig }
  | { status: "tenant_suspended"; tenantId: string; reason: string }
  | { status: "config_corrupted"; tenantId: string; reason: string; corruptionId: string }
  | { status: "infra_failure"; tenantId: string; reason: string };

// Aceita o modelo Rust (flat) e o console-native (nested).
// A partir de 2026-Q2 o Rust core emite camelCase nativo — mantemos os campos
// snake_case como leitura legada para tenants cuja config ainda não foi
// reescrita após a migração de schema.
export interface CoreRawKvConfig {
  suspended?: boolean;
  suspension_reason?: string;
  suspensionReason?: string;
  tenant_id?: string;
  tenantId?: string;
  domain?: string;
  branding?: Partial<CoreTenantBranding>;
  features?: Partial<CoreTenantFeatures>;
  security?: Partial<CoreTenantSecurityPolicy>;
  plan?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  // Rust worker model — camelCase (atual)
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
  // Rust worker model — snake_case (legado, pré-migração camelCase)
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

// Constrói um ID de corrupção determinístico baseado em tenantId + reason.
// Não usa crypto.subtle (sync) — hash linear-congruente é suficiente como token
// para correlacionar logs de erro.
export function buildCorruptionId(tenantId: string, reason: string): string {
  const seed = `${tenantId}:${reason}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return `crp_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

const LEGACY_PLAN_VALUES: CoreLegacyPlan[] = ["free", "starter", "pro", "enterprise"];

function normalizeLegacyPlan(raw: string | undefined): CoreLegacyPlan {
  if (!raw) return "free";
  if ((LEGACY_PLAN_VALUES as string[]).includes(raw)) return raw as CoreLegacyPlan;
  return "free";
}

// Mapeia o plano legado para o Plan canônico do Core (governance).
const PLAN_BRIDGE: Record<CoreLegacyPlan, Plan> = {
  free: "solo",
  starter: "start",
  pro: "pro",
  enterprise: "business",
};

export function bridgeLegacyPlan(legacy: CoreLegacyPlan): Plan {
  return PLAN_BRIDGE[legacy];
}

// Normaliza o RawKvConfig (flat Rust ou nested console-native) num
// CoreTenantConfig validado. Lança CoreError("SCHEMA_VIOLATION") em campos
// obrigatórios ausentes — pegamos no caller para emitir status corrupted.
// Preferência de leitura: nested console-native > Rust camelCase > Rust snake_case (legado).
export function validateCoreConfig(raw: CoreRawKvConfig, fallbackTenantId: string): CoreTenantConfig {
  const resolvedTenantId = raw.tenantId ?? raw.tenant_id ?? raw.id ?? fallbackTenantId;
  const domain = raw.domain ?? raw.customDomain ?? raw.custom_domain ?? `${resolvedTenantId}.core.id`;
  const appName = raw.branding?.appName ?? raw.brandName ?? raw.brand_name;
  const logoUrl = raw.branding?.logoUrl ?? raw.brandLogoUrl ?? raw.brand_logo_url;
  const primaryColor = raw.branding?.primaryColor ?? raw.brandColor ?? raw.brand_color ?? "#8C48A1";
  const maxFailedAttempts = raw.security?.maxFailedAttempts ?? raw.shieldMaxAttempts ?? raw.shield_max_attempts ?? 5;
  const blockedCountries = raw.security?.blockedCountries ?? raw.blockedCountries ?? raw.blocked_countries ?? [];
  const planSource = raw.plan ?? raw.tier;

  if (typeof domain !== "string" || domain.trim() === "") {
    throw new CoreError("SCHEMA_VIOLATION", "Config missing required field: domain");
  }
  if (typeof appName !== "string" || appName.trim() === "") {
    throw new CoreError("SCHEMA_VIOLATION", "Config missing required field: branding.appName");
  }

  return {
    tenantId: resolvedTenantId,
    domain,
    branding: {
      appName,
      logoUrl,
      primaryColor,
      faviconUrl: raw.branding?.faviconUrl,
      supportEmail: raw.branding?.supportEmail,
    },
    features: {
      oauth: raw.features?.oauth ?? false,
      passkeys: raw.features?.passkeys ?? false,
      mfa: raw.features?.mfa ?? false,
      socialProviders: raw.features?.socialProviders ?? false,
      customDomain: raw.features?.customDomain ?? false,
      webhooks: raw.features?.webhooks ?? false,
      compliance: raw.features?.compliance ?? false,
    },
    security: {
      mfaRequired: raw.security?.mfaRequired ?? false,
      sessionTimeoutSeconds: raw.security?.sessionTimeoutSeconds ?? 3600,
      maxFailedAttempts,
      geoFencing: raw.security?.geoFencing ?? false,
      blockedCountries,
    },
    plan: normalizeLegacyPlan(planSource),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
  };
}
