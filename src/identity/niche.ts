/**
 * CRM Dictionaries — Polimorfismo de Domínio
 *
 * Este módulo provê a capacidade de adaptar toda a interface e esquema
 * de dados do CRM de acordo com o nicho do tenant.
 */

export type NicheType = 'standard' | 'real_estate' | 'health_fitness';

export interface CrmDictionary {
  readonly niche: NicheType;
  readonly labelLead: string;       
  readonly labelLeadPlural: string; 
  readonly labelProject: string;    
  readonly stages: {
    readonly new: string;           
    readonly contacted: string;     
    readonly proposal: string;      
    readonly won: string;           
    readonly lost: string;          
  };
  readonly customFields: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly type: 'text' | 'number' | 'date' | 'select';
  }>;
}

export const CRM_DICTIONARIES: Record<NicheType, CrmDictionary> = {
  standard: {
    niche: 'standard',
    labelLead: 'Lead',
    labelLeadPlural: 'Leads',
    labelProject: 'Projeto',
    stages: {
      new: 'Novo',
      contacted: 'Em Contato',
      proposal: 'Proposta',
      won: 'Fechado',
      lost: 'Perdido',
    },
    customFields: []
  },
  real_estate: {
    niche: 'real_estate',
    labelLead: 'Comprador/Inquilino',
    labelLeadPlural: 'Interessados',
    labelProject: 'Imóvel Desejado',
    stages: {
      new: 'Novo Contato',
      contacted: 'Visita Agendada',
      proposal: 'Em Negociação',
      won: 'Vendido/Alugado',
      lost: 'Desistiu',
    },
    customFields: [
      { key: 'budget', label: 'Orçamento/Renda', type: 'number' },
      { key: 'neighborhood', label: 'Bairros de Interesse', type: 'text' }
    ]
  },
  health_fitness: {
    niche: 'health_fitness',
    labelLead: 'Paciente/Aluno',
    labelLeadPlural: 'Pacientes',
    labelProject: 'Objetivo Clínico',
    stages: {
      new: 'Novo Contato',
      contacted: 'Triagem/Agendado',
      proposal: 'Em Avaliação',
      won: 'Matriculado/Ativo',
      lost: 'Evadiu/Sem Retorno',
    },
    customFields: [
      { key: 'health_plan', label: 'Convênio Médico', type: 'text' },
      { key: 'preferred_time', label: 'Horário Preferencial', type: 'text' }
    ]
  }
};

/**
 * Resolve o dicionário ativo com base no nicho configurado no Tenant.
 */
export function getDictionary(niche?: string | null): CrmDictionary {
  if (niche && niche in CRM_DICTIONARIES) {
    return CRM_DICTIONARIES[niche as NicheType];
  }
  return CRM_DICTIONARIES.standard;
}
