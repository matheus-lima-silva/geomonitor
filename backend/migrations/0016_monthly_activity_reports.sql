-- Relatorio Mensal de Acompanhamento dos Servicos (portal relat.lima.rio.br).
-- Modelo relacional: um header por (dono, ano, mes) + engenheiros, cada um com
-- suas atividades e projetos (resumo). Save full-sync transacional com
-- concorrencia otimista (coluna version).

CREATE TABLE IF NOT EXISTS monthly_reports (
    id            TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    ref_year      INTEGER NOT NULL,
    ref_month     INTEGER NOT NULL,          -- 0-11 (Janeiro=0)
    author_name   TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',  -- draft | final
    version       INTEGER NOT NULL DEFAULT 1,     -- concorrencia otimista
    intro         TEXT NOT NULL DEFAULT '',
    conclusao     TEXT NOT NULL DEFAULT '',
    quadro_style  TEXT NOT NULL DEFAULT 'marcador'
                  CHECK (quadro_style IN ('preenchido', 'marcador', 'barra')),
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb, -- holidays: [{date, name}]
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_reports_owner_period
    ON monthly_reports (owner_user_id, ref_year, ref_month);

CREATE TABLE IF NOT EXISTS monthly_report_engineers (
    id         TEXT PRIMARY KEY,
    report_id  TEXT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mre_report ON monthly_report_engineers (report_id);

CREATE TABLE IF NOT EXISTS monthly_report_projects (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    engineer_id TEXT NOT NULL REFERENCES monthly_report_engineers(id) ON DELETE CASCADE,
    name        TEXT,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrp_report ON monthly_report_projects (report_id);
CREATE INDEX IF NOT EXISTS idx_mrp_engineer ON monthly_report_projects (engineer_id);

CREATE TABLE IF NOT EXISTS monthly_report_activities (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    engineer_id TEXT NOT NULL REFERENCES monthly_report_engineers(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,               -- enum validado por Zod no app
    description TEXT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_mra_report ON monthly_report_activities (report_id);
CREATE INDEX IF NOT EXISTS idx_mra_engineer ON monthly_report_activities (engineer_id);

-- Config global por usuario (equipe + dados do contrato) — vale para todos os
-- meses; o frontend usa para semear novos periodos e o texto-modelo da intro.
CREATE TABLE IF NOT EXISTS monthly_report_settings (
    owner_user_id TEXT PRIMARY KEY,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb, -- { team:[{id,name}], contrato:{numero,objeto,contratante,contratada} }
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    TEXT
);
