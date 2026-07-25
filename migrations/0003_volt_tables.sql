-- Core Identity Service: tabelas específicas do serviço de autenticação
-- Estas tabelas residem no D1 do Core (separado do D1 compartilhado do baggio-core)

-- 1. Usuários por tenant (identities)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, suspended, deleted
    email_verified INTEGER NOT NULL DEFAULT 0,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret_enc TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, email)
);

-- 2. OAuth Clients (applications) por tenant
CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    client_secret_enc TEXT NOT NULL,
    redirect_uris TEXT NOT NULL, -- JSON array
    allowed_scopes TEXT NOT NULL DEFAULT '["openid","profile","email"]',
    grant_types TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Sessões ativas (fallback para DOs; permite revogação em batch)
CREATE TABLE IF NOT EXISTS sessions (
    jti TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    iat INTEGER NOT NULL,
    exp INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);

-- 4. Passkeys / WebAuthn credentials
CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key_cbor TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Providers sociais (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS social_providers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- google, github, microsoft
    client_id TEXT NOT NULL,
    client_secret_enc TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, provider)
);

-- 6. RBAC customizado por tenant
CREATE TABLE IF NOT EXISTS tenant_roles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array de strings
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_tenant ON oauth_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_user ON sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(exp);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);
