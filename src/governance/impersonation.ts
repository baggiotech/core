import { CoreError } from "../types/index";

// ─── IMPERSONATION GATE (Core Auth PRD v2.7 §3.4) ────────────────────────────
// O token de suporte gerado pelo /admin/impersonate carrega a claim estrita
// `is_impersonated: true`. Este módulo intercepta essa claim e barra acessos
// laterais a dados de faturamento, infraestrutura central e comandos de
// deleção dentro do Baggio Workspace Hub.

// Prefixos de ação bloqueados para sessões personificadas
const BLOCKED_ACTION_PREFIXES: readonly string[] = [
  "billing.", // dados de faturamento (assinaturas, checkout, gateways)
  "infra.", // infraestrutura central (bindings, domínios, chaves)
  "tenant.config.", // configuração estrutural do tenant
];

// Sufixos de ação bloqueados (comandos de deleção em qualquer recurso)
const BLOCKED_ACTION_SUFFIXES: readonly string[] = [".delete", ".destroy", ".wipe"];

export interface ImpersonationAware {
  isImpersonating: boolean;
}

// Retorna true se a ação é permitida para uma sessão personificada.
export function isActionAllowedUnderImpersonation(action: string): boolean {
  const normalized = action.toLowerCase();
  if (BLOCKED_ACTION_PREFIXES.some((p) => normalized.startsWith(p))) return false;
  if (BLOCKED_ACTION_SUFFIXES.some((s) => normalized.endsWith(s))) return false;
  return true;
}

// Lança IMPERSONATION_BLOCKED se a sessão for personificada e a ação for lateral.
// Sessões normais passam sem custo.
export function assertImpersonationSafe(
  session: ImpersonationAware,
  action: string,
): void {
  if (!session.isImpersonating) return;
  if (isActionAllowedUnderImpersonation(action)) return;
  throw new CoreError(
    "IMPERSONATION_BLOCKED",
    `Action '${action}' is blocked during impersonation sessions (Core PRD v2.7 §3.4)`,
  );
}
