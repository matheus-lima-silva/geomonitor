-- 0009_workspace_inspection_link.sql
-- Liga report_workspaces a uma inspection (vistoria) especifica, permitindo
-- distinguir visitas re-entrantes ao mesmo empreendimento.
--
-- Obs.: a tabela 'inspections' usa document-store (payload JSONB), portanto
-- FK fisica nao se aplica. A integridade referencial e verificada em codigo
-- pelo route handler antes de aceitar um inspection_id no payload.
--
-- Sem backfill automatico: workspaces antigos ficam com inspection_id NULL
-- e sao classificados manualmente pela UI (UnclassifiedWorkspacesModal).

ALTER TABLE report_workspaces
    ADD COLUMN IF NOT EXISTS inspection_id TEXT;

CREATE INDEX IF NOT EXISTS idx_report_workspaces_inspection_id
    ON report_workspaces (inspection_id);
