// Arquivo MODULE (export {} obrigatório) — module augmentations precisam de um arquivo-módulo.
// Separado de vitest-env.d.ts porque um arquivo não pode ser global E módulo ao mesmo tempo.
export {};

declare module "vitest" {
  interface ProvidedContext {
    d1Migrations: import("cloudflare:test").D1Migration[];
  }
}
