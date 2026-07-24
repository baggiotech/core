Para estruturar o **`@baggio/core`** com foco em multitenancy e suporte futuro a white-label, você deve tratá-lo como o **Single Point of Truth** (Ponto Único de Verdade) para governança e infraestrutura.

Abaixo está a arquitetura proposta para o monorepo (pnpm/Turborepo) utilizando Hono.js e Cloudflare.

### 🏛️ Estrutura de Diretórios (Functional-First)

```text
packages/core/
├── src/
│   ├── identity/          # Integração com Volt (Auth/Identity)
│   ├── governance/        # Planos, Limites e Feature Gating
│   ├── persistence/       # Adapters para D1, KV e R2
│   ├── security/          # Sanitização e Criptografia (Burnite Protocol)
│   ├── theme/             # Lógica de White-label e CSS Variables
│   ├── types/             # Definições globais e DTOs
│   └── utils/             # Helpers compartilhados
├── index.ts               # Exportação pública da lib
└── package.json

```

---

### 🔑 1. Identity & Multitenancy (Volt Integration)

O Core deve interceptar o `hostname` ou `header` para identificar o Tenant.

```typescript
// packages/core/src/identity/context.ts
export interface TenantContext {
  id: string;
  partnerId?: string; // Para White-label
  plan: 'solo' | 'agency' | 'pro';
  config: Record<string, any>;
}

// Middleware para Hono (Usado em todos os seus Workers)
export const multitenancyMiddleware = () => async (c, next) => {
  const host = c.req.header('host');
  const tenant = await resolveTenantFromCache(host); // Busca no KV
  
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
  
  c.set('tenant', tenant);
  await next();
};

```

---

### 🛡️ 2. Governance & Feature Gating

A lógica de "quem pode o quê" reside aqui. O Basalt, o Burnite e o Graphite apenas perguntam ao Core.

```typescript
// packages/core/src/governance/limits.ts
export const checkLimit = (tenant: TenantContext, feature: string, currentUsage: number) => {
  const quotas = {
    solo: { projects: 3, storage: 1024 },
    agency: { projects: 100, storage: 10240 },
  };

  return currentUsage < quotas[tenant.plan][feature];
};

```

---

### 🎨 3. Theme & White-label (Performance Layer)

Centraliza a injeção de variáveis CSS para o Tailwind v4, consumindo do Cloudflare KV para evitar latência.

```typescript
// packages/core/src/theme/injector.ts
export const getThemeVariables = (themeConfig: any) => {
  return {
    '--primary': themeConfig.primaryColor || '#8C48A1',
    '--bg': themeConfig.bgColor || '#161616',
    '--font-main': 'Satoshi, sans-serif',
  };
};

```

---

### 🔄 4. Persistence Adapters (Design Blindado)

Em vez de cada app instanciar o D1 diretamente, o Core provê o cliente já "tenanted" (blindado).

```typescript
// packages/core/src/persistence/db.ts
export const getTenantedDB = (d1: D1Database, tenantId: string) => {
  return {
    query: (sql: string, params: any[]) => 
      d1.prepare(sql).bind(...params, tenantId).all(),
    // Garante que o WHERE tenant_id = ? esteja sempre presente
  };
};

```

---

### 💡 Dicas de Elite para o `@baggio/core`

1. **Zero-Dependency Core:** Tente não importar bibliotecas pesadas aqui. O Core deve ser puro TypeScript para não inflar o bundle dos Workers.
2. **Versioning:** Como o Core é usado por todos os projetos, use versões semânticas (SemVer). Uma quebra no Core derruba o Basalt e o Burnite simultaneamente.
3. **Tauri Compatibility:** Garanta que o módulo `security/sanitizer` possa ser compilado para WebAssembly ou usado no Node, para que a CLI do Burnite (Local-first) use a mesma lógica de segurança do servidor.

**Você pretende unificar a tabela de usuários de todos os SaaS no Volt ou cada SaaS terá sua própria tabela de usuários vinculada ao tenant?**resposta: cada saas tera sua tabela