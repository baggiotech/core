import { g as ThemeConfig, c as TenantContext } from '../index-CdIZiX7c.cjs';
import { K as KVNamespaceBinding } from '../context-DQ2cq12F.cjs';

declare function buildCssVariables(config: ThemeConfig | null): Record<string, string>;
declare function serializeCssVars(vars: Record<string, string>): string;
declare function getThemeVariables(tenant: TenantContext, kv: KVNamespaceBinding): Promise<Record<string, string>>;
declare function invalidateThemeCache(tenantId: string, kv: KVNamespaceBinding): Promise<void>;

export { buildCssVariables, getThemeVariables, invalidateThemeCache, serializeCssVars };
