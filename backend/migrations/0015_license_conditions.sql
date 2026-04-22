-- 0015_license_conditions.sql
-- Condicionantes de LOs agora vivem em tabela filha relacional (FK virtual).
-- Antes: o texto da condicionante ficava concatenado em operating_licenses.payload.observacoes.
-- Com a tabela separada da pra listar/editar/filtrar por condicionante e por tipo
-- (processos erosivos, PRAD, supressao, etc.) sem ter que reparsear o blob.
-- Segue o padrao de 0010_report_archives.sql e 0007_workspace_members.sql:
-- FK virtual (sem REFERENCES no BD), integridade validada no route handler.

CREATE TABLE IF NOT EXISTS license_conditions (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    numero TEXT NOT NULL,
    titulo TEXT NOT NULL DEFAULT '',
    texto TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'geral',
    prazo TEXT NOT NULL DEFAULT '',
    periodicidade_relatorio TEXT NOT NULL DEFAULT '',
    meses_entrega INTEGER[] NOT NULL DEFAULT '{}',
    ordem INTEGER NOT NULL DEFAULT 0,
    parecer_tecnico_ref TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_conditions_license_id
    ON license_conditions (license_id);

CREATE INDEX IF NOT EXISTS idx_license_conditions_tipo
    ON license_conditions (tipo);

CREATE INDEX IF NOT EXISTS idx_license_conditions_license_ordem
    ON license_conditions (license_id, ordem, id);
