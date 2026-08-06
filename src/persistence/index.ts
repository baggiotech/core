export { createTenantedDB, TenantedDB } from "./d1.js";
export { createTenantedKV, TenantedKV } from "./kv.js";
export { createTenantedR2, TenantedR2 } from "./r2.js";
export type { R2BucketBinding, R2Object } from "./r2.js";

// Circuit Breaker singleton (compartilhado entre apps do monorepo)
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./breaker.js";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./breaker.js";

// REST adapters — usar TenantedKV fora de um Worker
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./cloudflare-rest.js";
export type { CloudflareKvRestConfig } from "./cloudflare-rest.js";
