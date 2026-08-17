export const TRIGGER_EVENTS = [
  { id: 'crm.lead_stage_changed', label: 'CRM: Estágio do Lead Alterado (ex: Fechado, Proposta, Negociação)', module: 'crm' },
  { id: 'crm.lead_created', label: 'CRM: Novo Lead Inbound Captado (Site/LP/WhatsApp)', module: 'crm' },
  { id: 'members.member_created', label: 'Membros: Nova Conta / Membro Cadastrado', module: 'root' },
  { id: 'finance.invoice_paid', label: 'Financeiro: Pagamento Confirmado (Asaas/Graphite)', module: 'finance' },
  { id: 'finance.invoice_overdue', label: 'Financeiro: Fatura Vencida / Inadimplência', module: 'finance' },
  { id: 'cms.form_submitted', label: 'CMS: Formulário de Landing Page Enviado', module: 'cms' },
  { id: 'contract.signed', label: 'Contratos: Contrato Assinado Digitalmente', module: 'root' },
  { id: 'manual.trigger', label: 'Manual: Disparo Sob Demanda / Webhook', module: 'root' },
] as const;

export type TriggerEventType = typeof TRIGGER_EVENTS[number]['id'];

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'in'
  | 'exists';

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface ConditionGroup {
  logical: 'AND' | 'OR';
  rules: (ConditionRule | ConditionGroup)[];
}

export type AutomationActionType =
  | 'provision_tenant'
  | 'create_member'
  | 'generate_otp'
  | 'notify_whatsapp'
  | 'notify_email'
  | 'webhook_dispatch'
  | 'finance_income'
  | 'update_tenant_status'
  | 'update_bitmask';

export interface ProvisionTenantAction {
  type: 'provision_tenant';
  config: {
    tenantSlugField?: string;
    nameField?: string;
    allowedDomain?: string;
    modules?: string[];
  };
}

export interface CreateMemberAction {
  type: 'create_member';
  config: {
    nameField?: string;
    emailField?: string;
    role?: 'admin' | 'editor' | 'viewer';
    modules?: string[];
  };
}

export interface GenerateOtpAction {
  type: 'generate_otp';
  config: {
    emailField?: string;
    sendChannel?: 'whatsapp' | 'email' | 'none';
  };
}

export interface NotifyWhatsappAction {
  type: 'notify_whatsapp';
  config: {
    phoneField?: string;
    messageTemplate: string;
    randomDelaySeconds?: number;
  };
}

export interface NotifyEmailAction {
  type: 'notify_email';
  config: {
    emailField?: string;
    subject: string;
    bodyTemplate: string;
  };
}

export interface WebhookDispatchAction {
  type: 'webhook_dispatch';
  config: {
    url: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
  };
}

export interface FinanceIncomeAction {
  type: 'finance_income';
  config: {
    amountField?: string;
    description?: string;
  };
}

export interface UpdateTenantStatusAction {
  type: 'update_tenant_status';
  config: {
    tenantSlugField?: string;
    targetStatus: 'active' | 'suspended' | 'trial' | 'cancelled';
  };
}

export interface UpdateBitmaskAction {
  type: 'update_bitmask';
  config: {
    tenantSlugField?: string;
    addModules?: string[];
    removeModules?: string[];
  };
}

export type AutomationAction =
  | ProvisionTenantAction
  | CreateMemberAction
  | GenerateOtpAction
  | NotifyWhatsappAction
  | NotifyEmailAction
  | WebhookDispatchAction
  | FinanceIncomeAction
  | UpdateTenantStatusAction
  | UpdateBitmaskAction;

export interface WorkspaceAutomation {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_event: string;
  conditions: ConditionGroup;
  actions: AutomationAction[];
  status: 'active' | 'paused';
  execution_stats?: {
    total: number;
    success: number;
    failed: number;
    last_executed_at: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Avaliador de Árvore de Condições (AST Engine O(N))
 * Interpreta recursivamente regras booleanas no Edge Worker
 */
export function evaluateConditionAST(
  payload: Record<string, any>,
  groupOrRule: ConditionGroup | ConditionRule
): boolean {
  if (!groupOrRule) return true;

  // Caso seja uma única regra
  if ('field' in groupOrRule && 'operator' in groupOrRule) {
    const rule = groupOrRule as ConditionRule;
    const value = getNestedValue(payload, rule.field);

    switch (rule.operator) {
      case 'equals':
        return String(value) === String(rule.value);
      case 'not_equals':
        return String(value) !== String(rule.value);
      case 'greater_than':
        return Number(value) > Number(rule.value);
      case 'less_than':
        return Number(value) < Number(rule.value);
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes(String(rule.value).toLowerCase());
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(value);
      case 'exists':
        return value !== undefined && value !== null && value !== '';
      default:
        return false;
    }
  }

  // Caso seja um grupo com operador lógico AND / OR
  const group = groupOrRule as ConditionGroup;
  if (!group.rules || group.rules.length === 0) return true;

  if (group.logical === 'OR') {
    return group.rules.some(r => evaluateConditionAST(payload, r));
  } else {
    return group.rules.every(r => evaluateConditionAST(payload, r));
  }
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[k];
  }
  return current;
}

/**
 * Idempotency Key Generator
 * Garante que webhooks duplicados não re-executem a mesma automação
 */
export function generateIdempotencyKey(
  triggerEvent: string,
  resourceId: string,
  bucketSeconds: number = 60
): string {
  const timeBucket = Math.floor(Date.now() / 1000 / bucketSeconds);
  return `idem:${triggerEvent}:${resourceId}:${timeBucket}`;
}
