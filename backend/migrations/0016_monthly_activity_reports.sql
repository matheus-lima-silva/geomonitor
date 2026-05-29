-- Relatorio Mensal de Atividades (modulo do portal relat.lima.rio.br).
-- Modelo relacional: um header por (dono, ano, mes) + projetos + atividades.
-- Save full-sync transacional com concorrencia otimista (coluna version).

CREATE TABLE IF NOT EXISTS monthly_reports (
    id            TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    ref_year      INTEGER NOT NULL,
    ref_month     INTEGER NOT NULL,          -- 0-11 (Janeiro=0)
    author_name   TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',  -- draft | final
    version       INTEGER NOT NULL DEFAULT 1,     -- concorrencia otimista
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb, -- holidayOverrides[], prefs
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_reports_owner_period
    ON monthly_reports (owner_user_id, ref_year, ref_month);

CREATE TABLE IF NOT EXISTS monthly_report_projects (
    id                TEXT PRIMARY KEY,
    report_id         TEXT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    linked_project_id TEXT,                  -- ref. SOFT a projects.id (sem FK), opcional
    name              TEXT,
    description       TEXT,
    collapsed         BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrp_report ON monthly_report_projects (report_id);

CREATE TABLE IF NOT EXISTS monthly_report_activities (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    project_id  TEXT REFERENCES monthly_report_projects(id) ON DELETE SET NULL,
    category    TEXT NOT NULL,               -- enum validado por Zod no app
    description TEXT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_mra_report ON monthly_report_activities (report_id);
CREATE INDEX IF NOT EXISTS idx_mra_project ON monthly_report_activities (project_id);
