-- Volt Auth PRD v2.7 §3.2: Lazy Migration / Just-in-Time Re-hashing
-- Credenciais legadas (Bcrypt, Scrypt, PBKDF2) importadas de bases externas
-- são alocadas em legacy_hash. No primeiro login bem-sucedido o motor Rust
-- re-encripta para Argon2id + Pepper Dinâmico e apaga esta coluna (NULL).
ALTER TABLE users ADD COLUMN legacy_hash TEXT;

-- Write-through do user_store (PRD v2.7 §4.1): o D1 prod-volt-core guarda o
-- UserKvPayload completo como system of record; o KV atua como cache quente.
ALTER TABLE users ADD COLUMN payload_json TEXT;
