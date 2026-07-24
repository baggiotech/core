-- Migration 0004: tabela impersonation_audit
-- Registra toda ação executada com a flag isImpersonating ativa (gate global
-- do BaggioAuth). Usada como contra-prova forense quando um superadmin opera
-- em nome de outro tenant ou um admin opera em nome de outro usuário.

CREATE TABLE IF NOT EXISTS impersonation_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    -- ator real (admin/superadmin original). NULL = service principal.
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    -- alvo da impersonação. tenant_id-level → target_tenant_id; user-level → target_user.
    target_tenant_id TEXT,
    target_user TEXT,
    -- ação executada no console (e.g. "applications.create", "webhooks.delete").
    action TEXT NOT NULL,
    -- detalhes opcionais (JSON serializado: corpo, params, ip, user-agent).
    details TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_impersonation_audit_tenant ON impersonation_audit(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_actor ON impersonation_audit(actor_email, created_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_target_user ON impersonation_audit(target_user);
