import { d as TenantID } from './index-CdIZiX7c.cjs';
import { D as D1DatabaseBinding } from './context-DQ2cq12F.cjs';

type D1Value = string | number | boolean | null;
declare class TenantedDB {
    private readonly db;
    private readonly tenantId;
    constructor(db: D1DatabaseBinding, tenantId: TenantID);
    query<T = Record<string, unknown>>(sql: string, params?: D1Value[]): Promise<T[]>;
    queryOne<T = Record<string, unknown>>(sql: string, params?: D1Value[]): Promise<T | null>;
    insert(sql: string, params?: D1Value[]): Promise<number | null>;
    mutate(sql: string, params?: D1Value[]): Promise<number>;
    private assertHasTenantFilter;
}
declare function createTenantedDB(db: D1DatabaseBinding, tenantId: TenantID): TenantedDB;

export { TenantedDB as T, createTenantedDB as c };
