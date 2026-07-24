// Sanitização obrigatória antes de qualquer log ou persistência (RNF Segurança)
// Compatível com WebAssembly / Node / CF Workers — sem dependências externas

// Campos que nunca devem aparecer em logs ou respostas de erro
// Todos em lowercase — a comparação usa key.toLowerCase()
const SENSITIVE_KEYS = new Set([
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
  "cnpj",
]);

// Remove tags HTML para prevenir XSS em campos de texto livre
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

// Escapa caracteres especiais do SQL para logging seguro (não substitui prepared statements)
export function escapeSqlForLog(input: string): string {
  return input.replace(/['";\\]/g, "\\$&");
}

// Sanitiza um objeto recursivamente, mascarando campos sensíveis
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        v !== null && typeof v === "object" ? sanitizeObject(v as Record<string, unknown>) : v,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Valida slug de tenant (somente letras minúsculas, números e hífens; máx 63 chars — padrão de subdomínio)
export function isValidSlug(slug: string): boolean {
  if (slug.length > 63) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// Valida formato básico de hostname
export function isValidHostname(hostname: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(hostname);
}

// Trunca string garantindo que não ultrapasse limites seguros para DB
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}

// Gera um ID único simples compatível com CF Workers (sem crypto.randomUUID polyfill)
export function generateId(): string {
  return crypto.randomUUID();
}

// Sanitiza o conteúdo bruto de um arquivo removendo segredos antes do envio para a API
export function sanitizeFileContent(text: string): string {
  // key = "value" / key: value — redact the secret value only
  const result = text.replace(
    /((?:api[_-]?key|apikey|api_token|auth[_-]?token|secret[_-]?key|private[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|bearer)\s*[=:]\s*)(['"`]?)([^\s'"`\n]{8,})\2/gi,
    (_match: string, prefix: string, quote: string) => `${prefix}${quote}[REDACTED]${quote}`,
  );

  // Connection strings with embedded credentials: protocol://user:pass@host
  return result.replace(
    /((?:https?|postgresql|postgres|mysql|mongodb|redis|amqp):\/\/)[^:@\s]+:[^@\s]+@/gi,
    "$1[REDACTED]@",
  );
}
