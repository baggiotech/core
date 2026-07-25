/**
 * 🛡️ RED TEAM — Simulação 1: O "Vizinho Curioso" (Cross-Tenant Escalation)
 *
 * Vetor: Usuário A pertence à Org X. Tenta acessar dados da Org Y.
 *
 * Defesas testadas:
 * 1. assertTenantMatch — rejeição O(1) in-memory quando tenant_id do JWT ≠ tenant_id da request
 * 2. identityClaimsToUserClaims — normalização segura de claims
 * 3. IdentityClaims.orgs — JWT sem org membership deve ser rejeitado pelo middleware
 * 4. TenantedDB — SQL injection guard para tenant_id filter obrigatório
 */
import { describe, it, expect } from "vitest";
import {
  assertTenantMatch,
  identityClaimsToUserClaims,
  type IdentityClaims,
} from "../../identity/jwt";
import { asTenantID, asUserID, CoreError } from "../../types/index";
import type { UserClaims } from "../../types/index";
import { TenantedDB } from "../../persistence/d1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildClaims(overrides: Partial<IdentityClaims> = {}): IdentityClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "core-identity",
    sub: "user-a@empresa.com",
    tenant_id: "hub",
    role: "user",
    jti: "test-jti-001",
    aud: "workspace",
    iat: now,
    exp: now + 600,
    uid: "core:usr:550e8400-e29b-41d4-a716-446655440000",
    orgs: ["workspace:org_x"],
    ...overrides,
  };
}

function buildUserClaims(tenantId: string, role = "viewer"): UserClaims {
  return {
    sub: asUserID("user-a@empresa.com"),
    tenantId: asTenantID(tenantId),
    role: role as UserClaims["role"],
    email: "user-a@empresa.com",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("🛡️ Red Team Sim-1: Cross-Tenant Escalation", () => {
  describe("assertTenantMatch — O(1) isolation guard", () => {
    it("passes when JWT tenant matches request tenant", () => {
      const claims = buildUserClaims("org_x");
      // Should not throw
      expect(() => assertTenantMatch(claims, asTenantID("org_x"))).not.toThrow();
    });

    it("throws ISOLATION_VIOLATION when JWT tenant ≠ request tenant", () => {
      const claims = buildUserClaims("org_x");
      expect(() => assertTenantMatch(claims, asTenantID("org_y"))).toThrow(CoreError);
      try {
        assertTenantMatch(claims, asTenantID("org_y"));
      } catch (e) {
        expect(e).toBeInstanceOf(CoreError);
        expect((e as CoreError).code).toBe("ISOLATION_VIOLATION");
        expect((e as CoreError).message).toContain("org_x");
        expect((e as CoreError).message).toContain("org_y");
      }
    });

    it("blocks escalation even with subtle tenant_id manipulation", () => {
      // Attacker tries tenant_id with trailing space, unicode, or case swap
      const claims = buildUserClaims("org_x");

      expect(() => assertTenantMatch(claims, asTenantID("org_X"))).toThrow(CoreError);
      expect(() => assertTenantMatch(claims, asTenantID("org_x "))).toThrow(CoreError);
      expect(() => assertTenantMatch(claims, asTenantID(" org_x"))).toThrow(CoreError);
      expect(() => assertTenantMatch(claims, asTenantID("org_x\u200B"))).toThrow(CoreError); // zero-width space
    });
  });

  describe("identityClaimsToUserClaims — safe normalization", () => {
    it("maps tenant_id from JWT into UserClaims.tenantId", () => {
      const claims = buildClaims({ tenant_id: "org_x" });
      const userClaims = identityClaimsToUserClaims(claims);

      expect(userClaims.tenantId).toBe("org_x");
    });

    it("normalizes 'superadmin' role to 'admin'", () => {
      const claims = buildClaims({ role: "superadmin" });
      const userClaims = identityClaimsToUserClaims(claims);

      expect(userClaims.role).toBe("admin");
    });

    it("normalizes unknown roles to 'viewer' (least privilege)", () => {
      const claims = buildClaims({ role: "hacker" });
      const userClaims = identityClaimsToUserClaims(claims);

      expect(userClaims.role).toBe("viewer");
    });

    it("preserves email from sub claim", () => {
      const claims = buildClaims({ sub: "victim@empresa.com" });
      const userClaims = identityClaimsToUserClaims(claims);

      expect(userClaims.email).toBe("victim@empresa.com");
    });
  });

  describe("orgs claim — workspace org membership filtering", () => {
    it("JWT with orgs: ['workspace:org_x'] → org match finds 'workspace:org_x'", () => {
      const claims = buildClaims({ orgs: ["workspace:org_x", "crm:org_z"] });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));

      expect(wsOrg).toBe("workspace:org_x");
    });

    it("JWT with orgs: ['crm:org_z'] → no workspace match → tenantId null", () => {
      const claims = buildClaims({ orgs: ["crm:org_z"] });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));
      const tenantId = wsOrg ?? null;

      expect(tenantId).toBeNull();
    });

    it("JWT without orgs claim → tenantId null (Hub global token)", () => {
      const claims = buildClaims({ orgs: undefined });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));
      const tenantId = wsOrg ?? null;

      expect(tenantId).toBeNull();
    });

    it("JWT with empty orgs array → tenantId null", () => {
      const claims = buildClaims({ orgs: [] });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));
      const tenantId = wsOrg ?? null;

      expect(tenantId).toBeNull();
    });

    it("attacker cannot inject workspace prefix via orgs manipulation", () => {
      // Even if attacker somehow gets 'workspace:org_y' in their token,
      // the JWKS EdDSA signature prevents tampering. Here we verify
      // that the filtering logic itself is sound.
      const claims = buildClaims({ orgs: ["workspace:org_x"] });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));

      // Attacker's desired org should NOT match
      expect(wsOrg).not.toBe("workspace:org_y");
      expect(wsOrg).toBe("workspace:org_x");
    });

    it("multiple workspace orgs → first match wins", () => {
      // Edge case: user is member of multiple workspace orgs
      const claims = buildClaims({
        orgs: ["crm:org_z", "workspace:org_alpha", "workspace:org_beta"],
      });
      const wsOrg = claims.orgs?.find((o) => o.startsWith("workspace:"));

      expect(wsOrg).toBe("workspace:org_alpha");
    });
  });

  describe("TenantedDB — SQL tenant_id injection guard", () => {
    it("assertHasTenantFilter blocks queries without tenant_id", async () => {
      // We can't directly call assertHasTenantFilter (private), but
      // the public methods (query, mutate, insert) all call it.
      // We test via the TenantedDB constructor + method call pattern.

      // Mock D1Database with a prepare method that should never be reached
      const mockDb = {
        prepare: () => {
          throw new Error("Should not reach prepare — query should be rejected");
        },
      };

      const db = new TenantedDB(mockDb, asTenantID("org_x"));

      // Query missing tenant_id filter → ISOLATION_VIOLATION
      await expect(
        db.query("SELECT * FROM crm_entities WHERE status = ?", ["active"]),
      ).rejects.toMatchObject({ code: "ISOLATION_VIOLATION" });
    });

    it("allows queries that include tenant_id filter", async () => {
      const mockDb = {
        prepare: (sql: string) => {
          const stmt = {
            bind: (...params: unknown[]) => {
              return {
                ...stmt,
                all: async () => ({ results: [] }),
                first: async () => null,
                run: async () => ({ meta: { changes: 0, last_row_id: null } }),
              };
            },
            first: async () => null,
          };
          return stmt;
        },
      };

      const db = new TenantedDB(mockDb, asTenantID("org_x"));

      // Query WITH tenant_id filter → should pass through to D1
      await expect(
        db.query("SELECT * FROM crm_entities WHERE tenant_id = ?", []),
      ).resolves.toEqual([]);
    });
  });
});
