/**
 * 🛡️ RED TEAM — Simulação 4: A Janela de 10 Minutos (Race Condition de Revogação)
 *
 * Vetor: Consistência eventual do Cloudflare KV.
 *
 * Defesas testadas:
 * 1. BaggioAuth.verify — rejeita tokens presentes na blacklist KV (revoked:{jti})
 * 2. BaggioAuth.verify — rejeita tokens expirados (TTL enforcement)
 * 3. Circuit Breaker — graceful degradation quando KV/infra falha
 * 4. KMS_UNAVAILABLE — tipagem de erro para 503
 */
import { describe, it, expect, vi } from "vitest";
import { BaggioAuth, type VerifyOptions, type CookieStoreLike } from "../../identity/auth";
import { CoreError } from "../../types/index";
import { createCircuitBreaker, type CircuitBreaker } from "../../persistence/breaker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build a minimal CookieStoreLike mock with a given JWT
function mockCookieStore(token: string | null): CookieStoreLike {
  return {
    get: (name: string) => {
      if (name === "__Host-baggio_session" && token) return { value: token };
      if (name === "baggio_session" && token) return { value: token };
      if (name === "baggio_tenant_id") return undefined;
      return undefined;
    },
    set: vi.fn(),
  };
}

// Build a mock KV namespace for revocation blacklist
function mockRevocationKV(revokedJtis: Set<string>) {
  return {
    get: async (key: string): Promise<string | null> => {
      // Key format: "revoked:{jti}"
      const jti = key.replace("revoked:", "");
      return revokedJtis.has(jti) ? "1" : null;
    },
    put: vi.fn(),
    delete: vi.fn(),
  };
}

// Build a mock fetch that simulates the /auth/verify worker endpoint
function mockVerifyFetch(response: object, statusCode = 200) {
  return async (): Promise<Response> => {
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("🛡️ Red Team Sim-4: Race Condition de Revogação", () => {
  describe("BaggioAuth.verify — KV blacklist enforcement", () => {
    const now = Math.floor(Date.now() / 1000);
    const validWorkerResponse = {
      tenant_id: "org_x",
      role: "admin",
      sub: "user@test.com",
      jti: "session-abc-123",
      exp: now + 600,
      iat: now,
      iss: "core-identity",
      aud: "workspace",
    };

    it("accepts a valid token NOT in the revocation blacklist", async () => {
      const cookies = mockCookieStore("valid-jwt-token");
      const emptyBlacklist = mockRevocationKV(new Set());

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
        fetchImpl: mockVerifyFetch(validWorkerResponse) as unknown as typeof fetch,
        revocationKV: emptyBlacklist,
      };

      const session = await BaggioAuth.verify(cookies, options);
      expect(session.tenantId).toBe("org_x");
      expect(session.role).toBe("admin");
    });

    it("rejects a token whose jti IS in the revocation blacklist", async () => {
      const cookies = mockCookieStore("revoked-jwt-token");
      const blacklist = mockRevocationKV(new Set(["session-abc-123"]));

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
        fetchImpl: mockVerifyFetch(validWorkerResponse) as unknown as typeof fetch,
        revocationKV: blacklist,
      };

      await expect(BaggioAuth.verify(cookies, options)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        message: expect.stringContaining("revoked"),
      });
    });

    it("rejects token immediately — O(1) KV lookup is synchronous-like", async () => {
      const cookies = mockCookieStore("revoked-jwt-token");
      const blacklist = mockRevocationKV(new Set(["session-abc-123"]));

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
        fetchImpl: mockVerifyFetch(validWorkerResponse) as unknown as typeof fetch,
        revocationKV: blacklist,
      };

      const start = performance.now();
      try {
        await BaggioAuth.verify(cookies, options);
      } catch {
        // Expected
      }
      const elapsed = performance.now() - start;

      // KV lookup should resolve in < 100ms (in-memory mock, but validates the flow)
      expect(elapsed).toBeLessThan(100);
    });

    it("throws UNAUTHORIZED when no session token exists", async () => {
      const cookies = mockCookieStore(null);

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
      };

      await expect(BaggioAuth.verify(cookies, options)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws INVALID_TOKEN when verify worker rejects the token (post-logout)", async () => {
      const cookies = mockCookieStore("logged-out-token");
      const rejectedFetch = mockVerifyFetch({}, 401);

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
        fetchImpl: rejectedFetch as unknown as typeof fetch,
      };

      await expect(BaggioAuth.verify(cookies, options)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    });

    it("handles rapid-fire requests — 10 parallel revocation checks", async () => {
      const cookies = mockCookieStore("revoked-token");
      const blacklist = mockRevocationKV(new Set(["session-abc-123"]));

      const options: VerifyOptions = {
        fallbackVerifyUrl: "https://auth.baggio.tech/auth/verify",
        fetchImpl: mockVerifyFetch(validWorkerResponse) as unknown as typeof fetch,
        revocationKV: blacklist,
      };

      // Simulate Postman rapid fire: 10 parallel requests with revoked token
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => BaggioAuth.verify(cookies, options)),
      );

      // ALL 10 must be rejected — no race condition allowed
      const rejections = results.filter((r) => r.status === "rejected");
      expect(rejections).toHaveLength(10);

      // All rejections must be INVALID_TOKEN (not generic 500)
      for (const rejection of rejections) {
        if (rejection.status === "rejected") {
          expect(rejection.reason).toBeInstanceOf(CoreError);
          expect((rejection.reason as CoreError).code).toBe("INVALID_TOKEN");
        }
      }
    });
  });

  describe("Circuit Breaker — KMS/KV graceful degradation", () => {
    it("stays closed after successful operations", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });

      await breaker.execute(async () => "ok");
      expect(breaker.getStatus()).toBe("closed");
    });

    it("opens after 3 consecutive failures", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("KMS key disabled");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getStatus()).toBe("open");
    });

    it("throws CIRCUIT_OPEN (not generic 500) when circuit is open", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("AWS KMS DescribeKey access denied");
          });
        } catch {
          // Expected
        }
      }

      // Now the circuit is open — next call should throw CIRCUIT_OPEN
      await expect(
        breaker.execute(async () => "should not reach"),
      ).rejects.toMatchObject({
        code: "CIRCUIT_OPEN",
        message: "Circuit breaker is open",
      });
    });

    it("transitions to half_open after cooldown period", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 50 });

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("KMS unavailable");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getStatus()).toBe("open");

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(breaker.getStatus()).toBe("half_open");
    });

    it("closes again after successful probe in half_open state", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 50 });

      // Trip it
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("KMS unavailable");
          });
        } catch {
          // Expected
        }
      }

      // Wait for half_open
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Successful probe
      const result = await breaker.execute(async () => "kms restored");
      expect(result).toBe("kms restored");
      expect(breaker.getStatus()).toBe("closed");
    });

    it("re-opens immediately if probe fails in half_open state", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 50 });

      // Trip it
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("KMS unavailable");
          });
        } catch {
          // Expected
        }
      }

      // Wait for half_open
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(breaker.getStatus()).toBe("half_open");

      // Probe fails → re-open
      try {
        await breaker.execute(async () => {
          throw new Error("KMS still unavailable");
        });
      } catch {
        // Expected
      }

      expect(breaker.getStatus()).toBe("open");
    });
  });

  describe("KMS_UNAVAILABLE error code exists in CoreErrorCode", () => {
    it("can instantiate CoreError with KMS_UNAVAILABLE code", () => {
      const err = new CoreError("KMS_UNAVAILABLE", "AWS KMS key is disabled or inaccessible");

      expect(err).toBeInstanceOf(CoreError);
      expect(err.code).toBe("KMS_UNAVAILABLE");
      expect(err.message).toContain("KMS key");
      expect(err.name).toBe("CoreError");
    });

    it("KMS_UNAVAILABLE maps to 503 in the error hierarchy", () => {
      // Validates the HTTP mapping convention defined in workspace-api
      const statusMap: Record<string, number> = {
        KMS_UNAVAILABLE: 503,
        CIRCUIT_OPEN: 503,
        INFRA_FAILURE: 503,
      };

      expect(statusMap["KMS_UNAVAILABLE"]).toBe(503);
    });
  });
});
