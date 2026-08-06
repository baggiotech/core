import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { createTenantedDB } from "../../persistence/d1.js";
import { asTenantID, CoreError } from "../../types/index.js";

// ─── Tenant Leak Tests ────────────────────────────────────────────────────────
// Valida que o TenantedDB é um guard de isolamento: nenhuma query sem
// tenant_id pode passar, e dados de tenants distintos nunca se cruzam.

describe("TenantedDB — ISOLATION_VIOLATION guard", () => {
  it("throws on SELECT without tenant_id in the query", async () => {
    const db = createTenantedDB(env.DB, asTenantID("t-1"));

    await expect(
      db.queryOne("SELECT * FROM test_items WHERE id = ?", ["x"]),
    ).rejects.toThrow(CoreError);

    await expect(
      db.queryOne("SELECT * FROM test_items WHERE id = ?", ["x"]),
    ).rejects.toMatchObject({ code: "ISOLATION_VIOLATION" });
  });

  it("throws on INSERT without tenant_id column", async () => {
    const db = createTenantedDB(env.DB, asTenantID("t-1"));

    await expect(
      db.insert("INSERT INTO test_items (id, name) VALUES (?, ?)", ["1", "foo"]),
    ).rejects.toThrow(CoreError);
  });

  it("throws on UPDATE without tenant_id filter", async () => {
    const db = createTenantedDB(env.DB, asTenantID("t-1"));

    await expect(
      db.mutate("UPDATE test_items SET name = ? WHERE id = ?", ["new", "1"]),
    ).rejects.toThrow(CoreError);
  });

  it("throws on DELETE without tenant_id filter", async () => {
    const db = createTenantedDB(env.DB, asTenantID("t-1"));

    await expect(
      db.mutate("DELETE FROM test_items WHERE id = ?", ["1"]),
    ).rejects.toThrow(CoreError);
  });

  it("throws when tenant_id appears only in a table name (word-boundary guard)", async () => {
    const db = createTenantedDB(env.DB, asTenantID("t-1"));

    // "tenant_id_logs" contains the string "tenant_id" but not as a standalone filter token.
    // The word-boundary regex must reject this before hitting D1.
    await expect(
      db.query("SELECT * FROM tenant_id_logs"),
    ).rejects.toMatchObject({ code: "ISOLATION_VIOLATION" });
  });
});

describe("TenantedDB — cross-tenant data isolation", () => {
  it("each tenant only reads their own rows", async () => {
    const dbA = createTenantedDB(env.DB, asTenantID("tenant-a"));
    const dbB = createTenantedDB(env.DB, asTenantID("tenant-b"));

    await dbA.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "item-a",
      "Item A",
    ]);
    await dbB.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "item-b",
      "Item B",
    ]);

    const rowsA = await dbA.query<{ id: string }>(
      "SELECT id FROM test_items WHERE tenant_id = ?",
    );
    const rowsB = await dbB.query<{ id: string }>(
      "SELECT id FROM test_items WHERE tenant_id = ?",
    );

    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]?.id).toBe("item-a");

    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]?.id).toBe("item-b");
  });

  it("UPDATE from tenant-A cannot mutate tenant-B rows", async () => {
    const dbA = createTenantedDB(env.DB, asTenantID("tenant-a"));
    const dbB = createTenantedDB(env.DB, asTenantID("tenant-b"));

    // Ambos inserem uma row com o mesmo id primário
    await dbA.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "shared-id",
      "Original A",
    ]);
    await dbB.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "shared-id-b",
      "Original B",
    ]);

    // Tenant A atualiza sua row
    const changed = await dbA.mutate(
      "UPDATE test_items SET name = ? WHERE id = ? AND tenant_id = ?",
      ["Updated A", "shared-id"],
    );
    expect(changed).toBe(1);

    // Row do tenant B permanece intacta
    const itemB = await dbB.queryOne<{ name: string }>(
      "SELECT name FROM test_items WHERE id = ? AND tenant_id = ?",
      ["shared-id-b"],
    );
    expect(itemB?.name).toBe("Original B");
  });

  it("DELETE from tenant-A leaves tenant-B data intact", async () => {
    const dbA = createTenantedDB(env.DB, asTenantID("tenant-a"));
    const dbB = createTenantedDB(env.DB, asTenantID("tenant-b"));

    await dbA.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "del-a",
      "Delete Me",
    ]);
    await dbB.insert("INSERT INTO test_items (id, name, tenant_id) VALUES (?, ?, ?)", [
      "keep-b",
      "Keep Me",
    ]);

    await dbA.mutate("DELETE FROM test_items WHERE id = ? AND tenant_id = ?", ["del-a"]);

    const remaining = await dbB.query<{ id: string }>(
      "SELECT id FROM test_items WHERE tenant_id = ?",
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("keep-b");
  });
});
