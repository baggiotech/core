import { b as Plan, c as TenantContext } from './index-CdIZiX7c.js';

interface PlanQuotas {
    projects: number;
    members: number;
    storageGb: number;
    apiCallsPerMonth: number;
    customDomains: number;
    whiteLabel: boolean;
    prioritySupport: boolean;
}
declare const PLAN_QUOTAS: Record<Plan, PlanQuotas>;
declare function getPlanQuotas(plan: Plan): PlanQuotas;
declare function isPlanAtLeast(current: Plan, minimum: Plan): boolean;

type QuotaKey = keyof Pick<PlanQuotas, "projects" | "members" | "storageGb" | "apiCallsPerMonth" | "customDomains">;
type FeatureKey = keyof Pick<PlanQuotas, "whiteLabel" | "prioritySupport">;
declare class TenantGate {
    private readonly tenant;
    private readonly quotas;
    constructor(tenant: TenantContext);
    create(resource: QuotaKey, currentUsage: number): boolean;
    assertCreate(resource: QuotaKey, currentUsage: number): void;
    use(feature: FeatureKey): boolean;
    assertUse(feature: FeatureKey): void;
    requiresPlan(minimum: Plan): boolean;
    assertPlan(minimum: Plan): void;
}
declare function can(tenant: TenantContext): TenantGate;

export { PLAN_QUOTAS as P, type PlanQuotas as a, can as c, getPlanQuotas as g, isPlanAtLeast as i };
