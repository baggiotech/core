// src/types/index.ts
function asTenantID(id) {
  return id;
}
function asUserID(id) {
  return id;
}
function asPartnerID(id) {
  return id;
}
var CoreError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CoreError";
  }
};

// src/security/sanitizer.ts
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "password",
  "senha",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "creditcard",
  "card_number",
  "cvv",
  "cpf",
  "cnpj"
]);
function stripHtml(input) {
  return input.replace(/<[^>]*>/g, "").trim();
}
function escapeSqlForLog(input) {
  return input.replace(/['";\\]/g, "\\$&");
}
function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(
        (v) => v !== null && typeof v === "object" ? sanitizeObject(v) : v
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
function isValidSlug(slug) {
  if (slug.length > 63) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
function isValidHostname(hostname) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(hostname);
}
function truncate(input, maxLength) {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}
function generateId() {
  return crypto.randomUUID();
}

// src/identity/context.ts
async function resolveTenant(hostname, kv, db) {
  if (!isValidHostname(hostname) && !isValidSlug(hostname)) {
    throw new CoreError("ISOLATION_VIOLATION", `Invalid hostname format: ${hostname.slice(0, 40)}`);
  }
  const cacheKey = `tenant:host:${hostname}`;
  const cached = await kv.get(cacheKey);
  if (cached) {
    const entry2 = JSON.parse(cached);
    return cacheEntryToContext(entry2);
  }
  const row = await db.prepare(
    "SELECT id, slug, plan_id, partner_id, theme_config, status FROM tenants WHERE (custom_domain = ? OR slug = ?) AND status != 'cancelled' LIMIT 1"
  ).bind(hostname, hostname).first();
  if (!row) {
    throw new CoreError("TENANT_NOT_FOUND", `Tenant not found for host: ${hostname}`);
  }
  if (row.status === "suspended") {
    throw new CoreError("TENANT_SUSPENDED", `Tenant ${row.slug} is suspended`);
  }
  const themeConfig = row.theme_config ? JSON.parse(row.theme_config) : null;
  const entry = {
    tenantId: asTenantID(row.id),
    plan: row.plan_id,
    themeVars: themeConfig ?? {},
    status: row.status
  };
  await kv.put(cacheKey, JSON.stringify(entry), { expirationTtl: 300 });
  return cacheEntryToContext(entry);
}
function cacheEntryToContext(entry) {
  return Object.freeze({
    id: entry.tenantId,
    slug: "",
    plan: entry.plan,
    partnerId: null,
    themeConfig: null,
    status: entry.status
  });
}
async function invalidateTenantCache(hostname, kv) {
  await kv.delete(`tenant:host:${hostname}`);
}
async function resolveTenantById(tenantId, db) {
  const row = await db.prepare(
    "SELECT id, slug, plan_id, partner_id, theme_config, status FROM tenants WHERE id = ? LIMIT 1"
  ).bind(tenantId).first();
  if (!row) {
    throw new CoreError("TENANT_NOT_FOUND", `Tenant not found: ${tenantId}`);
  }
  return Object.freeze({
    id: asTenantID(row.id),
    slug: row.slug,
    plan: row.plan_id,
    partnerId: row.partner_id,
    themeConfig: row.theme_config ? JSON.parse(row.theme_config) : null,
    status: row.status
  });
}

// src/identity/jwt.ts
function extractBearerToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
function assertTenantMatch(claims, tenantId) {
  if (claims.tenantId !== tenantId) {
    throw new CoreError(
      "ISOLATION_VIOLATION",
      `Token tenant ${claims.tenantId} does not match request tenant ${tenantId}`
    );
  }
}
var ROLE_HIERARCHY = {
  viewer: 0,
  editor: 1,
  admin: 2
};
function hasRole(userRole, requiredRole) {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
function assertRole(userRole, requiredRole) {
  if (!hasRole(userRole, requiredRole)) {
    throw new CoreError(
      "UNAUTHORIZED",
      `Role '${userRole}' is insufficient. Required: '${requiredRole}'`
    );
  }
}
function base64urlToBytes(b64) {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - padded.length % 4) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const buf = new ArrayBuffer(binary.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}
async function verifyTokenEdDSA(token, publicKeyBase64Url) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new CoreError("INVALID_TOKEN", "Malformed JWT: expected 3 parts");
  }
  const [header, payload, sig] = parts;
  const pubKeyBytes = base64urlToBytes(publicKeyBase64Url);
  const key = await crypto.subtle.importKey(
    "raw",
    pubKeyBytes.buffer,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const msgBytes = new TextEncoder().encode(`${header}.${payload}`);
  const message = msgBytes.buffer.slice(msgBytes.byteOffset, msgBytes.byteOffset + msgBytes.byteLength);
  const sigBytes = base64urlToBytes(sig);
  const signature = sigBytes.buffer;
  const valid = await crypto.subtle.verify("Ed25519", key, signature, message);
  if (!valid) {
    throw new CoreError("INVALID_TOKEN", "EdDSA signature verification failed");
  }
  let claims;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      payload.length + (4 - payload.length % 4) % 4,
      "="
    ));
    claims = JSON.parse(decoded);
  } catch {
    throw new CoreError("INVALID_TOKEN", "Failed to decode JWT payload");
  }
  const now = Math.floor(Date.now() / 1e3);
  if (claims.exp < now) {
    throw new CoreError("INVALID_TOKEN", "EdDSA JWT has expired");
  }
  return claims;
}
function normalizeRole(role) {
  if (role === "superadmin") return "admin";
  if (role === "user") return "viewer";
  if (role === "admin" || role === "editor" || role === "viewer") return role;
  return "viewer";
}
function identityClaimsToUserClaims(claims) {
  return {
    sub: asUserID(claims.sub),
    tenantId: asTenantID(claims.tenant_id),
    role: normalizeRole(claims.role),
    email: claims.sub,
    iat: claims.iat,
    exp: claims.exp
  };
}

// src/identity/auth.ts
var BAGGIO_SESSION_COOKIE = "baggio_session";
var VOLT_SESSION_COOKIE = BAGGIO_SESSION_COOKIE;
var VOLT_EFFECTIVE_TENANT_COOKIE = "baggio_tenant_id";
var DEFAULT_SESSION_TTL_SECONDS = 3600;
var DEFAULT_TOKEN_ISSUER = "volt-identity";
var DEFAULT_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: DEFAULT_SESSION_TTL_SECONDS
};
function isSuperadmin(role) {
  return role === "superadmin" || role === "admin";
}
async function verifyViaWorker(token, url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      ...{ cache: "no-store" }
    });
  } catch (e) {
    throw new CoreError(
      "INFRA_FAILURE",
      `Token verify endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!response.ok) {
    throw new CoreError("INVALID_TOKEN", `Worker verify rejected token: ${response.status}`);
  }
  return response.json();
}
var BaggioAuth = class {
  // Persiste o JWT do Volt em cookie httpOnly seguindo as defaults globais.
  static createSession(cookieStore, token, overrides) {
    const options = { ...DEFAULT_SESSION_COOKIE_OPTIONS, ...overrides };
    const cookieName = options.useHostPrefix ? `__Host-${VOLT_SESSION_COOKIE}` : VOLT_SESSION_COOKIE;
    if (options.useHostPrefix) {
      delete options.domain;
    }
    cookieStore.set(cookieName, token, options);
  }
  // Apaga a sessão. Use no logout/erro de verificação.
  static clearSession(cookieStore) {
    if (cookieStore.delete) {
      cookieStore.delete(`__Host-${VOLT_SESSION_COOKIE}`);
      cookieStore.delete(VOLT_SESSION_COOKIE);
      cookieStore.delete(VOLT_EFFECTIVE_TENANT_COOKIE);
      return;
    }
    cookieStore.set(`__Host-${VOLT_SESSION_COOKIE}`, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0, domain: void 0 });
    cookieStore.set(VOLT_SESSION_COOKIE, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0 });
    cookieStore.set(VOLT_EFFECTIVE_TENANT_COOKIE, "", { ...DEFAULT_SESSION_COOKIE_OPTIONS, maxAge: 0 });
  }
  // Verifica o cookie e retorna a sessão tipada.
  // Resolve a impersonação superadmin via baggio_tenant_id.
  static async verify(cookieStore, options) {
    const token = cookieStore.get(`__Host-${VOLT_SESSION_COOKIE}`)?.value || cookieStore.get(VOLT_SESSION_COOKIE)?.value;
    if (!token) {
      throw new CoreError("UNAUTHORIZED", "Missing session token");
    }
    const expectedIssuer = options.expectedIssuer ?? DEFAULT_TOKEN_ISSUER;
    let claims;
    if (options.publicKeyBase64Url) {
      claims = await verifyTokenEdDSA(token, options.publicKeyBase64Url);
      if (claims.iss !== expectedIssuer) {
        throw new CoreError("INVALID_TOKEN", `Invalid token issuer: ${claims.iss}`);
      }
    } else if (options.fallbackVerifyUrl) {
      const fetchImpl = options.fetchImpl ?? fetch;
      const remote = await verifyViaWorker(token, options.fallbackVerifyUrl, fetchImpl);
      if (!remote.tenant_id) {
        throw new CoreError("INVALID_TOKEN", "Worker verify response missing tenant_id");
      }
      claims = {
        iss: remote.iss ?? expectedIssuer,
        sub: remote.sub ?? "",
        tenant_id: remote.tenant_id,
        role: remote.role ?? "viewer",
        jti: remote.jti ?? "",
        aud: remote.aud ?? "",
        iat: remote.iat ?? Math.floor(Date.now() / 1e3),
        exp: remote.exp ?? Math.floor(Date.now() / 1e3) + DEFAULT_SESSION_TTL_SECONDS
      };
    } else {
      throw new CoreError(
        "INVALID_TOKEN",
        "BaggioAuth.verify requires publicKeyBase64Url or fallbackVerifyUrl"
      );
    }
    if (options.revocationKV && claims.jti) {
      const revoked = await options.revocationKV.get(`revoked:${claims.jti}`);
      if (revoked !== null) {
        throw new CoreError("INVALID_TOKEN", "Token has been revoked");
      }
    }
    const userClaims = identityClaimsToUserClaims(claims);
    const tenantId = userClaims.tenantId;
    const effectiveRaw = cookieStore.get(VOLT_EFFECTIVE_TENANT_COOKIE)?.value;
    const effectiveTenantId = effectiveRaw && isSuperadmin(claims.role) ? effectiveRaw : tenantId;
    const isImpersonating = effectiveTenantId !== tenantId || Boolean(claims.act_as) || Boolean(claims.act) || claims.is_impersonated === true;
    return {
      claims,
      userClaims,
      tenantId,
      effectiveTenantId,
      role: claims.role,
      token,
      isImpersonating
    };
  }
};

// src/identity/audit.ts
async function logImpersonationEvent(db, session, entry) {
  const id = generateId();
  const actorEmail = session.claims.sub;
  const actorRole = session.claims.role;
  const targetTenantId = session.effectiveTenantId !== session.tenantId ? session.effectiveTenantId : null;
  const targetUser = session.claims.act_as ?? null;
  const detailsJson = entry.details ? JSON.stringify(entry.details) : null;
  await db.prepare(
    `INSERT INTO impersonation_audit
        (id, tenant_id, actor_email, actor_role, target_tenant_id, target_user, action, details, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    session.tenantId,
    actorEmail,
    actorRole,
    targetTenantId,
    targetUser,
    entry.action,
    detailsJson,
    entry.ip ?? null,
    entry.userAgent ?? null
  ).first();
  return id;
}
async function maybeLogImpersonation(db, session, entry) {
  if (!session.isImpersonating) return null;
  return logImpersonationEvent(db, session, entry);
}

// src/identity/tenant-config.ts
function buildCorruptionId(tenantId, reason) {
  const seed = `${tenantId}:${reason}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
  }
  return `crp_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}
var LEGACY_PLAN_VALUES = ["free", "starter", "pro", "enterprise"];
function normalizeLegacyPlan(raw) {
  if (!raw) return "free";
  if (LEGACY_PLAN_VALUES.includes(raw)) return raw;
  return "free";
}
var PLAN_BRIDGE = {
  free: "solo",
  starter: "start",
  pro: "pro",
  enterprise: "business"
};
function bridgeLegacyPlan(legacy) {
  return PLAN_BRIDGE[legacy];
}
function validateVoltConfig(raw, fallbackTenantId) {
  const resolvedTenantId = raw.tenantId ?? raw.tenant_id ?? raw.id ?? fallbackTenantId;
  const domain = raw.domain ?? raw.customDomain ?? raw.custom_domain ?? `${resolvedTenantId}.volt.id`;
  const appName = raw.branding?.appName ?? raw.brandName ?? raw.brand_name;
  const logoUrl = raw.branding?.logoUrl ?? raw.brandLogoUrl ?? raw.brand_logo_url;
  const primaryColor = raw.branding?.primaryColor ?? raw.brandColor ?? raw.brand_color ?? "#8C48A1";
  const maxFailedAttempts = raw.security?.maxFailedAttempts ?? raw.shieldMaxAttempts ?? raw.shield_max_attempts ?? 5;
  const blockedCountries = raw.security?.blockedCountries ?? raw.blockedCountries ?? raw.blocked_countries ?? [];
  const planSource = raw.plan ?? raw.tier;
  if (typeof domain !== "string" || domain.trim() === "") {
    throw new CoreError("SCHEMA_VIOLATION", "Config missing required field: domain");
  }
  if (typeof appName !== "string" || appName.trim() === "") {
    throw new CoreError("SCHEMA_VIOLATION", "Config missing required field: branding.appName");
  }
  return {
    tenantId: resolvedTenantId,
    domain,
    branding: {
      appName,
      logoUrl,
      primaryColor,
      faviconUrl: raw.branding?.faviconUrl,
      supportEmail: raw.branding?.supportEmail
    },
    features: {
      oauth: raw.features?.oauth ?? false,
      passkeys: raw.features?.passkeys ?? false,
      mfa: raw.features?.mfa ?? false,
      socialProviders: raw.features?.socialProviders ?? false,
      customDomain: raw.features?.customDomain ?? false,
      webhooks: raw.features?.webhooks ?? false,
      compliance: raw.features?.compliance ?? false
    },
    security: {
      mfaRequired: raw.security?.mfaRequired ?? false,
      sessionTimeoutSeconds: raw.security?.sessionTimeoutSeconds ?? 3600,
      maxFailedAttempts,
      geoFencing: raw.security?.geoFencing ?? false,
      blockedCountries
    },
    plan: normalizeLegacyPlan(planSource),
    createdAt: raw.createdAt ?? raw.created_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/governance/plans.ts
var PLAN_QUOTAS = {
  solo: {
    projects: 3,
    members: 1,
    storageGb: 1,
    apiCallsPerMonth: 1e3,
    customDomains: 0,
    whiteLabel: false,
    prioritySupport: false
  },
  start: {
    projects: 10,
    members: 3,
    storageGb: 5,
    apiCallsPerMonth: 1e4,
    customDomains: 1,
    whiteLabel: false,
    prioritySupport: false
  },
  growth: {
    projects: 30,
    members: 10,
    storageGb: 20,
    apiCallsPerMonth: 5e4,
    customDomains: 3,
    whiteLabel: false,
    prioritySupport: false
  },
  agency: {
    projects: 100,
    members: 25,
    storageGb: 100,
    apiCallsPerMonth: 2e5,
    customDomains: 10,
    whiteLabel: true,
    prioritySupport: false
  },
  business: {
    projects: 500,
    members: 100,
    storageGb: 500,
    apiCallsPerMonth: 1e6,
    customDomains: 50,
    whiteLabel: true,
    prioritySupport: true
  },
  pro: {
    projects: Infinity,
    members: Infinity,
    storageGb: Infinity,
    apiCallsPerMonth: Infinity,
    customDomains: Infinity,
    whiteLabel: true,
    prioritySupport: true
  }
};
function getPlanQuotas(plan) {
  return PLAN_QUOTAS[plan];
}
var PLAN_ORDER = ["solo", "start", "growth", "agency", "business", "pro"];
function isPlanAtLeast(current, minimum) {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(minimum);
}

// src/governance/gating.ts
var TenantGate = class {
  constructor(tenant) {
    this.tenant = tenant;
    this.quotas = getPlanQuotas(tenant.plan);
  }
  quotas;
  // Verifica se o tenant pode executar mais uma operação numa quota numérica
  create(resource, currentUsage) {
    const limit = this.quotas[resource];
    return currentUsage < limit;
  }
  // Lança exceção se não puder criar
  assertCreate(resource, currentUsage) {
    if (!this.create(resource, currentUsage)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Quota exceeded for '${resource}' on plan '${this.tenant.plan}'. Limit: ${this.quotas[resource]}, Current: ${currentUsage}`
      );
    }
  }
  // Verifica se uma feature booleana está disponível no plano
  use(feature) {
    return this.quotas[feature];
  }
  // Lança exceção se feature não disponível
  assertUse(feature) {
    if (!this.use(feature)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `Feature '${feature}' is not available on plan '${this.tenant.plan}'`
      );
    }
  }
  // Verifica se o tenant está num plano mínimo
  requiresPlan(minimum) {
    return isPlanAtLeast(this.tenant.plan, minimum);
  }
  assertPlan(minimum) {
    if (!this.requiresPlan(minimum)) {
      throw new CoreError(
        "QUOTA_EXCEEDED",
        `This action requires plan '${minimum}' or higher. Current plan: '${this.tenant.plan}'`
      );
    }
  }
};
function can(tenant) {
  return new TenantGate(tenant);
}

// src/persistence/d1.ts
var TenantedDB = class {
  constructor(db, tenantId) {
    this.db = db;
    this.tenantId = tenantId;
  }
  // SELECT com tenant_id sempre injetado como último parâmetro
  // O SQL deve conter "tenant_id = ?" ou equivalente
  async query(sql, params = []) {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await stmt.all();
    return result.results;
  }
  // SELECT que retorna um único registro
  async queryOne(sql, params = []) {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    return stmt.first();
  }
  // INSERT — espera que tenant_id esteja na query como último placeholder
  async insert(sql, params = []) {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await stmt.run();
    return result.meta.last_row_id;
  }
  // UPDATE / DELETE — garante tenant_id no WHERE
  async mutate(sql, params = []) {
    this.assertHasTenantFilter(sql);
    const stmt = this.db.prepare(sql).bind(...params, this.tenantId);
    const result = await stmt.run();
    return result.meta.changes;
  }
  // Garante que a query nunca opere sem filtro de tenant.
  // Usa word-boundary para evitar falso-positivo em nomes de tabela como "tenant_id_logs".
  assertHasTenantFilter(sql) {
    if (!/\btenant_id\b/i.test(sql)) {
      throw new CoreError(
        "ISOLATION_VIOLATION",
        `Query is missing tenant_id filter. SQL: ${sql.slice(0, 80)}...`
      );
    }
  }
};
function createTenantedDB(db, tenantId) {
  return new TenantedDB(db, tenantId);
}

// src/persistence/kv.ts
var TenantedKV = class {
  constructor(kv, tenantId) {
    this.kv = kv;
    this.tenantId = tenantId;
  }
  key(suffix) {
    return `tenant:${this.tenantId}:${suffix}`;
  }
  async get(suffix) {
    const raw = await this.kv.get(this.key(suffix));
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  async set(suffix, value, ttlSeconds) {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await this.kv.put(this.key(suffix), serialized, {
      expirationTtl: ttlSeconds
    });
  }
  async delete(suffix) {
    await this.kv.put(this.key(suffix), "", { expirationTtl: 1 });
  }
  // Retorna a chave completa (útil para debugging)
  fullKey(suffix) {
    return this.key(suffix);
  }
};
function createTenantedKV(kv, tenantId) {
  return new TenantedKV(kv, tenantId);
}

// src/persistence/r2.ts
var TenantedR2 = class {
  constructor(bucket, tenantId) {
    this.bucket = bucket;
    this.tenantId = tenantId;
  }
  path(suffix) {
    return `${this.tenantId}/${suffix}`;
  }
  async get(suffix) {
    return this.bucket.get(this.path(suffix));
  }
  async put(suffix, value) {
    return this.bucket.put(this.path(suffix), value);
  }
  async delete(suffix) {
    return this.bucket.delete(this.path(suffix));
  }
  async list(subfolder = "", limit = 100) {
    const prefix = this.path(subfolder);
    const result = await this.bucket.list({ prefix, limit });
    return result.objects;
  }
  // Retorna o path completo (útil para gerar URLs públicas)
  fullPath(suffix) {
    return this.path(suffix);
  }
};
function createTenantedR2(bucket, tenantId) {
  return new TenantedR2(bucket, tenantId);
}

// src/persistence/breaker.ts
var DEFAULT_BREAKER_OPTS = {
  failureThreshold: 3,
  cooldownMs: 2e4
};
function createCircuitBreaker(opts = DEFAULT_BREAKER_OPTS) {
  let status = "closed";
  let failures = 0;
  let openedAt = 0;
  function getStatus() {
    if (status === "open") {
      const elapsed = Date.now() - openedAt;
      if (elapsed >= opts.cooldownMs) {
        status = "half_open";
      }
    }
    return status;
  }
  function reset() {
    status = "closed";
    failures = 0;
    openedAt = 0;
  }
  async function execute(fn) {
    const current = getStatus();
    if (current === "open") {
      throw new CoreError("CIRCUIT_OPEN", "Circuit breaker is open");
    }
    try {
      const result = await fn();
      failures = 0;
      status = "closed";
      openedAt = 0;
      return result;
    } catch (error) {
      failures += 1;
      if (status === "half_open" || failures >= opts.failureThreshold) {
        status = "open";
        openedAt = Date.now();
      }
      throw error;
    }
  }
  return { execute, getStatus, reset };
}
var registry = /* @__PURE__ */ new Map();
function getBreaker(key, opts = DEFAULT_BREAKER_OPTS) {
  let breaker = registry.get(key);
  if (!breaker) {
    breaker = createCircuitBreaker(opts);
    registry.set(key, breaker);
  }
  return breaker;
}
function resetBreakerRegistry() {
  registry.clear();
}

// src/persistence/cloudflare-rest.ts
var CloudflareRestKvNamespace = class {
  constructor(cfg) {
    this.cfg = cfg;
    const base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
    this.endpoint = `${base}/accounts/${cfg.accountId}/storage/kv/namespaces/${cfg.namespaceId}`;
  }
  endpoint;
  headers() {
    return { Authorization: `Bearer ${this.cfg.apiToken}` };
  }
  async get(key) {
    const url = `${this.endpoint}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, { headers: this.headers(), ...{ cache: "no-store" } });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST get failed for key "${key}": ${response.status}`
      );
    }
    return response.text();
  }
  async put(key, value, options) {
    const params = new URLSearchParams();
    if (options?.expirationTtl) {
      params.set("expiration_ttl", String(options.expirationTtl));
    }
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const url = `${this.endpoint}/values/${encodeURIComponent(key)}${qs}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "text/plain" },
      body: value,
      ...{ cache: "no-store" }
    });
    if (!response.ok) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST put failed for key "${key}": ${response.status}`
      );
    }
  }
  async delete(key) {
    const url = `${this.endpoint}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
      ...{ cache: "no-store" }
    });
    if (!response.ok && response.status !== 404) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST delete failed for key "${key}": ${response.status}`
      );
    }
  }
};
function createCloudflareKvRest(cfg) {
  return new CloudflareRestKvNamespace(cfg);
}
function cloudflareKvRestFromEnv(env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = env.CLOUDFLARE_KV_NAMESPACE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !namespaceId || !apiToken) {
    throw new CoreError(
      "INFRA_FAILURE",
      "Missing Cloudflare KV REST credentials (CLOUDFLARE_ACCOUNT_ID/KV_NAMESPACE_ID/API_TOKEN)"
    );
  }
  return createCloudflareKvRest({ accountId, namespaceId, apiToken });
}
function hasCloudflareKvCredentials(env) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_KV_NAMESPACE_ID && env.CLOUDFLARE_API_TOKEN);
}

// src/forensics/index.ts
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new CoreError("INVALID_TOKEN", `Hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
function base64UrlToBytes(b64u) {
  const normalized = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
async function verifyEd25519Signature(payload, signatureHex, publicKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    publicKey.buffer.slice(publicKey.byteOffset, publicKey.byteOffset + publicKey.byteLength),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const sig = hexToBytes(signatureHex);
  const sigBuf = sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength);
  const payloadBuf = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  );
  return crypto.subtle.verify("Ed25519", key, sigBuf, payloadBuf);
}
async function fetchTenantJwksKey(tenantId, jwksBaseUrl, options) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${jwksBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(tenantId)}/jwks.json`;
  let response;
  try {
    response = await fetchImpl(url, { ...{ cache: "no-store" } });
  } catch (e) {
    throw new CoreError(
      "INFRA_FAILURE",
      `JWKS fetch failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!response.ok) {
    throw new CoreError("INFRA_FAILURE", `Tenant JWKS endpoint returned ${response.status}`);
  }
  const jwks = await response.json();
  const key = jwks.keys?.find((item) => item.kty === "OKP" && item.crv === "Ed25519" && item.x);
  if (!key?.x) {
    throw new CoreError("INVALID_TOKEN", "Tenant JWKS missing Ed25519 verification key");
  }
  return base64UrlToBytes(key.x);
}
function mapToForensicRows(records, integrity, signatureId, validationError) {
  return records.map((record, index) => ({
    id: String(record.id ?? `unknown-${index}`),
    timestamp: new Date(Number(record.timestamp ?? Date.now())).toISOString(),
    actor: String(record.user ?? "unknown"),
    action: String(record.event ?? "unknown.event"),
    target: String(record.details ?? "No details"),
    ip: typeof record.ip === "string" ? record.ip : void 0,
    integrity,
    signatureId,
    validationError
  }));
}
function summarizeForensicIntegrity(rows, criticalMessage) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.integrity === "valid") acc.valid += 1;
      if (row.integrity === "invalid") acc.invalid += 1;
      if (row.integrity === "unknown") acc.unknown += 1;
      return acc;
    },
    { total: 0, valid: 0, invalid: 0, unknown: 0 }
  );
  return {
    ...summary,
    hasCriticalFailure: summary.invalid > 0 || Boolean(criticalMessage),
    criticalMessage
  };
}
function buildArchiveKey(tenantId, filename) {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})\.parquet$/);
  if (!dateMatch) {
    throw new CoreError(
      "SCHEMA_VIOLATION",
      `Unable to infer archive date from filename: ${filename}`
    );
  }
  return `archives/${tenantId}/${dateMatch[1]}/${filename}`;
}
async function verifyArchive(input) {
  if (!input.signatureHex) {
    return {
      integrity: "unknown",
      validationError: "MISSING_SIGNATURE",
      criticalMessage: "Archive signature missing in KV export history"
    };
  }
  let publicKey;
  try {
    publicKey = await fetchTenantJwksKey(input.tenantId, input.jwksBaseUrl, {
      fetchImpl: input.fetchImpl
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "JWKS unavailable";
    return {
      integrity: "unknown",
      criticalMessage: `JWKS fetch failed: ${msg}`
    };
  }
  const isValid = await verifyEd25519Signature(input.archiveBuffer, input.signatureHex, publicKey);
  if (isValid) {
    return { integrity: "valid" };
  }
  return {
    integrity: "invalid",
    validationError: "SIGNATURE_MISMATCH",
    criticalMessage: "Integrity compromised: Ed25519 signature verification failed on R2 archive"
  };
}

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

// src/utils/index.ts
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function toPaginationSQL(params) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
}
function entries(obj) {
  return Object.entries(obj);
}
function assertDefined(value, label) {
  if (value === null || value === void 0) {
    throw new Error(`Expected '${label}' to be defined, got ${String(value)}`);
  }
  return value;
}
function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== void 0)
  );
}
export {
  BAGGIO_SESSION_COOKIE,
  BaggioAuth,
  CoreError,
  DEFAULT_BREAKER_OPTS,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  PLAN_QUOTAS,
  TenantedDB,
  TenantedKV,
  TenantedR2,
  VOLT_EFFECTIVE_TENANT_COOKIE,
  VOLT_SESSION_COOKIE,
  asPartnerID,
  asTenantID,
  asUserID,
  assertDefined,
  assertRole,
  assertTenantMatch,
  bridgeLegacyPlan,
  buildArchiveKey,
  buildCorruptionId,
  buildCssVariables,
  can,
  cloudflareKvRestFromEnv,
  compactObject,
  createCircuitBreaker,
  createCloudflareKvRest,
  createTenantedDB,
  createTenantedKV,
  createTenantedR2,
  entries,
  escapeSqlForLog,
  extractBearerToken,
  fetchTenantJwksKey,
  base64UrlToBytes as forensicsBase64UrlToBytes,
  hexToBytes as forensicsHexToBytes,
  generateId,
  getBreaker,
  getPlanQuotas,
  getThemeVariables,
  hasCloudflareKvCredentials,
  hasRole,
  identityClaimsToUserClaims,
  invalidateTenantCache,
  invalidateThemeCache,
  isPlanAtLeast,
  isValidHostname,
  isValidSlug,
  logImpersonationEvent,
  mapToForensicRows,
  maybeLogImpersonation,
  nowISO,
  resetBreakerRegistry,
  resolveTenant,
  resolveTenantById,
  sanitizeObject,
  serializeCssVars,
  stripHtml,
  summarizeForensicIntegrity,
  toPaginationSQL,
  truncate,
  validateVoltConfig,
  verifyArchive,
  verifyEd25519Signature,
  verifyTokenEdDSA
};
//# sourceMappingURL=index.js.map