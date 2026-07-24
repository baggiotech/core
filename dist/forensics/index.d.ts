type ForensicIntegrity = "valid" | "invalid" | "unknown";
type ForensicValidationError = "SIGNATURE_MISMATCH" | "MISSING_SIGNATURE" | "EXPIRED_SIGNATURE";
interface ForensicLogRow {
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
interface ForensicIntegritySummary {
    total: number;
    valid: number;
    invalid: number;
    unknown: number;
    hasCriticalFailure: boolean;
    criticalMessage?: string;
}
interface ForensicTablePayload {
    rows: ForensicLogRow[];
    integritySummary: ForensicIntegritySummary;
    source: "r2";
    fetchedAt: string;
}
interface ExportHistoryEntry {
    id: string;
    date: number;
    status: string;
    filename: string;
    signature?: string;
}
declare function hexToBytes(hex: string): Uint8Array;
declare function base64UrlToBytes(b64u: string): Uint8Array;
declare function verifyEd25519Signature(payload: Uint8Array, signatureHex: string, publicKey: Uint8Array): Promise<boolean>;
interface FetchJwksOptions {
    fetchImpl?: typeof fetch;
}
declare function fetchTenantJwksKey(tenantId: string, jwksBaseUrl: string, options?: FetchJwksOptions): Promise<Uint8Array>;
declare function mapToForensicRows(records: ReadonlyArray<Record<string, unknown>>, integrity: ForensicIntegrity, signatureId?: string, validationError?: ForensicValidationError): ForensicLogRow[];
declare function summarizeForensicIntegrity(rows: ReadonlyArray<ForensicLogRow>, criticalMessage?: string): ForensicIntegritySummary;
declare function buildArchiveKey(tenantId: string, filename: string): string;
interface VerifyArchiveInput {
    tenantId: string;
    archiveBuffer: Uint8Array;
    signatureHex?: string;
    jwksBaseUrl: string;
    fetchImpl?: typeof fetch;
}
interface VerifyArchiveOutput {
    integrity: ForensicIntegrity;
    validationError?: ForensicValidationError;
    criticalMessage?: string;
}
declare function verifyArchive(input: VerifyArchiveInput): Promise<VerifyArchiveOutput>;

export { type ExportHistoryEntry, type FetchJwksOptions, type ForensicIntegrity, type ForensicIntegritySummary, type ForensicLogRow, type ForensicTablePayload, type ForensicValidationError, type VerifyArchiveInput, type VerifyArchiveOutput, base64UrlToBytes, buildArchiveKey, fetchTenantJwksKey, hexToBytes, mapToForensicRows, summarizeForensicIntegrity, verifyArchive, verifyEd25519Signature };
