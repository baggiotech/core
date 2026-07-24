declare function stripHtml(input: string): string;
declare function escapeSqlForLog(input: string): string;
declare function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown>;
declare function isValidSlug(slug: string): boolean;
declare function isValidHostname(hostname: string): boolean;
declare function truncate(input: string, maxLength: number): string;
declare function generateId(): string;
declare function sanitizeFileContent(text: string): string;

export { escapeSqlForLog, generateId, isValidHostname, isValidSlug, sanitizeFileContent, sanitizeObject, stripHtml, truncate };
