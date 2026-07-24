import type { Plan } from "../types/index.ts";

export interface PlanQuotas {
  projects: number;
  members: number;
  storageGb: number;
  apiCallsPerMonth: number;
  customDomains: number;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

// Quotas definidas centralmente — alterar aqui reflete em todos os SaaS imediatamente
export const PLAN_QUOTAS: Record<Plan, PlanQuotas> = {
  solo: {
    projects: 3,
    members: 1,
    storageGb: 1,
    apiCallsPerMonth: 1_000,
    customDomains: 0,
    whiteLabel: false,
    prioritySupport: false,
  },
  start: {
    projects: 10,
    members: 3,
    storageGb: 5,
    apiCallsPerMonth: 10_000,
    customDomains: 1,
    whiteLabel: false,
    prioritySupport: false,
  },
  growth: {
    projects: 30,
    members: 10,
    storageGb: 20,
    apiCallsPerMonth: 50_000,
    customDomains: 3,
    whiteLabel: false,
    prioritySupport: false,
  },
  agency: {
    projects: 100,
    members: 25,
    storageGb: 100,
    apiCallsPerMonth: 200_000,
    customDomains: 10,
    whiteLabel: true,
    prioritySupport: false,
  },
  business: {
    projects: 500,
    members: 100,
    storageGb: 500,
    apiCallsPerMonth: 1_000_000,
    customDomains: 50,
    whiteLabel: true,
    prioritySupport: true,
  },
  pro: {
    projects: Infinity,
    members: Infinity,
    storageGb: Infinity,
    apiCallsPerMonth: Infinity,
    customDomains: Infinity,
    whiteLabel: true,
    prioritySupport: true,
  },
};

export function getPlanQuotas(plan: Plan): PlanQuotas {
  return PLAN_QUOTAS[plan];
}

// Hierarquia de planos para comparação (ex: "pode fazer upgrade?")
const PLAN_ORDER: Plan[] = ["solo", "start", "growth", "agency", "business", "pro"];

export function isPlanAtLeast(current: Plan, minimum: Plan): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(minimum);
}
