import { describe, it, expect } from "vitest";
import { can } from "../../governance/gating.js";
import { PLAN_QUOTAS } from "../../governance/plans.js";
import { asTenantID, CoreError } from "../../types/index.js";
import type { Plan, TenantContext } from "../../types/index.js";

function makeTenant(plan: Plan): TenantContext {
  return Object.freeze({
    id: asTenantID(`tenant-${plan}`),
    slug: plan,
    plan,
    partnerId: null,
    themeConfig: null,
    status: "active",
  });
}

// ─── Quota checks por tier ────────────────────────────────────────────────────

describe("can().create() — projects quota across all tiers", () => {
  const cases: [Plan, number, boolean][] = [
    // [plan, currentUsage, shouldAllow]
    ["solo", 2, true],
    ["solo", 3, false], // limite = 3
    ["start", 9, true],
    ["start", 10, false], // limite = 10
    ["growth", 29, true],
    ["growth", 30, false], // limite = 30
    ["agency", 99, true],
    ["agency", 100, false], // limite = 100
    ["business", 499, true],
    ["business", 500, false], // limite = 500
    ["pro", 999_999, true], // ilimitado
  ];

  it.each(cases)("plan=%s usage=%i → allow=%s", (plan, usage, allow) => {
    expect(can(makeTenant(plan)).create("projects", usage)).toBe(allow);
  });
});

describe("can().create() — members quota", () => {
  it("solo: 1 member max", () => {
    const t = makeTenant("solo");
    expect(can(t).create("members", 0)).toBe(true);
    expect(can(t).create("members", 1)).toBe(false);
  });

  it("agency: 25 members max", () => {
    const t = makeTenant("agency");
    expect(can(t).create("members", 24)).toBe(true);
    expect(can(t).create("members", 25)).toBe(false);
  });

  it("pro: unlimited members", () => {
    const t = makeTenant("pro");
    expect(can(t).create("members", 100_000)).toBe(true);
  });
});

describe("can().use() — feature flags", () => {
  const featurePlans: [Plan, boolean][] = [
    ["solo", false],
    ["start", false],
    ["growth", false],
    ["agency", true],
    ["business", true],
    ["pro", true],
  ];

  it.each(featurePlans)("whiteLabel on plan=%s → %s", (plan, expected) => {
    expect(can(makeTenant(plan)).use("whiteLabel")).toBe(expected);
  });

  it("prioritySupport only on business and pro", () => {
    expect(can(makeTenant("growth")).use("prioritySupport")).toBe(false);
    expect(can(makeTenant("agency")).use("prioritySupport")).toBe(false);
    expect(can(makeTenant("business")).use("prioritySupport")).toBe(true);
    expect(can(makeTenant("pro")).use("prioritySupport")).toBe(true);
  });
});

// ─── assertCreate — deve lançar CoreError com código correto ─────────────────

describe("can().assertCreate() — throws on quota exceeded", () => {
  it("throws CoreError(QUOTA_EXCEEDED) when limit is hit", () => {
    const t = makeTenant("solo");
    const limit = PLAN_QUOTAS.solo.projects;

    expect(() => can(t).assertCreate("projects", limit)).toThrow(CoreError);
    expect(() => can(t).assertCreate("projects", limit)).toThrowError(
      /projects.*solo/,
    );
  });

  it("does not throw when under limit", () => {
    const t = makeTenant("solo");
    expect(() => can(t).assertCreate("projects", 0)).not.toThrow();
    expect(() => can(t).assertCreate("projects", 2)).not.toThrow();
  });
});

describe("can().assertUse() — throws when feature unavailable", () => {
  it("throws on whiteLabel for solo plan", () => {
    expect(() => can(makeTenant("solo")).assertUse("whiteLabel")).toThrow(CoreError);
  });

  it("does not throw on whiteLabel for agency plan", () => {
    expect(() => can(makeTenant("agency")).assertUse("whiteLabel")).not.toThrow();
  });
});

describe("can().requiresPlan() — plan hierarchy", () => {
  it("solo does not meet agency requirement", () => {
    expect(can(makeTenant("solo")).requiresPlan("agency")).toBe(false);
  });

  it("pro meets all plan requirements", () => {
    const plans: Plan[] = ["solo", "start", "growth", "agency", "business", "pro"];
    for (const required of plans) {
      expect(can(makeTenant("pro")).requiresPlan(required)).toBe(true);
    }
  });

  it("growth meets growth but not agency", () => {
    const t = makeTenant("growth");
    expect(can(t).requiresPlan("start")).toBe(true);
    expect(can(t).requiresPlan("growth")).toBe(true);
    expect(can(t).requiresPlan("agency")).toBe(false);
  });
});
