import type { TenantID } from "../types/index";
import type { KVNamespaceBinding } from "../identity/context";

// KV Bridge — prefixa todas as chaves com tenant_id para evitar colisões
export class TenantedKV {
  constructor(
    private readonly kv: KVNamespaceBinding,
    private readonly tenantId: TenantID,
  ) {}

  private key(suffix: string): string {
    return `tenant:${this.tenantId}:${suffix}`;
  }

  async get<T = string>(suffix: string): Promise<T | null> {
    const raw = await this.kv.get(this.key(suffix));
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(suffix: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await this.kv.put(this.key(suffix), serialized, {
      expirationTtl: ttlSeconds,
    });
  }

  async delete(suffix: string): Promise<void> {
    // KV nativo não tem delete no binding simplificado; usar via API REST se necessário
    // Aqui setamos com expiração imediata como workaround
    await this.kv.put(this.key(suffix), "", { expirationTtl: 1 });
  }

  // Retorna a chave completa (útil para debugging)
  fullKey(suffix: string): string {
    return this.key(suffix);
  }
}

export function createTenantedKV(kv: KVNamespaceBinding, tenantId: TenantID): TenantedKV {
  return new TenantedKV(kv, tenantId);
}
