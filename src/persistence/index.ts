export { createTenantedDB, TenantedDB } from "./d1.ts";
export { createTenantedKV, TenantedKV } from "./kv.ts";
export { createTenantedR2, TenantedR2 } from "./r2.ts";
export type { R2BucketBinding, R2Object } from "./r2.ts";

// Circuit Breaker singleton (compartilhado entre apps do monorepo)
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./breaker.ts";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./breaker.ts";

// REST adapters — usar TenantedKV fora de um Worker
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./cloudflare-rest.ts";
export type { CloudflareKvRestConfig } from "./cloudflare-rest.ts";
