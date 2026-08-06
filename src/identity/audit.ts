import type { TenantID } from "../types/index.js";
import type { D1DatabaseBinding } from "./context.js";
import { generateId } from "../security/sanitizer.js";
import type { VerifiedSession } from "./auth.js";

// Registro de uma ação executada sob Impersonation Gate.
// Grava direto no D1 do consumer; o caller é responsável por passar o binding.
// Não usamos TenantedDB aqui porque audit é meta-tabela: queremos INSERTs
// transparentes mesmo se o tenant_id atual estiver impersonado.

export interface ImpersonationAuditEntry {
  action: string;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

// Insere uma linha em impersonation_audit. Idempotente por id (UUID).
// Retorna o id gerado para correlação em logs externos.
export async function logImpersonationEvent(
  db: D1DatabaseBinding,
  session: VerifiedSession,
  entry: ImpersonationAuditEntry,
): Promise<string> {
  const id = generateId();
  const actorEmail = session.claims.sub;
  const actorRole = session.claims.role;
  const targetTenantId: TenantID | null =
    session.effectiveTenantId !== session.tenantId ? session.effectiveTenantId : null;
  const targetUser = session.claims.act_as ?? null;
  const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

  await db
    .prepare(
      `INSERT INTO impersonation_audit
        (id, tenant_id, actor_email, actor_role, target_tenant_id, target_user, action, details, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      session.tenantId,
      actorEmail,
      actorRole,
      targetTenantId,
      targetUser,
      entry.action,
      detailsJson,
      entry.ip ?? null,
      entry.userAgent ?? null,
    )
    .first();

  return id;
}

// Variante condicional — só persiste se session.isImpersonating === true.
// Útil para chamadas em hot-path onde não queremos branchar no caller.
export async function maybeLogImpersonation(
  db: D1DatabaseBinding,
  session: VerifiedSession,
  entry: ImpersonationAuditEntry,
): Promise<string | null> {
  if (!session.isImpersonating) return null;
  return logImpersonationEvent(db, session, entry);
}
