// Motor de Permissões via Bitmask (BigInt) O(1) Memory check
export const Modules = {
  ROOT: 1n << 60n, // God Mode / Cliente Zero (baggio.tech admin)
  CMS: 1n << 0n,
  CRM: 1n << 1n,
  FINANCE: 1n << 2n,
  FACILITY: 1n << 3n,
  COMMERCE: 1n << 4n,
} as const;

/**
 * Verifica se a bitmask de um usuário possui a permissão requerida.
 * Se o usuário for ROOT (God Mode), sempre retornará true.
 */
export function hasPermission(userBitmask: bigint, moduleKey: bigint): boolean {
  if ((userBitmask & Modules.ROOT) === Modules.ROOT) return true;
  return (userBitmask & moduleKey) === moduleKey;
}

/**
 * Constrói uma nova bitmask ativando múltiplos módulos
 */
export function buildBitmask(modules: bigint[]): bigint {
  return modules.reduce((acc, curr) => acc | curr, 0n);
}
