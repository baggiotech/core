import { d as TenantID } from './index-CdIZiX7c.js';
import { D as D1DatabaseBinding } from './context-Bf66k4V3.js';

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
