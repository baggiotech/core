import type { TenantID } from "../types/index.js";
import { CoreError } from "../types/index.js";
import type { D1DatabaseBinding } from "../identity/context.js";

// Parâmetros aceitos pelo D1
type D1Value = string | number | boolean | null;

interface QueryResult<T> {
  results: T[];
  meta: { changes: number; last_row_id: number | null };
}

// Cliente D1 tenanted — injeta tenant_id automaticamente em toda operação
export class TenantedDB {
  constructor(
    private readonly db: D1DatabaseBinding,
    private readonly tenantId: TenantID,
  ) {}

  // SELECT com tenant_id sempre injetado como último parâmetro
  // O SQL deve conter "tenant_id = ?" ou equivalente
  async query<T = Record<string, unknown>>(
    sql: string,
    params: D1Value[] = [],
  ): Promise<T[]> {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await (stmt as unknown as { all<T>(): Promise<{ results: T[] }> }).all<T>();
    return result.results;
  }

  // SELECT que retorna um único registro
  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: D1Value[] = [],
  ): Promise<T | null> {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    return stmt.first<T>();
  }

  // INSERT — espera que tenant_id esteja na query como último placeholder
  async insert(sql: string, params: D1Value[] = []): Promise<number | null> {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await (stmt as unknown as { run(): Promise<QueryResult<never>> }).run();
    return result.meta.last_row_id;
  }

  // UPDATE / DELETE — garante tenant_id no WHERE
  async mutate(sql: string, params: D1Value[] = []): Promise<number> {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await (stmt as unknown as { run(): Promise<QueryResult<never>> }).run();
    return result.meta.changes;
  }

  // Garante que a query nunca opere sem filtro de tenant.
  // Usa word-boundary para evitar falso-positivo em nomes de tabela como "tenant_id_logs".
  private assertHasTenantFilter(sql: string): void {
    if (!/\btenant_id\b/i.test(sql)) {
      throw new CoreError(
        "ISOLATION_VIOLATION",
        `Query is missing tenant_id filter. SQL: ${sql.slice(0, 80)}...`,
      );
    }
  }
}

export function createTenantedDB(db: D1DatabaseBinding, tenantId: TenantID): TenantedDB {
  return new TenantedDB(db, tenantId);
}
