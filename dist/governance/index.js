// src/types/index.ts
var CoreError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CoreError";
  }
};

// src/governance/plans.ts
var PLAN_QUOTAS = {
  solo: {
    projects: 3,
    members: 1,
    storageGb: 1,
    apiCallsPerMonth: 1e3,
    customDomains: 0,
    whiteLabel: false,
    prioritySupport: false
  },
  start: {
    projects: 10,
    members: 3,
    storageGb: 5,
    apiCallsPerMonth: 1e4,
    customDomains: 1,
    whiteLabel: false,
    prioritySupport: false
  },
  growth: {
    projects: 30,
    members: 10,
    storageGb: 20,
    apiCallsPerMonth: 5e4,
    customDomains: 3,
    whiteLabel: false,
    prioritySupport: false
  },
  agency: {
    projects: 100,
    members: 25,
    storageGb: 100,
    apiCallsPerMonth: 2e5,
    customDomains: 10,
    whiteLabel: true,
    prioritySupport: false
  },
  business: {
    projects: 500,
    members: 100,
    storageGb: 500,
    apiCallsPerMonth: 1e6,
    customDomains: 50,
    whiteLabel: true,
    prioritySupport: true
  },
  pro: {
    projects: Infinity,
    members: Infinity,
    storageGb: Infinity,
    apiCallsPerMonth: Infinity,
    customDomains: Infinity,
    whiteLabel: true,
    prioritySupport: true
  }
};
function getPlanQuotas(plan) {
  return PLAN_QUOTAS[plan];
}
var PLAN_ORDER = ["solo", "start", "growth", "agency", "business", "pro"];
function isPlanAtLeast(current, minimum) {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(minimum);
}

// src/governance/gating.ts
var TenantGate = class {
  constructor(tenant) {
    this.tenant = tenant;
    this.quotas = getPlanQuotas(tenant.plan);
  }
  quotas;
  // Verifica se o tenant pode executar mais uma operação numa quota numérica
  create(resource, currentUsage) {
    const limit = this.quotas[resource];
    return currentUsage < limit;
  }
  // Lança exceção se não puder criar
  assertCreate(resource, currentUsage) {
    if (!this.create(resource, currentUsage)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Quota exceeded for '${resource}' on plan '${this.tenant.plan}'. Limit: ${this.quotas[resource]}, Current: ${currentUsage}`
      );
    }
  }
  // Verifica se uma feature booleana está disponível no plano
  use(feature) {
    return this.quotas[feature];
  }
  // Lança exceção se feature não disponível
  assertUse(feature) {
    if (!this.use(feature)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Feature '${feature}' is not available on plan '${this.tenant.plan}'`
      );
    }
  }
  // Verifica se o tenant está num plano mínimo
  requiresPlan(minimum) {
    return isPlanAtLeast(this.tenant.plan, minimum);
  }
  assertPlan(minimum) {
    if (!this.requiresPlan(minimum)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `This action requires plan '${minimum}' or higher. Current plan: '${this.tenant.plan}'`
      );
    }
  }
};
function can(tenant) {
  return new TenantGate(tenant);
}

// src/governance/impersonation.ts
var BLOCKED_ACTION_PREFIXES = [
  "billing.",
  // dados de faturamento (assinaturas, checkout, gateways)
  "infra.",
  // infraestrutura central (bindings, domínios, chaves)
  "tenant.config."
  // configuração estrutural do tenant
];
var BLOCKED_ACTION_SUFFIXES = [".delete", ".destroy", ".wipe"];
function isActionAllowedUnderImpersonation(action) {
  const normalized = action.toLowerCase();
  if (BLOCKED_ACTION_PREFIXES.some((p) => normalized.startsWith(p))) return false;
  if (BLOCKED_ACTION_SUFFIXES.some((s) => normalized.endsWith(s))) return false;
  return true;
}
function assertImpersonationSafe(session, action) {
  if (!session.isImpersonating) return;
  if (isActionAllowedUnderImpersonation(action)) return;
  throw new CoreError(
    "IMPERSONATION_BLOCKED",
    `Action '${action}' is blocked during impersonation sessions (Volt PRD v2.7 \xA73.4)`
  );
}
export {
  PLAN_QUOTAS,
  assertImpersonationSafe,
  can,
  getPlanQuotas,
  isActionAllowedUnderImpersonation,
  isPlanAtLeast
};
//# sourceMappingURL=index.js.map