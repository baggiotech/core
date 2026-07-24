import { c as TenantContext, d as TenantID } from './index-CdIZiX7c.cjs';

interface KVNamespaceBinding {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: {
        expirationTtl?: number;
    }): Promise<void>;
    delete(key: string): Promise<void>;
}
interface D1DatabaseBinding {
    prepare(query: string): D1PreparedStatement;
}
interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
}
declare function resolveTenant(hostname: string, kv: KVNamespaceBinding, db: D1DatabaseBinding): Promise<TenantContext>;
declare function invalidateTenantCache(hostname: string, kv: KVNamespaceBinding): Promise<void>;
declare function resolveTenantById(tenantId: TenantID, db: D1DatabaseBinding): Promise<TenantContext>;

export { type D1DatabaseBinding as D, type KVNamespaceBinding as K, resolveTenantById as a, type D1PreparedStatement as b, invalidateTenantCache as i, resolveTenant as r };
