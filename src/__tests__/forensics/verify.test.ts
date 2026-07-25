import { describe, expect, it } from "vitest";
import {
  hexToBytes,
  mapToForensicRows,
  summarizeForensicIntegrity,
  verifyEd25519Signature,
} from "../../forensics/index";

// Gera um par Ed25519 via Web Crypto e devolve a chave pública/secreta.
async function generateEdKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: CryptoKey }> {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey("raw", publicKey);
  return { publicKey: new Uint8Array(pubRaw), privateKey };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("forensics.verifyEd25519Signature", () => {
  it("returns true for a valid detached signature", async () => {
    const { publicKey, privateKey } = await generateEdKeyPair();
    const payload = new TextEncoder().encode("PAR1-forensic-archive");
    const sigBuffer = await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer,
    );
    const sigHex = bytesToHex(new Uint8Array(sigBuffer));

    const ok = await verifyEd25519Signature(payload, sigHex, publicKey);
    expect(ok).toBe(true);
  });

  it("marks tampered payload as invalid", async () => {
    const { publicKey, privateKey } = await generateEdKeyPair();
    const original = new TextEncoder().encode("PAR1-forensic-archive");
    const sigBuffer = await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) as ArrayBuffer,
    );
    const sigHex = bytesToHex(new Uint8Array(sigBuffer));

    const tampered = new Uint8Array(original);
    tampered[5] = 0xff;

    const ok = await verifyEd25519Signature(tampered, sigHex, publicKey);
    expect(ok).toBe(false);
  });

  it("rejects malformed hex signatures", async () => {
    const { publicKey } = await generateEdKeyPair();
    const payload = new TextEncoder().encode("payload");

    await expect(
      verifyEd25519Signature(payload, "not-even-hex-length-z", publicKey),
    ).rejects.toThrow();
  });
});

describe("forensics encoders", () => {
  it("hexToBytes round-trips", () => {
    const bytes = hexToBytes("deadbeef");
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });
});

describe("forensics row mapping", () => {
  it("maps raw records with default integrity propagation", () => {
    const records = [
      { id: "1", timestamp: 1700000000000, user: "alice", event: "login", details: "ok", ip: "1.2.3.4" },
      { id: "2", timestamp: 1700000001000, user: "bob", event: "logout" },
    ];
    const rows = mapToForensicRows(records, "valid", "sig-99");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "1",
      actor: "alice",
      action: "login",
      integrity: "valid",
      signatureId: "sig-99",
    });
    expect(rows[1]?.target).toBe("No details");
  });

  it("summarize flags critical when any invalid row exists", () => {
    const rows = mapToForensicRows(
      [{ id: "1" }, { id: "2" }],
      "invalid",
      "sig",
      "SIGNATURE_MISMATCH",
    );
    const summary = summarizeForensicIntegrity(rows);
    expect(summary.invalid).toBe(2);
    expect(summary.hasCriticalFailure).toBe(true);
  });
});
