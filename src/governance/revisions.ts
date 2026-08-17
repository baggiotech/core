/**
 * Content Revisions (Time Travel / Rollback) & Audit History
 *
 * Contratos de governança e auditoria de alterações de registros no Workspace.
 */

export type RevisionOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';

export interface WorkspaceRevision {
  id: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  old_data: string;
  new_data: string;
  user_id: string | null;
  user_email: string | null;
  operation: string;
  created_at: string;
}

export interface CreateRevisionParams {
  id?: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  old_data: string | Record<string, unknown>;
  new_data: string | Record<string, unknown>;
  user_id?: string | null;
  user_email?: string | null;
  operation?: RevisionOperation | string;
}

/**
 * Utilitário para formatar e normalizar dados de revisão para persistência SQL
 */
export function formatRevisionPayload(params: CreateRevisionParams): {
  id: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  operation: string;
  old_data: string;
  new_data: string;
  user_id: string | null;
  user_email: string | null;
} {
  return {
    id: params.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    tenant_id: params.tenant_id,
    table_name: params.table_name,
    record_id: params.record_id,
    operation: params.operation || 'UPDATE',
    old_data: typeof params.old_data === 'string' ? params.old_data : JSON.stringify(params.old_data),
    new_data: typeof params.new_data === 'string' ? params.new_data : JSON.stringify(params.new_data),
    user_id: params.user_id ?? null,
    user_email: params.user_email ?? null,
  };
}
