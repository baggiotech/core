// Retorna a data atual como string ISO (para campos created_at/updated_at)
export function nowISO(): string {
  return new Date().toISOString();
}

// Paginação simples para queries D1
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function toPaginationSQL(params: PaginationParams): { limit: number; offset: number } {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

// Type-safe Object.entries com valor definido
export function entries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

// Garante que um valor não é null/undefined, lançando erro descritivo
export function assertDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected '${label}' to be defined, got ${String(value)}`);
  }
  return value;
}

// Retorna apenas as chaves com valor não-nulo de um objeto
export function compactObject<T extends object>(
  obj: T,
): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<{ [K in keyof T]: NonNullable<T[K]> }>;
}
