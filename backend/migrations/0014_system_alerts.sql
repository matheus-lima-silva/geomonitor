-- 0014_system_alerts.sql
-- Tabela generica de alertas de sistema consumidos pela aba "Estatisticas" do
-- painel de administracao. Primeiro uso: alertas de requests que geraram mais
-- queries do que o threshold (default 15). O campo `type` e generico para
-- comportar outros tipos de alerta no futuro sem precisar de migration nova.

CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at
    ON system_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_pending
    ON system_alerts (acknowledged_at)
    WHERE acknowledged_at IS NULL;
