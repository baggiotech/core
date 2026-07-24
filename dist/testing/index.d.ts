import { T as TenantedDB } from '../d1-CTE5NYF7.js';
import { D as D1DatabaseBinding, K as KVNamespaceBinding } from '../context-Bf66k4V3.js';
import { b as Plan, c as TenantContext, U as UserClaims, R as Role, d as TenantID } from '../index-CdIZiX7c.js';

declare const TEST_JWT_SECRET = "test-secret-baggio-core-2025";
interface CreateTestTenantOptions {
    id?: string;
    name?: string;
    slug?: string;
    plan?: Plan;
    status?: TenantContext["status"];
    customDomain?: string | null;
}
declare function createTestTenant(db: D1DatabaseBinding, kv: KVNamespaceBinding, options?: CreateTestTenantOptions): Promise<TenantContext>;
interface MockAuthResult {
    token: string;
    claims: UserClaims;
}
declare function mockAuthContext(tenant: TenantContext, options?: {
    role?: Role;
    secret?: string;
}): Promise<MockAuthResult>;
declare function testTenantedDB(db: D1DatabaseBinding, tenantId: TenantID): TenantedDB;
declare function resetTestDB(db: D1DatabaseBinding): Promise<void>;

export { type CreateTestTenantOptions, type MockAuthResult, TEST_JWT_SECRET, createTestTenant, mockAuthContext, resetTestDB, testTenantedDB };
