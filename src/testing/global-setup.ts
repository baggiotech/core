import path from "node:path";
import type { Vitest } from "vitest/node";
import { readD1Migrations } from "@cloudflare/vitest-pool-workers";

// Roda no processo Node.js antes dos testes.
// Em Vitest 4.x, globalSetup.setup() recebe a instância Vitest diretamente —
// `provide` é método do objeto, não exportação standalone de vitest/node.
export async function setup(vitest: Vitest) {
  const migrationsPath = path.join(import.meta.dirname, "../../migrations");
  const migrations = await readD1Migrations(migrationsPath);
  vitest.provide("d1Migrations", migrations);
}
