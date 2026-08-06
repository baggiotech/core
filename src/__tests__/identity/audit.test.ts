import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { logImpersonationEvent, maybeLogImpersonation } from "../../identity/audit.js";
import type { VerifiedSession } from "../../identity/auth.js";
import { asTenantID, asUserID } from "../../types/index.js";

function buildSession(overrides: Partial<VerifiedSession> = {}): VerifiedSession {
  const tenantId = asTenantID("tenant-real");
  const effective = overrides.effectiveTenantId ?? tenantId;
  return {
    claims: {
      iss: "core-identity",
      sub: "admin@example.com",
      tenant_id: tenantId,
      role: "superadmin",
      jti: "jti-1",
      aud: "core",
      iat: 0,
      exp: 0,
      ...(overrides.claims ?? {}),
    },
    userClaims: {
      sub: asUserID("admin@example.com"),
      tenantId,
      role: "admin",
      email: "admin@example.com",
      iat: 0,
      exp: 0,
    },
    tenantId,
    effectiveTenantId: effective,
    role: "superadmin",
    token: "tok",
    isImpersonating: false,
    ...overrides,
  };
}

describe("logImpersonationEvent", () => {
  it("inserts row with target_tenant_id when tenant-level impersonation", async () => {
    const session = buildSession({
      effectiveTenantId: asTenantID("tenant-target"),
      isImpersonating: true,
    });

    const id = await logImpersonationEvent(env.DB, session, {
      action: "applications.create",
      details: { name: "test-app" },
      ip: "10.0.0.1",
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const row = await env.DB.prepare(
      "SELECT actor_email, target_tenant_id, target_user, action, ip FROM impersonation_audit WHERE id = ?",
    )
      .bind(id)
      .first<{
        actor_email: string;
        target_tenant_id: string | null;
        target_user: string | null;
        action: string;
        ip: string | null;
      }>();

    expect(row).toMatchObject({
      actor_email: "admin@example.com",
      target_tenant_id: "tenant-target",
      target_user: null,
      action: "applications.create",
      ip: "10.0.0.1",
    });
  });

  it("inserts row with target_user when user-level impersonation (act_as)", async () => {
    const session = buildSession({
      claims: {
        iss: "core-identity",
        sub: "admin@example.com",
        tenant_id: "tenant-real",
        role: "admin",
        jti: "jti-x",
        aud: "core",
        iat: 0,
        exp: 0,
        act_as: "user-7",
      },
      isImpersonating: true,
    });

    const id = await logImpersonationEvent(env.DB, session, {
      action: "user.export",
    });

    const row = await env.DB.prepare(
      "SELECT target_user, target_tenant_id FROM impersonation_audit WHERE id = ?",
    )
      .bind(id)
      .first<{ target_user: string | null; target_tenant_id: string | null }>();

    expect(row?.target_user).toBe("user-7");
    expect(row?.target_tenant_id).toBeNull();
  });

  it("maybeLogImpersonation returns null when not impersonating", async () => {
    const session = buildSession({ isImpersonating: false });
    const result = await maybeLogImpersonation(env.DB, session, { action: "noop" });
    expect(result).toBeNull();

    const count = await env.DB.prepare("SELECT COUNT(*) AS c FROM impersonation_audit").first<{ c: number }>();
    expect(count?.c).toBe(0);
  });

  it("maybeLogImpersonation writes when isImpersonating=true", async () => {
    const session = buildSession({
      effectiveTenantId: asTenantID("tenant-target"),
      isImpersonating: true,
    });
    const id = await maybeLogImpersonation(env.DB, session, { action: "settings.update" });
    expect(id).not.toBeNull();
  });
});
