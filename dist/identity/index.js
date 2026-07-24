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
function isValidSlug(slug) {
  if (slug.length > 63) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
function isValidHostname(hostname) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(hostname);
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
export {
  BaggioAuth,
  DEFAULT_SESSION_COOKIE_OPTIONS,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_TOKEN_ISSUER,
  VOLT_EFFECTIVE_TENANT_COOKIE,
  VOLT_SESSION_COOKIE,
  assertRole,
  assertTenantMatch,
  bridgeLegacyPlan,
  buildCorruptionId,
  extractBearerToken,
  hasRole,
  identityClaimsToUserClaims,
  logImpersonationEvent,
  maybeLogImpersonation,
  resolveTenant,
  resolveTenantById,
  validateVoltConfig,
  verifyTokenEdDSA
};
//# sourceMappingURL=index.js.map