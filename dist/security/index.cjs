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

// src/security/index.ts
var security_exports = {};
__export(security_exports, {
  escapeSqlForLog: () => escapeSqlForLog,
  generateId: () => generateId,
  isValidHostname: () => isValidHostname,
  isValidSlug: () => isValidSlug,
  sanitizeFileContent: () => sanitizeFileContent,
  sanitizeObject: () => sanitizeObject,
  stripHtml: () => stripHtml,
  truncate: () => truncate
});
module.exports = __toCommonJS(security_exports);

// src/security/sanitizer.ts
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "password",
  "senha",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "creditcard",
  "card_number",
  "cvv",
  "cpf",
  "cnpj"
]);
function stripHtml(input) {
  return input.replace(/<[^>]*>/g, "").trim();
}
function escapeSqlForLog(input) {
  return input.replace(/['";\\]/g, "\\$&");
}
function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(
        (v) => v !== null && typeof v === "object" ? sanitizeObject(v) : v
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
function isValidSlug(slug) {
  if (slug.length > 63) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
function isValidHostname(hostname) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(hostname);
}
function truncate(input, maxLength) {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}
function generateId() {
  return crypto.randomUUID();
}
function sanitizeFileContent(text) {
  const result = text.replace(
    /((?:api[_-]?key|apikey|api_token|auth[_-]?token|secret[_-]?key|private[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|bearer)\s*[=:]\s*)(['"`]?)([^\s'"`\n]{8,})\2/gi,
    (_match, prefix, quote) => `${prefix}${quote}[REDACTED]${quote}`
  );
  return result.replace(
    /((?:https?|postgresql|postgres|mysql|mongodb|redis|amqp):\/\/)[^:@\s]+:[^@\s]+@/gi,
    "$1[REDACTED]@"
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  escapeSqlForLog,
  generateId,
  isValidHostname,
  isValidSlug,
  sanitizeFileContent,
  sanitizeObject,
  stripHtml,
  truncate
});
//# sourceMappingURL=index.cjs.map