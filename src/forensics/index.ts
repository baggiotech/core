import { CoreError } from "../types/index";

// ─── Forensics: integridade Ed25519 sobre arquivos R2 ─────────────────────────
// Centraliza o que antes vivia na Server Action de compliance do Core.
// O parquet decode permanece no app (parquetjs-lite é Node-only); o Core trata
// apenas: verificação criptográfica + summarização + tipos compartilhados.

export type ForensicIntegrity = "valid" | "invalid" | "unknown";

export type ForensicValidationError =
  | "SIGNATURE_MISMATCH"
  | "MISSING_SIGNATURE"
  | "EXPIRED_SIGNATURE";

export interface ForensicLogRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  ip?: string;
  integrity: ForensicIntegrity;
  signatureId?: string;
  validationError?: ForensicValidationError;
}

export interface ForensicIntegritySummary {
  total: number;
  valid: number;
  invalid: number;
  unknown: number;
  hasCriticalFailure: boolean;
  criticalMessage?: string;
}

export interface ForensicTablePayload {
  rows: ForensicLogRow[];
  integritySummary: ForensicIntegritySummary;
  source: "r2";
  fetchedAt: string;
}

export interface ExportHistoryEntry {
  id: string;
  date: number;
  status: string;
  filename: string;
  signature?: string;
}

// ─── Encoding helpers (sem dependências externas, compatíveis com Workers) ────

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new CoreError("INVALID_TOKEN", `Hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function base64UrlToBytes(b64u: string): Uint8Array {
  const normalized = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

// ─── Ed25519 verify (Web Crypto, sem tweetnacl) ───────────────────────────────

export async function verifyEd25519Signature(
  payload: Uint8Array,
  signatureHex: string,
  publicKey: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    publicKey.buffer.slice(publicKey.byteOffset, publicKey.byteOffset + publicKey.byteLength) as ArrayBuffer,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const sig = hexToBytes(signatureHex);
  const sigBuf = sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer;
  const payloadBuf = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.verify("Ed25519", key, sigBuf, payloadBuf);
}

// ─── JWKS fetch ───────────────────────────────────────────────────────────────

interface Jwk {
  kty?: string;
  crv?: string;
  x?: string;
}

export interface FetchJwksOptions {
  fetchImpl?: typeof fetch;
}

// Baixa a chave Ed25519 pública do tenant via /jwks.json do Worker de identidade.
export async function fetchTenantJwksKey(
  tenantId: string,
  jwksBaseUrl: string,
  options?: FetchJwksOptions,
): Promise<Uint8Array> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${jwksBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(tenantId)}/jwks.json`;

  let response: Response;
  try {
    response = await fetchImpl(url, { ...({ cache: "no-store" } as any) });
  } catch (e) {
    throw new CoreError(
      "INFRA_FAILURE",
      `JWKS fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!response.ok) {
    throw new CoreError("INFRA_FAILURE", `Tenant JWKS endpoint returned ${response.status}`);
  }

  const jwks = (await response.json()) as { keys?: Jwk[] };
  const key = jwks.keys?.find((item) => item.kty === "OKP" && item.crv === "Ed25519" && item.x);
  if (!key?.x) {
    throw new CoreError("INVALID_TOKEN", "Tenant JWKS missing Ed25519 verification key");
  }
  return base64UrlToBytes(key.x);
}

// ─── Mapeamento e summarização ────────────────────────────────────────────────

// Constrói ForensicLogRows tipadas a partir de records brutos do parquet decode.
// O caller (app) é responsável por entregar records já decodificados.
export function mapToForensicRows(
  records: ReadonlyArray<Record<string, unknown>>,
  integrity: ForensicIntegrity,
  signatureId?: string,
  validationError?: ForensicValidationError,
): ForensicLogRow[] {
  return records.map((record, index) => ({
    id: String(record.id ?? `unknown-${index}`),
    timestamp: new Date(Number(record.timestamp ?? Date.now())).toISOString(),
    actor: String(record.user ?? "unknown"),
    action: String(record.event ?? "unknown.event"),
    target: String(record.details ?? "No details"),
    ip: typeof record.ip === "string" ? record.ip : undefined,
    integrity,
    signatureId,
    validationError,
  }));
}

export function summarizeForensicIntegrity(
  rows: ReadonlyArray<ForensicLogRow>,
  criticalMessage?: string,
): ForensicIntegritySummary {
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.integrity === "valid") acc.valid += 1;
      if (row.integrity === "invalid") acc.invalid += 1;
      if (row.integrity === "unknown") acc.unknown += 1;
      return acc;
    },
    { total: 0, valid: 0, invalid: 0, unknown: 0 },
  );

  return {
    ...summary,
    hasCriticalFailure: summary.invalid > 0 || Boolean(criticalMessage),
    criticalMessage,
  };
}

// Constrói a chave R2 canônica do arquivo de auditoria a partir do filename.
export function buildArchiveKey(tenantId: string, filename: string): string {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})\.parquet$/);
  if (!dateMatch) {
    throw new CoreError(
      "SCHEMA_VIOLATION",
      `Unable to infer archive date from filename: ${filename}`,
    );
  }
  return `archives/${tenantId}/${dateMatch[1]}/${filename}`;
}

// ─── Orquestrador: verificação completa de assinatura ─────────────────────────

export interface VerifyArchiveInput {
  tenantId: string;
  archiveBuffer: Uint8Array;
  signatureHex?: string;
  jwksBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface VerifyArchiveOutput {
  integrity: ForensicIntegrity;
  validationError?: ForensicValidationError;
  criticalMessage?: string;
}

// Pipeline: busca JWKS → verifica Ed25519 → retorna integridade.
// Server Action chama isto após ler o buffer (R2 nativo ou S3 via @aws-sdk).
export async function verifyArchive(input: VerifyArchiveInput): Promise<VerifyArchiveOutput> {
  if (!input.signatureHex) {
    return {
      integrity: "unknown",
      validationError: "MISSING_SIGNATURE",
      criticalMessage: "Archive signature missing in KV export history",
    };
  }

  let publicKey: Uint8Array;
  try {
    publicKey = await fetchTenantJwksKey(input.tenantId, input.jwksBaseUrl, {
      fetchImpl: input.fetchImpl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "JWKS unavailable";
    return {
      integrity: "unknown",
      criticalMessage: `JWKS fetch failed: ${msg}`,
    };
  }

  const isValid = await verifyEd25519Signature(input.archiveBuffer, input.signatureHex, publicKey);
  if (isValid) {
    return { integrity: "valid" };
  }
  return {
    integrity: "invalid",
    validationError: "SIGNATURE_MISMATCH",
    criticalMessage: "Integrity compromised: Ed25519 signature verification failed on R2 archive",
  };
}
