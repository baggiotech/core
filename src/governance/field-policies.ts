/**
 * Field-Level Masking & Governance Policies
 *
 * Aplica políticas de mascaramento de campos sensíveis com base no Role do usuário
 * (ex: PII, dados financeiros, credenciais, salários, CPF/SSN).
 */
import type { Role } from "../types/index.js";

export type MaskingStrategy =
  | 'redact'
  | 'partial'
  | 'null'
  | 'hash'
  | ((value: unknown) => unknown);

export interface FieldPolicy {
  /**
   * Nome do campo ou caminho relativo (ex: 'salary', 'phone', 'metadata.ssn')
   */
  field: string;
  /**
   * Roles autorizadas a visualizar o campo sem mascaramento (ex: ['admin', 'owner'])
   */
  allowedRoles: (Role | string)[];
  /**
   * Estratégia de mascaramento aplicada se o usuário não possuir role permitida.
   * Padrão: 'redact' ('***')
   */
  mask?: MaskingStrategy | string;
}

export type FieldPolicyConfig =
  | FieldPolicy
  | (Role | string)[]
  | { allowedRoles: (Role | string)[]; mask?: MaskingStrategy | string };

export type FieldPolicies = Record<string, FieldPolicyConfig> | FieldPolicy[];

/**
 * Aplica máscara em um valor de acordo com a estratégia definida
 */
export function applyMaskValue(value: unknown, maskStrategy?: MaskingStrategy | string): unknown {
  if (value === null || value === undefined) return value;

  if (typeof maskStrategy === 'function') {
    return maskStrategy(value);
  }

  if (maskStrategy === 'null') {
    return null;
  }

  if (maskStrategy === 'partial') {
    const str = String(value);
    if (str.includes('@')) {
      const parts = str.split('@');
      const name = parts[0] ?? '';
      const domain = parts.slice(1).join('@');
      const firstChar = name[0] ?? '';
      const lastChar = name[name.length - 1] ?? '';
      const visibleName = name.length > 2 ? `${firstChar}***${lastChar}` : '***';
      return `${visibleName}@${domain}`;
    }
    if (str.length <= 4) {
      return '***';
    }
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  }

  if (maskStrategy === 'hash') {
    return `[HASH:${String(value).length}B]`;
  }

  if (typeof maskStrategy === 'string' && maskStrategy !== 'redact') {
    return maskStrategy;
  }

  return '***';
}

/**
 * Normaliza as políticas de campos em uma lista padronizada de FieldPolicy
 */
export function normalizeFieldPolicies(policies: FieldPolicies | null | undefined): FieldPolicy[] {
  if (!policies) return [];
  if (Array.isArray(policies)) return policies;

  const result: FieldPolicy[] = [];
  for (const [key, val] of Object.entries(policies)) {
    if (Array.isArray(val)) {
      result.push({
        field: key,
        allowedRoles: val,
        mask: 'redact',
      });
    } else if (typeof val === 'object' && val !== null) {
      const p = val as Partial<FieldPolicy>;
      result.push({
        field: p.field ?? key,
        allowedRoles: p.allowedRoles ?? [],
        mask: p.mask ?? 'redact',
      });
    }
  }
  return result;
}

/**
 * Mascara campos sensíveis de um registro ou lista de registros com base no Role do usuário.
 * 
 * @param data Objeto ou Array de objetos contendo os dados
 * @param userRole Role do usuário executando a consulta (ex: 'admin', 'editor', 'viewer')
 * @param fieldPolicies Dicionário ou Lista de políticas de mascaramento
 * @returns Objeto ou lista de objetos com os campos sensíveis mascarados
 */
export function maskSensitiveFields<T>(
  data: T,
  userRole?: Role | string | null,
  fieldPolicies?: FieldPolicies | null,
): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (!fieldPolicies) {
    return data;
  }

  const normalizedPolicies = normalizeFieldPolicies(fieldPolicies);
  if (normalizedPolicies.length === 0) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveFields(item, userRole, normalizedPolicies)) as unknown as T;
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result: Record<string, any> = { ...(data as Record<string, any>) };

  for (const policy of normalizedPolicies) {
    const isAllowed = userRole != null && (
      policy.allowedRoles.includes(userRole) ||
      policy.allowedRoles.includes('*') ||
      (userRole === 'admin' && policy.allowedRoles.includes('admin')) ||
      userRole === 'superadmin' ||
      userRole === 'owner'
    );

    if (isAllowed) {
      continue;
    }

    if (policy.field.includes('.')) {
      const parts = policy.field.split('.');
      let current: any = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (p && current && typeof current === 'object' && p in current) {
          current[p] = { ...current[p] };
          current = current[p];
        } else {
          current = null;
          break;
        }
      }
      const lastKey = parts[parts.length - 1];
      if (lastKey && current && typeof current === 'object' && lastKey in current) {
        current[lastKey] = applyMaskValue(
          current[lastKey],
          policy.mask,
        );
      }
    } else {
      if (policy.field in result) {
        result[policy.field] = applyMaskValue(result[policy.field], policy.mask);
      }
    }
  }

  return result as T;
}
