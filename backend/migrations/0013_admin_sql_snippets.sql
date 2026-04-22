-- 0013_admin_sql_snippets.sql
-- Snippets salvos do console SQL admin. Globais/compartilhados entre todos
-- os admins; coluna created_by serve apenas para audit. Uniqueness por
-- LOWER(name) previne duplicatas case-insensitive.

CREATE TABLE IF NOT EXISTS admin_sql_snippets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sql_text TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sql_snippets_name
    ON admin_sql_snippets (LOWER(name));
