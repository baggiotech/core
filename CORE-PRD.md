# PRD: @baggio/core

O `@baggio/core` é o **Kernel de Governança** do ecossistema baggio.tech. Ele não é um app, mas a biblioteca fundamental que garante que o Basalt, Burnite, Graphite e Core operem sob as mesmas regras de isolamento, segurança e monetização.

---

## 🎯 Objetivo

Centralizar a lógica de **Multitenancy**, **Governança de Planos** e **Persistência Blindada** para reduzir o tempo de lançamento (TTM) de novos SaaS e garantir que a infraestrutura Cloudflare seja utilizada com custo marginal zero.

---

## 👥 User Stories (Dev Context)

* **Como desenvolvedor**, quero que o Core identifique automaticamente o `tenant_id` via hostname para que eu não precise filtrar o banco manualmente em cada query.
* **Como gestor**, quero definir limites de uso (quotas) em um único lugar para que o upgrade de plano reflita em todos os produtos instantaneamente.
* **Como arquiteto**, quero adapters de persistência que impeçam o vazamento de dados entre clientes (Zero Infecção).

---

## 🛠 Requisitos Funcionais (RF)

### RF01: Identificação & Isolamento (Multitenancy)

* **Contexto Global:** O Core deve extrair e injetar o `tenant_id` em cada ciclo de requisição (Middleware).
* **Isolation Guard:** Bloquear qualquer operação de escrita/leitura que não contenha um identificador de tenant válido.

### RF02: Governança de Planos (Feature Gating)

* **Engine de Quotas:** Sistema para validar se um tenant pode executar uma ação (ex: `core.can(tenant).create('project')`).
* **Tiering:** Suporte nativo aos tiers: Solo, Start, Growth, Agency, Business e Pro.

### RF03: Persistência Abstrata (Adapters)

* **D1 Client:** Wrapper sobre o D1 que injeta automaticamente `WHERE tenant_id = ?` em queries preparadas.
* **KV/R2 Bridge:** Gerenciamento de chaves no KV e prefixos no R2 baseados no tenant para evitar colisões.

### RF04: Identity Bridge (Core)

* **Auth Integration:** Interface única para validação de JWTs emitidos pelo **Core**.
* **RBAC (Role-Based Access Control):** Gestão de níveis de acesso (Admin, Editor, Viewer) padronizada.

### RF05: White-label Engine (Theming)

* **Dynamic Config:** Recuperação de cores e assets (logos) via Cloudflare KV.
* **CSS Variable Injector:** Utilitário para mapear configurações do banco em variáveis CSS para Tailwind v4.

---

## ⚙️ Requisitos Não-Funcionais (RNF)

| Requisito | Especificação Técnica |
| --- | --- |
| **Performance** | Latência de resolução de tenant < 10ms (via Edge Caching/KV). |
| **Zero-Dependency** | Dependência mínima de libs externas para evitar *bloat* nos Workers. |
| **Segurança** | Sanitização obrigatória de inputs antes de qualquer log ou persistência. |
| **Portabilidade** | Módulos de segurança compatíveis com WebAssembly (para CLI em Rust). |

---

## 📐 Especificação Técnica

### Schema Base (D1)

O Core governa as tabelas de infraestrutura que os outros apps consomem.

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL,
  partner_id TEXT, -- Suporte para Revendedores White-label
  custom_domain TEXT UNIQUE,
  theme_config TEXT, -- JSON com cores/logos
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

```

### Camada de Cache (KV)

As configurações de rota e tema são espelhadas no KV para evitar hits constantes no D1.

* **Key:** `tenant:host:{hostname}`
* **Value:** `{ tenant_id, plan, theme_vars }`

---

## 💡 Dicas de Elite para Implementação

* **Imutabilidade:** Trate o objeto de contexto do tenant como imutável durante o ciclo da requisição.
* **Graceful Degradation:** Se o KV falhar, o Core deve buscar no D1 e auto-reparar o cache silenciosamente.
* **Type Safety:** Use *Branded Types* no TypeScript para garantir que um `TenantID` não seja confundido com um `UserID`.

---

> **Status do Documento:** v1.0 - Aprovado para Desenvolvimento.
> **Próximo Passo:** Implementação do Middleware de Identidade e Adapters de D1.

**Deseja que eu gere o código inicial do `governance/limits.ts` para começar a validar os planos do Burnite e Basalt?**