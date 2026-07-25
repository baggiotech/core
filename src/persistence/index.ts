export { createTenantedDB, TenantedDB } from "./d1";
export { createTenantedKV, TenantedKV } from "./kv";
export { createTenantedR2, TenantedR2 } from "./r2";
export type { R2BucketBinding, R2Object } from "./r2";

// Circuit Breaker singleton (compartilhado entre apps do monorepo)
export {
  createCircuitBreaker,
  DEFAULT_BREAKER_OPTS,
  getBreaker,
  resetBreakerRegistry,
} from "./breaker";
export type { BreakerStatus, CircuitBreaker, CircuitBreakerOpts } from "./breaker";

// REST adapters — usar TenantedKV fora de um Worker
export {
  cloudflareKvRestFromEnv,
  createCloudflareKvRest,
  hasCloudflareKvCredentials,
} from "./cloudflare-rest";
export type { CloudflareKvRestConfig } from "./cloudflare-rest";
