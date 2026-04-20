-- 0012_admin_sql_audit.sql
-- Audit log do console SQL admin. Cada execucao (sucesso, erro ou bloqueada
-- pelo guard de read-only) vira uma linha aqui. Sem FK para users porque o
-- perfil vive em document_store (users.payload->>'email').

CREATE TABLE IF NOT EXISTS admin_sql_audit (
    id SERIAL PRIMARY KEY,
    executed_by TEXT NOT NULL,
    sql_text TEXT NOT NULL,
    row_count INTEGER,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sql_audit_executed_at
    ON admin_sql_audit (executed_at DESC);
