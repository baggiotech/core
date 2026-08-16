/**
 * Motor de Permissões & Módulos via Bitmask (BigInt)
 *
 * Elimina o limite de 32 bits do motor V8 JavaScript/Workers.
 * Executa checagens, adições e revogações de acesso em O(1) puro.
 * Compatível com SQLite TEXT (D1), JWT Edge Claims e Rust Wasm (u128).
 */

export const WorkspaceModules = {
  NONE: 0n,
  CMS: 1n << 0n,         // 1n  (CMS / Site Polimórfico)
  CRM: 1n << 1n,         // 2n  (CRM & Vendas)
  FINANCE: 1n << 2n,     // 4n  (Graphite Financeiro)
  FACILITY: 1n << 3n,    // 8n  (Cursos & LMS)
  COMMERCE: 1n << 4n,    // 16n (E-commerce / Loja)
  IMOB: 1n << 5n,        // 32n (Nicho Imobiliário)
  HEALTH: 1n << 6n,      // 64n (Nicho Clínicas / Saúde)
  LAW: 1n << 7n,         // 128n (Nicho Jurídico)
  GYM: 1n << 32n,        // 4294967296n (Nicho Fitness - Alocado além do limite de 32 bits)
  CUSTOM_ADDON: 1n << 48n, // 281474976710656n
  ROOT: 1n << 60n,       // God Mode / Administrador da Plataforma (baggio.tech)
} as const;

export const Modules = WorkspaceModules;
export type ModuleKey = keyof typeof WorkspaceModules;

/**
 * Verifica se a bitmask possui um ou mais módulos autorizados.
 * Se o usuário for ROOT (God Mode), sempre retornará true.
 */
export function hasPermission(userBitmask: bigint, moduleBit: bigint): boolean {
  if ((userBitmask & WorkspaceModules.ROOT) === WorkspaceModules.ROOT) return true;
  return (userBitmask & moduleBit) === moduleBit;
}

export function hasModule(bitmask: bigint, moduleBit: bigint): boolean {
  return hasPermission(bitmask, moduleBit);
}

/**
 * Concede/Adiciona um módulo ao bitmask existente em O(1).
 */
export function addModule(bitmask: bigint, moduleBit: bigint): bigint {
  return bitmask | moduleBit;
}

/**
 * Revoga/Remove um módulo do bitmask existente em O(1).
 */
export function removeModule(bitmask: bigint, moduleBit: bigint): bigint {
  return bitmask & ~moduleBit;
}

/**
 * Constrói uma nova bitmask agregando múltiplos módulos.
 */
export function buildBitmask(modules: bigint[]): bigint {
  return modules.reduce((acc, curr) => acc | curr, 0n);
}

/**
 * Serializa o BigInt para string segura contra overflow no D1 SQLite / JWT.
 */
export function serializeBitmask(bitmask: bigint): string {
  return bitmask.toString();
}

/**
 * Desserializa um valor (string, number ou BigInt) em BigInt nativo.
 */
export function deserializeBitmask(val: string | number | bigint | null | undefined): bigint {
  if (val === null || val === undefined) return 0n;
  if (typeof val === 'bigint') return val;
  try {
    return BigInt(val);
  } catch {
    return 0n;
  }
}

