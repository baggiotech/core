import type { Plan, TenantContext } from "../types/index.ts";
import { CoreError } from "../types/index.ts";
import { getPlanQuotas, isPlanAtLeast } from "./plans.ts";
import type { PlanQuotas } from "./plans.ts";

type QuotaKey = keyof Pick<
  PlanQuotas,
  "projects" | "members" | "storageGb" | "apiCallsPerMonth" | "customDomains"
>;

type FeatureKey = keyof Pick<PlanQuotas, "whiteLabel" | "prioritySupport">;

// API fluente: core.can(tenant).use('whiteLabel')
//              core.can(tenant).create('projects', currentCount)
class TenantGate {
  private readonly quotas: PlanQuotas;

  constructor(private readonly tenant: TenantContext) {
    this.quotas = getPlanQuotas(tenant.plan);
  }

  // Verifica se o tenant pode executar mais uma operação numa quota numérica
  create(resource: QuotaKey, currentUsage: number): boolean {
    const limit = this.quotas[resource];
    return currentUsage < limit;
  }

  // Lança exceção se não puder criar
  assertCreate(resource: QuotaKey, currentUsage: number): void {
    if (!this.create(resource, currentUsage)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Quota exceeded for '${resource}' on plan '${this.tenant.plan}'. Limit: ${this.quotas[resource]}, Current: ${currentUsage}`,
      );
    }
  }

  // Verifica se uma feature booleana está disponível no plano
  use(feature: FeatureKey): boolean {
    return this.quotas[feature];
  }

  // Lança exceção se feature não disponível
  assertUse(feature: FeatureKey): void {
    if (!this.use(feature)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Feature '${feature}' is not available on plan '${this.tenant.plan}'`,
      );
    }
  }

  // Verifica se o tenant está num plano mínimo
  requiresPlan(minimum: Plan): boolean {
    return isPlanAtLeast(this.tenant.plan, minimum);
  }

  assertPlan(minimum: Plan): void {
    if (!this.requiresPlan(minimum)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `This action requires plan '${minimum}' or higher. Current plan: '${this.tenant.plan}'`,
      );
    }
  }
}

export function can(tenant: TenantContext): TenantGate {
  return new TenantGate(tenant);
}
