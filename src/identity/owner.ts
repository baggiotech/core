/**
 * Owner Resolution — Fonte única da verdade para emails com privilégio ROOT.
 *
 * Centraliza a lista de MASTER_EMAILS que antes estava duplicada em:
 * - workspace-api/src/routes/auth.ts
 * - workspace-ui/src/lib/auth.tsx
 * - workspace-ui/src/app/login/page.tsx
 */
import type { Role, Plan, TenantID } from '../types/index.js';
import { asTenantID } from '../types/index.js';
import { Modules, buildBitmask } from '../governance/permissions.js';

/**
 * Emails com acesso Owner/ROOT ao Workspace.
 * Esta é a ÚNICA fonte de verdade — não duplique em outros pacotes.
 */
const MASTER_EMAILS: readonly string[] = [
  'yuri.baggio1709@gmail.com',
  'yuri@baggio.tech',
];

/**
 * Verifica se um email pertence ao owner do workspace.
 */
export function isOwnerEmail(email: string): boolean {
  return MASTER_EMAILS.includes(email.toLowerCase().trim());
}

/** Configurações de sessão resolvidas para owners vs. usuários comuns. */
export interface OwnerResolution {
  readonly isOwner: boolean;
  readonly role: Role;
  readonly plan: Plan;
  readonly tenantId: TenantID;
  readonly displayName: string;
  readonly avatarInitial: string;
  readonly permissionsBitmask: bigint;
  readonly orgs: readonly string[];
}

/**
 * Resolve configurações de sessão com base no email.
 * Owner recebe ROOT + todos os módulos; usuário comum recebe só CMS.
 */
export function resolveOwner(email: string): OwnerResolution {
  const normalized = email.toLowerCase().trim();
  const isOwner = isOwnerEmail(normalized);

  if (isOwner) {
    return {
      isOwner: true,
      role: 'admin',
      plan: 'business',
      tenantId: asTenantID('baggio-tech'),
      displayName: 'Yuri Baggio',
      avatarInitial: 'YB',
      permissionsBitmask: buildBitmask([
        Modules.ROOT,
        Modules.CMS,
        Modules.CRM,
        Modules.FINANCE,
        Modules.FACILITY,
        Modules.COMMERCE,
      ]),
      orgs: ['workspace:baggio-tech'],
    };
  }

  const nameParts = (normalized.split('@')[0] ?? normalized).replace(/[._]/g, ' ');
  const displayName = nameParts.charAt(0).toUpperCase() + nameParts.slice(1);

  return {
    isOwner: false,
    role: 'viewer',
    plan: 'solo',
    tenantId: asTenantID('default'),
    displayName,
    avatarInitial: displayName.charAt(0).toUpperCase(),
    permissionsBitmask: buildBitmask([]), // Começa sem nenhum módulo, apenas acesso à loja
    orgs: ['workspace:default'],
  };
}
