export { T as TenantedDB, c as createTenantedDB } from '../d1-B3kVO_hy.cjs';
import { d as TenantID } from '../index-CdIZiX7c.cjs';
import { K as KVNamespaceBinding } from '../context-DQ2cq12F.cjs';

declare class TenantedKV {
    private readonly kv;
    private readonly tenantId;
    constructor(kv: KVNamespaceBinding, tenantId: TenantID);
    private key;
    get<T = string>(suffix: string): Promise<T | null>;
    set<T>(suffix: string, value: T, ttlSeconds?: number): Promise<void>;
    delete(suffix: string): Promise<void>;
    fullKey(suffix: string): string;
}
declare function createTenantedKV(kv: KVNamespaceBinding, tenantId: TenantID): TenantedKV;

interface R2BucketBinding {
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
    delete(key: string): Promise<void>;
    list(options?: {
        prefix?: string;
        limit?: number;
    }): Promise<{
        objects: R2Object[];
    }>;
}
interface R2Object {
    key: string;
    size: number;
    etag: string;
    body?: ReadableStream;
    arrayBuffer?(): Promise<ArrayBuffer>;
    text?(): Promise<string>;
}
declare class TenantedR2 {
    private readonly bucket;
    private readonly tenantId;
    constructor(bucket: R2BucketBinding, tenantId: TenantID);
    private path;
    get(suffix: string): Promise<R2Object | null>;
    put(suffix: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
    delete(suffix: string): Promise<void>;
    list(subfolder?: string, limit?: number): Promise<R2Object[]>;
    fullPath(suffix: string): string;
}
declare function createTenantedR2(bucket: R2BucketBinding, tenantId: TenantID): TenantedR2;

type BreakerStatus = "closed" | "open" | "half_open";
interface CircuitBreakerOpts {
    failureThreshold: number;
    cooldownMs: number;
}
interface CircuitBreaker {
    execute<T>(fn: () => Promise<T>): Promise<T>;
    getStatus(): BreakerStatus;
    reset(): void;
}
declare const DEFAULT_BREAKER_OPTS: CircuitBreakerOpts;
declare function createCircuitBreaker(opts?: CircuitBreakerOpts): CircuitBreaker;
declare function getBreaker(key: string, opts?: CircuitBreakerOpts): CircuitBreaker;
declare function resetBreakerRegistry(): void;

interface CloudflareKvRestConfig {
    accountId: string;
    namespaceId: string;
    apiToken: string;
    baseUrl?: string;
}
declare function createCloudflareKvRest(cfg: CloudflareKvRestConfig): KVNamespaceBinding;
declare function cloudflareKvRestFromEnv(env: Record<string, string | undefined>): KVNamespaceBinding;
declare function hasCloudflareKvCredentials(env: Record<string, string | undefined>): boolean;

export { type BreakerStatus, type CircuitBreaker, type CircuitBreakerOpts, type CloudflareKvRestConfig, DEFAULT_BREAKER_OPTS, type R2BucketBinding, type R2Object, TenantedKV, TenantedR2, cloudflareKvRestFromEnv, createCircuitBreaker, createCloudflareKvRest, createTenantedKV, createTenantedR2, getBreaker, hasCloudflareKvCredentials, resetBreakerRegistry };
