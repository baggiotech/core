import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { invalidateTenantCache, resolveTenant } from "../../identity/context.ts";
import { asTenantID, CoreError } from "../../types/index.ts";
import type { TenantCacheEntry } from "../../types/index.ts";

// Helper: insere diretamente no D1 sem passar pelo TenantedDB (tabela de infra)
async function seedTenant(opts: {
  id: string;
  slug: string;
  plan?: string;
  status?: string;
  customDomain?: string | null;
}) {
  await env.DB.prepare(
    "INSERT INTO tenants (id, name, slug, plan_id, status, custom_domain) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      opts.id,
      `Tenant ${opts.slug}`,
      opts.slug,
      opts.plan ?? "solo",
      opts.status ?? "active",
      opts.customDomain ?? null,
    )
    .run();
}

describe("resolveTenant — cache-first flow", () => {
  it("returns context directly from KV on cache hit (no D1 query)", async () => {
    const tenantId = asTenantID("kv-hit-tenant");
    const cacheKey = "tenant:host:meusite.com";

    const entry: TenantCacheEntry = {
      tenantId,
      plan: "growth",
      themeVars: { "--color-primary": "#ff0000" },
      status: "active",
    };

    await env.KV.put(cacheKey, JSON.stringify(entry), { expirationTtl: 300 });

    const ctx = await resolveTenant("meusite.com", env.KV, env.DB);

    expect(ctx.id).toBe(tenantId);
    expect(ctx.plan).toBe("growth");
    expect(ctx.status).toBe("active");
  });

  it("falls back to D1 when KV cache is empty", async () => {
    await seedTenant({ id: "d1-fallback-id", slug: "myslug", plan: "agency" });

    const ctx = await resolveTenant("myslug", env.KV, env.DB);

    expect(ctx.id).toBe("d1-fallback-id");
    expect(ctx.plan).toBe("agency");
  });

  it("auto-repairs KV cache after D1 fallback", async () => {
    await seedTenant({ id: "repair-id", slug: "repairslug", plan: "start" });

    // KV está vazio antes da chamada
    const before = await env.KV.get("tenant:host:repairslug");
    expect(before).toBeNull();

    await resolveTenant("repairslug", env.KV, env.DB);

    // Após a chamada, o cache deve ter sido reparado
    const after = await env.KV.get("tenant:host:repairslug");
    expect(after).not.toBeNull();

    const cached = JSON.parse(after!) as TenantCacheEntry;
    expect(cached.tenantId).toBe("repair-id");
    expect(cached.plan).toBe("start");
  });

  it("matches by custom_domain when set", async () => {
    await seedTenant({
      id: "domain-tenant-id",
      slug: "internal-slug",
      plan: "business",
      customDomain: "app.empresa.com.br",
    });

    const ctx = await resolveTenant("app.empresa.com.br", env.KV, env.DB);

    expect(ctx.id).toBe("domain-tenant-id");
    expect(ctx.plan).toBe("business");
  });

  it("throws TENANT_NOT_FOUND for unknown host", async () => {
    await expect(
      resolveTenant("unknown-host.com", env.KV, env.DB),
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });

  it("throws TENANT_SUSPENDED for suspended tenant", async () => {
    await seedTenant({ id: "suspended-id", slug: "suspendedslug", status: "suspended" });

    await expect(
      resolveTenant("suspendedslug", env.KV, env.DB),
    ).rejects.toMatchObject({ code: "TENANT_SUSPENDED" });
  });

  it("does not resolve cancelled tenants", async () => {
    await seedTenant({ id: "cancelled-id", slug: "cancelledslug", status: "cancelled" });

    await expect(
      resolveTenant("cancelledslug", env.KV, env.DB),
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });
});

describe("resolveTenant — hostname injection guard", () => {
  it.each([
    ["SQL injection", "'; DROP TABLE tenants; --"],
    ["path traversal", "../../etc/passwd"],
    ["XSS payload", "<script>alert(1)</script>"],
    ["empty string", ""],
    ["null byte", "host\x00name.com"],
    ["overlong input", "a".repeat(300)],
  ])("throws ISOLATION_VIOLATION before touching KV/D1 for %s", async (_label, hostname) => {
    await expect(
      resolveTenant(hostname, env.KV, env.DB),
    ).rejects.toMatchObject({ code: "ISOLATION_VIOLATION" });
  });
});

describe("invalidateTenantCache", () => {
  it("removes cached entry so next call falls back to D1", async () => {
    await seedTenant({ id: "inval-id", slug: "invalslug", plan: "growth" });

    // Warm the cache via a D1 fallback
    await resolveTenant("invalslug", env.KV, env.DB);
    expect(await env.KV.get("tenant:host:invalslug")).not.toBeNull();

    // Invalidate
    await invalidateTenantCache("invalslug", env.KV);
    expect(await env.KV.get("tenant:host:invalslug")).toBeNull();

    // Next call re-reads from D1 and re-populates cache
    const ctx = await resolveTenant("invalslug", env.KV, env.DB);
    expect(ctx.id).toBe("inval-id");
    expect(await env.KV.get("tenant:host:invalslug")).not.toBeNull();
  });
});
