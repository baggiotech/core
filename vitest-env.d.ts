/// <reference types="@cloudflare/workers-types" />

// Arquivo GLOBAL (sem export {}) — declara módulos ambientes e interfaces globais.
// Não misturar com module augmentations aqui.

interface CloudflareEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
}

// Declaração completa do módulo virtual provido pelo cloudflareTest plugin
declare module "cloudflare:test" {
  export const env: CloudflareEnv;
  export const SELF: Fetcher;
  export function reset(): Promise<void>;
  export function applyD1Migrations(
    db: D1Database,
    migrations: D1Migration[],
    migrationsTableName?: string,
  ): Promise<void>;
  export interface D1Migration {
    name: string;
    queries: string[];
  }
}
