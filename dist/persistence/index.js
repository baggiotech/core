// src/types/index.ts
var CoreError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CoreError";
  }
};

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
export {
  DEFAULT_BREAKER_OPTS,
  TenantedDB,
  TenantedKV,
  TenantedR2,
  cloudflareKvRestFromEnv,
  createCircuitBreaker,
  createCloudflareKvRest,
  createTenantedDB,
  createTenantedKV,
  createTenantedR2,
  getBreaker,
  hasCloudflareKvCredentials,
  resetBreakerRegistry
};
//# sourceMappingURL=index.js.map