import { describe, it, expect } from "vitest";
import {
  assertImpersonationSafe,
  isActionAllowedUnderImpersonation,
} from "../../governance/impersonation.ts";
import { CoreError } from "../../types/index.ts";

const impersonated = { isImpersonating: true };
const normal = { isImpersonating: false };

// ─── Volt Auth PRD v2.7 §3.4: acessos laterais barrados ──────────────────────

describe("isActionAllowedUnderImpersonation", () => {
  const blocked = [
    "billing.subscription.create",
    "billing.read",
    "infra.domain.update",
    "infra.keys.rotate",
    "tenant.config.update",
    "user.delete",
    "webhook.destroy",
    "tenant.wipe",
    "USER.DELETE", // case-insensitive
  ];

  const allowed = [
    "user.read",
    "audit.view",
    "session.list",
    "user.roles.update",
    "deletefoo.read", // "delete" no meio do segmento não conta como sufixo
  ];

  it.each(blocked.map((a) => [a]))("bloqueia '%s'", (action) => {
    expect(isActionAllowedUnderImpersonation(action)).toBe(false);
  });

  it.each(allowed.map((a) => [a]))("permite '%s'", (action) => {
    expect(isActionAllowedUnderImpersonation(action)).toBe(true);
  });
});

describe("assertImpersonationSafe", () => {
  it("lança IMPERSONATION_BLOCKED para ação lateral em sessão personificada", () => {
    try {
      assertImpersonationSafe(impersonated, "billing.subscription.create");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CoreError);
      expect((e as CoreError).code).toBe("IMPERSONATION_BLOCKED");
    }
  });

  it("lança para comandos de deleção em sessão personificada", () => {
    expect(() => assertImpersonationSafe(impersonated, "user.delete")).toThrow(CoreError);
  });

  it("permite ação segura em sessão personificada", () => {
    expect(() => assertImpersonationSafe(impersonated, "audit.view")).not.toThrow();
  });

  it("não interfere em sessões normais, mesmo para ações sensíveis", () => {
    expect(() => assertImpersonationSafe(normal, "billing.subscription.create")).not.toThrow();
    expect(() => assertImpersonationSafe(normal, "user.delete")).not.toThrow();
  });
});
