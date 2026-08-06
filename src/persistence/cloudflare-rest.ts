import { CoreError } from "../types/index.js";
import type { KVNamespaceBinding } from "../identity/context.js";

// REST adapters — permitem usar TenantedKV/R2 fora de um Worker (Next.js Node, CI, etc).
// Mantêm o mesmo contrato dos bindings nativos Cloudflare; quando o app migrar
// para wrangler dev, basta trocar a fábrica sem mexer em call-sites.

export interface CloudflareKvRestConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  baseUrl?: string; // default https://api.cloudflare.com/client/v4
}

class CloudflareRestKvNamespace implements KVNamespaceBinding {
  private readonly endpoint: string;
  constructor(private readonly cfg: CloudflareKvRestConfig) {
    const base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
    this.endpoint = `${base}/accounts/${cfg.accountId}/storage/kv/namespaces/${cfg.namespaceId}`;
  }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.cfg.apiToken}` };
  }

  async get(key: string): Promise<string | null> {
    const url = `${this.endpoint}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, { headers: this.headers(), ...({ cache: "no-store" } as any) });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST get failed for key "${key}": ${response.status}`,
      );
    }
    return response.text();
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
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
      ...({ cache: "no-store" } as any),
    });
    if (!response.ok) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST put failed for key "${key}": ${response.status}`,
      );
    }
  }

  async delete(key: string): Promise<void> {
    const url = `${this.endpoint}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
      ...({ cache: "no-store" } as any),
    });
    if (!response.ok && response.status !== 404) {
      throw new CoreError(
        "INFRA_FAILURE",
        `KV REST delete failed for key "${key}": ${response.status}`,
      );
    }
  }
}

export function createCloudflareKvRest(cfg: CloudflareKvRestConfig): KVNamespaceBinding {
  return new CloudflareRestKvNamespace(cfg);
}

// Helper: monta o config a partir de process.env, sem leak de variáveis externas no Core.
export function cloudflareKvRestFromEnv(env: Record<string, string | undefined>): KVNamespaceBinding {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = env.CLOUDFLARE_KV_NAMESPACE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    throw new CoreError(
      "INFRA_FAILURE",
      "Missing Cloudflare KV REST credentials (CLOUDFLARE_ACCOUNT_ID/KV_NAMESPACE_ID/API_TOKEN)",
    );
  }
  return createCloudflareKvRest({ accountId, namespaceId, apiToken });
}

// Indica se credenciais REST estão presentes — útil para fallback em dev.
export function hasCloudflareKvCredentials(env: Record<string, string | undefined>): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_KV_NAMESPACE_ID && env.CLOUDFLARE_API_TOKEN);
}
