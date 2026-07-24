"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/forensics/index.ts
var forensics_exports = {};
__export(forensics_exports, {
  base64UrlToBytes: () => base64UrlToBytes,
  buildArchiveKey: () => buildArchiveKey,
  fetchTenantJwksKey: () => fetchTenantJwksKey,
  hexToBytes: () => hexToBytes,
  mapToForensicRows: () => mapToForensicRows,
  summarizeForensicIntegrity: () => summarizeForensicIntegrity,
  verifyArchive: () => verifyArchive,
  verifyEd25519Signature: () => verifyEd25519Signature
});
module.exports = __toCommonJS(forensics_exports);

// src/types/index.ts
var CoreError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CoreError";
  }
};

// src/forensics/index.ts
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new CoreError("INVALID_TOKEN", `Hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
function base64UrlToBytes(b64u) {
  const normalized = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
async function verifyEd25519Signature(payload, signatureHex, publicKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    publicKey.buffer.slice(publicKey.byteOffset, publicKey.byteOffset + publicKey.byteLength),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const sig = hexToBytes(signatureHex);
  const sigBuf = sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength);
  const payloadBuf = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  );
  return crypto.subtle.verify("Ed25519", key, sigBuf, payloadBuf);
}
async function fetchTenantJwksKey(tenantId, jwksBaseUrl, options) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${jwksBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(tenantId)}/jwks.json`;
  let response;
  try {
    response = await fetchImpl(url, { ...{ cache: "no-store" } });
  } catch (e) {
    throw new CoreError(
      "INFRA_FAILURE",
      `JWKS fetch failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!response.ok) {
    throw new CoreError("INFRA_FAILURE", `Tenant JWKS endpoint returned ${response.status}`);
  }
  const jwks = await response.json();
  const key = jwks.keys?.find((item) => item.kty === "OKP" && item.crv === "Ed25519" && item.x);
  if (!key?.x) {
    throw new CoreError("INVALID_TOKEN", "Tenant JWKS missing Ed25519 verification key");
  }
  return base64UrlToBytes(key.x);
}
function mapToForensicRows(records, integrity, signatureId, validationError) {
  return records.map((record, index) => ({
    id: String(record.id ?? `unknown-${index}`),
    timestamp: new Date(Number(record.timestamp ?? Date.now())).toISOString(),
    actor: String(record.user ?? "unknown"),
    action: String(record.event ?? "unknown.event"),
    target: String(record.details ?? "No details"),
    ip: typeof record.ip === "string" ? record.ip : void 0,
    integrity,
    signatureId,
    validationError
  }));
}
function summarizeForensicIntegrity(rows, criticalMessage) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.integrity === "valid") acc.valid += 1;
      if (row.integrity === "invalid") acc.invalid += 1;
      if (row.integrity === "unknown") acc.unknown += 1;
      return acc;
    },
    { total: 0, valid: 0, invalid: 0, unknown: 0 }
  );
  return {
    ...summary,
    hasCriticalFailure: summary.invalid > 0 || Boolean(criticalMessage),
    criticalMessage
  };
}
function buildArchiveKey(tenantId, filename) {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})\.parquet$/);
  if (!dateMatch) {
    throw new CoreError(
      "SCHEMA_VIOLATION",
      `Unable to infer archive date from filename: ${filename}`
    );
  }
  return `archives/${tenantId}/${dateMatch[1]}/${filename}`;
}
async function verifyArchive(input) {
  if (!input.signatureHex) {
    return {
      integrity: "unknown",
      validationError: "MISSING_SIGNATURE",
      criticalMessage: "Archive signature missing in KV export history"
    };
  }
  let publicKey;
  try {
    publicKey = await fetchTenantJwksKey(input.tenantId, input.jwksBaseUrl, {
      fetchImpl: input.fetchImpl
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "JWKS unavailable";
    return {
      integrity: "unknown",
      criticalMessage: `JWKS fetch failed: ${msg}`
    };
  }
  const isValid = await verifyEd25519Signature(input.archiveBuffer, input.signatureHex, publicKey);
  if (isValid) {
    return { integrity: "valid" };
  }
  return {
    integrity: "invalid",
    validationError: "SIGNATURE_MISMATCH",
    criticalMessage: "Integrity compromised: Ed25519 signature verification failed on R2 archive"
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  base64UrlToBytes,
  buildArchiveKey,
  fetchTenantJwksKey,
  hexToBytes,
  mapToForensicRows,
  summarizeForensicIntegrity,
  verifyArchive,
  verifyEd25519Signature
});
//# sourceMappingURL=index.cjs.map