import type { ThemeConfig, TenantContext } from "../types/index";
import type { KVNamespaceBinding } from "../identity/context";

// Mapeamento padrão — fallback para o tema baggio.tech
const DEFAULT_THEME: Record<string, string> = {
  "--color-primary": "#8C48A1",
  "--color-bg": "#161616",
  "--color-text": "#F5F5F5",
  "--color-surface": "#1E1E1E",
  "--color-border": "#2A2A2A",
  "--font-main": "Satoshi, sans-serif",
};

// Converte ThemeConfig em variáveis CSS prontas para injeção no Tailwind v4
export function buildCssVariables(config: ThemeConfig | null): Record<string, string> {
  const vars: Record<string, string> = { ...DEFAULT_THEME };

  if (!config) return vars;

  if (config.primaryColor) vars["--color-primary"] = config.primaryColor;
  if (config.bgColor) vars["--color-bg"] = config.bgColor;
  if (config.textColor) vars["--color-text"] = config.textColor;
  if (config.fontMain) vars["--font-main"] = config.fontMain;

  return vars;
}

// Serializa variáveis CSS para injeção em <style> ou HTTP header
export function serializeCssVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n");
}

// Recupera tema do KV ou retorna o padrão (para uso em Workers/middleware)
export async function getThemeVariables(
  tenant: TenantContext,
  kv: KVNamespaceBinding,
): Promise<Record<string, string>> {
  const cacheKey = `tenant:theme:${tenant.id}`;
  const cached = await kv.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as Record<string, string>;
  }

  const vars = buildCssVariables(tenant.themeConfig);

  // Cache por 10 minutos — temas mudam raramente
  await kv.put(cacheKey, JSON.stringify(vars), { expirationTtl: 600 });

  return vars;
}

// Invalida o cache de tema de um tenant (chamar após atualizar theme_config)
export async function invalidateThemeCache(
  tenantId: string,
  kv: KVNamespaceBinding,
): Promise<void> {
  await kv.put(`tenant:theme:${tenantId}`, "", { expirationTtl: 1 });
}
