// src/types/index.ts
function asTenantID(id) {
  return id;
}
function asUserID(id) {
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
function generateId() {
  return crypto.randomUUID();
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

// src/testing/factories.ts
var TEST_JWT_SECRET = "test-secret-baggio-core-2025";
function toBase64Url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function toBase64UrlBytes(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function signJwt(payload, secret) {
  const encoder = new TextEncoder();
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${toBase64UrlBytes(new Uint8Array(sig))}`;
}
async function createTestTenant(db, kv, options = {}) {
  const id = options.id ?? generateId();
  const slug = options.slug ?? `test-${id.slice(0, 8)}`;
  const plan = options.plan ?? "solo";
  const name = options.name ?? `Test Tenant ${slug}`;
  const status = options.status ?? "active";
  const customDomain = options.customDomain ?? null;
  const rawDb = db;
  await rawDb.prepare(
    "INSERT INTO tenants (id, name, slug, plan_id, status, custom_domain) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, name, slug, plan, status, customDomain).run();
  const tenantId = asTenantID(id);
  const cacheKey = `tenant:host:${customDomain ?? slug}`;
  await kv.put(
    cacheKey,
    JSON.stringify({ tenantId, plan, themeVars: {}, status }),
    { expirationTtl: 300 }
  );
  return Object.freeze({
    id: tenantId,
    slug,
    plan,
    partnerId: null,
    themeConfig: null,
    status
  });
}
async function mockAuthContext(tenant, options = {}) {
  const role = options.role ?? "admin";
  const secret = options.secret ?? TEST_JWT_SECRET;
  const userId = generateId();
  const now = Math.floor(Date.now() / 1e3);
  const claims = {
    sub: asUserID(userId),
    tenantId: tenant.id,
    role,
    email: `test+${userId.slice(0, 8)}@baggio.tech`,
    iat: now,
    exp: now + 3600
  };
  const token = await signJwt(claims, secret);
  return { token, claims };
}
function testTenantedDB(db, tenantId) {
  return createTenantedDB(db, tenantId);
}
async function resetTestDB(db) {
  const rawDb = db;
  await rawDb.exec("DELETE FROM test_items");
  await rawDb.exec("DELETE FROM plan_events");
  await rawDb.exec("DELETE FROM tenants");
}
export {
  TEST_JWT_SECRET,
  createTestTenant,
  mockAuthContext,
  resetTestDB,
  testTenantedDB
};
//# sourceMappingURL=index.js.map