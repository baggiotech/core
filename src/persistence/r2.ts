import type { TenantID } from "../types/index.ts";

export interface R2BucketBinding {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ objects: R2Object[] }>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  body?: ReadableStream;
  arrayBuffer?(): Promise<ArrayBuffer>;
  text?(): Promise<string>;
}

// R2 Bridge — prefixa todos os paths com tenant_id para isolamento completo
export class TenantedR2 {
  constructor(
    private readonly bucket: R2BucketBinding,
    private readonly tenantId: TenantID,
  ) {}

  private path(suffix: string): string {
    return `${this.tenantId}/${suffix}`;
  }

  async get(suffix: string): Promise<R2Object | null> {
    return this.bucket.get(this.path(suffix));
  }

  async put(
    suffix: string,
    value: ReadableStream | ArrayBuffer | string,
  ): Promise<R2Object> {
    return this.bucket.put(this.path(suffix), value);
  }

  async delete(suffix: string): Promise<void> {
    return this.bucket.delete(this.path(suffix));
  }

  async list(subfolder = "", limit = 100): Promise<R2Object[]> {
    const prefix = this.path(subfolder);
    const result = await this.bucket.list({ prefix, limit });
    return result.objects;
  }

  // Retorna o path completo (útil para gerar URLs públicas)
  fullPath(suffix: string): string {
    return this.path(suffix);
  }
}

export function createTenantedR2(bucket: R2BucketBinding, tenantId: TenantID): TenantedR2 {
  return new TenantedR2(bucket, tenantId);
}
