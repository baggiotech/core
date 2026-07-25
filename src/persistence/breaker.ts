import { CoreError } from "../types/index";

// Circuit Breaker singleton — compartilhado em todos os apps do monorepo.
// Substitui implementações locais para garantir cooldown coerente entre Server Actions.

export type BreakerStatus = "closed" | "open" | "half_open";

export interface CircuitBreakerOpts {
  failureThreshold: number;
  cooldownMs: number;
}

export interface CircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getStatus(): BreakerStatus;
  reset(): void;
}

export const DEFAULT_BREAKER_OPTS: CircuitBreakerOpts = {
  failureThreshold: 3,
  cooldownMs: 20_000,
};

export function createCircuitBreaker(opts: CircuitBreakerOpts = DEFAULT_BREAKER_OPTS): CircuitBreaker {
  let status: BreakerStatus = "closed";
  let failures = 0;
  let openedAt = 0;

  function getStatus(): BreakerStatus {
    if (status === "open") {
      const elapsed = Date.now() - openedAt;
      if (elapsed >= opts.cooldownMs) {
        status = "half_open";
      }
    }
    return status;
  }

  function reset(): void {
    status = "closed";
    failures = 0;
    openedAt = 0;
  }

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const current = getStatus();

    if (current === "open") {
      throw new CoreError("CIRCUIT_OPEN", "Circuit breaker is open");
    }

    try {
      const result = await fn();
      failures = 0;
      status = "closed";
      openedAt = 0;
      return result;
    } catch (error) {
      failures += 1;
      if (status === "half_open" || failures >= opts.failureThreshold) {
        status = "open";
        openedAt = Date.now();
      }
      throw error;
    }
  }

  return { execute, getStatus, reset };
}

// Module-level registry: same key → same breaker instance, sobrevive cross-request
// dentro de um Worker/Node process. Garante cooldown compartilhado conforme PRD.
const registry = new Map<string, CircuitBreaker>();

export function getBreaker(
  key: string,
  opts: CircuitBreakerOpts = DEFAULT_BREAKER_OPTS,
): CircuitBreaker {
  let breaker = registry.get(key);
  if (!breaker) {
    breaker = createCircuitBreaker(opts);
    registry.set(key, breaker);
  }
  return breaker;
}

export function resetBreakerRegistry(): void {
  registry.clear();
}
