-- @baggio/core — Schema base (D1)
-- Governa as tabelas de infraestrutura consumidas por todos os SaaS

CREATE TABLE IF NOT EXISTS tenants (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  plan_id      TEXT NOT NULL DEFAULT 'solo',
  partner_id   TEXT,                          -- Suporte para revendedores white-label
  custom_domain TEXT UNIQUE,
  theme_config TEXT,                           -- JSON com cores/logos (ThemeConfig)
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled')),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES tenants(id)
);

-- Índices de lookup críticos para latência < 10ms
CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Auditoria de planos (histórico de upgrades/downgrades)
CREATE TABLE IF NOT EXISTS plan_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  from_plan   TEXT,
  to_plan     TEXT NOT NULL,
  reason      TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_events_tenant ON plan_events(tenant_id);
