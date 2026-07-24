// src/theme/injector.ts
var DEFAULT_THEME = {
  "--color-primary": "#8C48A1",
  "--color-bg": "#161616",
  "--color-text": "#F5F5F5",
  "--color-surface": "#1E1E1E",
  "--color-border": "#2A2A2A",
  "--font-main": "Satoshi, sans-serif"
};
function buildCssVariables(config) {
  const vars = { ...DEFAULT_THEME };
  if (!config) return vars;
  if (config.primaryColor) vars["--color-primary"] = config.primaryColor;
  if (config.bgColor) vars["--color-bg"] = config.bgColor;
  if (config.textColor) vars["--color-text"] = config.textColor;
  if (config.fontMain) vars["--font-main"] = config.fontMain;
  return vars;
}
function serializeCssVars(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join("\n");
}
async function getThemeVariables(tenant, kv) {
  const cacheKey = `tenant:theme:${tenant.id}`;
  const cached = await kv.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const vars = buildCssVariables(tenant.themeConfig);
  await kv.put(cacheKey, JSON.stringify(vars), { expirationTtl: 600 });
  return vars;
}
async function invalidateThemeCache(tenantId, kv) {
  await kv.put(`tenant:theme:${tenantId}`, "", { expirationTtl: 1 });
}
export {
  buildCssVariables,
  getThemeVariables,
  invalidateThemeCache,
  serializeCssVars
};
//# sourceMappingURL=index.js.map