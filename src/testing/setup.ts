import { env, applyD1Migrations } from "cloudflare:test";
import { inject, beforeAll, afterEach } from "vitest";

// Tabela auxiliar exclusiva de testes — não existe em produção
const TEST_ITEMS_TABLE =
  "CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL)";

beforeAll(async () => {
  // Aplica todas as migrações de /migrations/ em ordem numérica.
  // applyD1Migrations é idempotente: registra estado em d1_migrations e só
  // executa migrações novas. Isso garante que o schema de teste espelha produção.
  const migrations = inject("d1Migrations");
  await applyD1Migrations(env.DB, migrations);

  // Tabela de testes criada separadamente — não faz parte das migrations de prod
  await env.DB.exec(TEST_ITEMS_TABLE);
});

// Limpa dados entre testes sem derrubar o schema
afterEach(async () => {
  await env.DB.exec(
    [
      "DELETE FROM test_items",
      "DELETE FROM plan_events",
      "DELETE FROM tenants",
      "DELETE FROM impersonation_audit",
    ].join("\n"),
  );
});
