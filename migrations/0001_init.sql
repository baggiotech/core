-- @baggio/core — Migration 0001: Schema inicial
-- Governa as tabelas de infraestrutura consumidas por todos os SaaS

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan_id       TEXT NOT NULL DEFAULT 'solo',
  partner_id    TEXT,
  custom_domain TEXT UNIQUE,
  theme_config  TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled')),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

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
