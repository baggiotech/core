/**
 * @file presets.ts
 * @description Contratos de tipagem para Views Modulares e Smart Filters (Directus-Style).
 */

export type DataViewLayout = 'table' | 'kanban' | 'calendar' | 'map';

export type FilterOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';

export interface DataViewFilter {
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface DataViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DataViewColumn {
  key: string;
  label: string;
  visible?: boolean;
  width?: string;
  format?: 'text' | 'date' | 'currency' | 'badge' | 'avatar';
}

export interface DataViewPreset {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  collection_key: string;
  name: string;
  icon?: string | null;
  layout: DataViewLayout;
  filters_json?: string;
  filters?: DataViewFilter[];
  sort_json?: string;
  sort?: DataViewSort;
  columns_json?: string;
  columns?: DataViewColumn[];
  created_at: string;
  updated_at: string;
}
