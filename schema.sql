-- @baggio/core — Schema Base & CMS Polimórfico (Cloudflare D1)
-- Governa as tabelas de infraestrutura e conteúdo dinâmico consumidas pelo Workspace e Web

-- 1. Tabela de Tenants (Multitenancy Hermético)
CREATE TABLE IF NOT EXISTS tenants (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  plan_id         TEXT NOT NULL DEFAULT 'growth',
  partner_id      TEXT,
  custom_domain   TEXT UNIQUE,
  allowed_domains TEXT, -- JSON Array contendo domínios autorizados para CORS/Origin
  theme_config    TEXT, -- JSON contendo variáveis de marca / CSS (:root)
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled')),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. Tabela Core do CMS Polimórfico (Zero Infecção / JSON Payload)
CREATE TABLE IF NOT EXISTS cms_blocks (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  page_slug      TEXT NOT NULL,
  section_key    TEXT NOT NULL,
  allowed_fields TEXT NOT NULL, -- JSON Schema com os tipos de campos permitidos
  data           TEXT NOT NULL, -- JSON Payload com os dados editados pelo usuário
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cms_blocks_tenant_page ON cms_blocks(tenant_id, page_slug);
CREATE INDEX IF NOT EXISTS idx_cms_blocks_lookup      ON cms_blocks(tenant_id, page_slug, section_key);

-- 3. Auditoria de Planos (Histórico de Upgrades/Downgrades)
CREATE TABLE IF NOT EXISTS plan_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  from_plan   TEXT,
  to_plan     TEXT NOT NULL,
  reason      TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plan_events_tenant ON plan_events(tenant_id);

