-- Migration 0002: Adiciona campo de metadata ao tenant
ALTER TABLE tenants ADD COLUMN metadata TEXT;
