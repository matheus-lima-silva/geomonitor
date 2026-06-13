-- Fase 4b: converte as FKs virtuais que ficaram fora do conjunto curado das
-- 0019/0020. Mesmo padrao: guard em pg_constraint + ADD ... NOT VALID + VALIDATE,
-- SEM DELETE automatico de orfaos (VALIDATE falha alto se houver — tratar via
-- migrations/0018_fk_orphan_audit.sql). Auto-clean apenas nas relacoes SET NULL.
--
-- Politicas:
--   project_dossiers.project_id -> projects        RESTRICT (produto de trabalho)
--   project_report_defaults.project_id -> projects CASCADE  (config 1:1 do projeto)
--   project_photo_exports.project_id -> projects   CASCADE  (token efemero do projeto)
--   workspace_kmz_requests.workspace_id -> ws       CASCADE  (request efemero)
--   workspace_imports.workspace_id -> ws            CASCADE  (historico de import)
--   report_jobs.template_id -> report_templates     SET NULL (ref fraca)
--   report_compounds.template_id -> report_templates SET NULL (ref fraca)

-- project_dossiers.project_id -> projects (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_dossiers_project') THEN
    ALTER TABLE project_dossiers ADD CONSTRAINT fk_project_dossiers_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE project_dossiers VALIDATE CONSTRAINT fk_project_dossiers_project;

-- project_report_defaults.project_id -> projects (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_report_defaults_project') THEN
    ALTER TABLE project_report_defaults ADD CONSTRAINT fk_project_report_defaults_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE project_report_defaults VALIDATE CONSTRAINT fk_project_report_defaults_project;

-- project_photo_exports.project_id -> projects (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_photo_exports_project') THEN
    ALTER TABLE project_photo_exports ADD CONSTRAINT fk_project_photo_exports_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE project_photo_exports VALIDATE CONSTRAINT fk_project_photo_exports_project;

-- workspace_kmz_requests.workspace_id -> report_workspaces (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspace_kmz_requests_workspace') THEN
    ALTER TABLE workspace_kmz_requests ADD CONSTRAINT fk_workspace_kmz_requests_workspace
      FOREIGN KEY (workspace_id) REFERENCES report_workspaces(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE workspace_kmz_requests VALIDATE CONSTRAINT fk_workspace_kmz_requests_workspace;

-- workspace_imports.workspace_id -> report_workspaces (CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspace_imports_workspace') THEN
    ALTER TABLE workspace_imports ADD CONSTRAINT fk_workspace_imports_workspace
      FOREIGN KEY (workspace_id) REFERENCES report_workspaces(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE workspace_imports VALIDATE CONSTRAINT fk_workspace_imports_workspace;

-- template_id -> report_templates (SET NULL). Limpeza nao-destrutiva antes do validate.
UPDATE report_jobs SET template_id = NULL
WHERE template_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM report_templates t WHERE t.id = report_jobs.template_id);
UPDATE report_compounds SET template_id = NULL
WHERE template_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM report_templates t WHERE t.id = report_compounds.template_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_jobs_template') THEN
    ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_template
      FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_compounds_template') THEN
    ALTER TABLE report_compounds ADD CONSTRAINT fk_report_compounds_template
      FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
ALTER TABLE report_jobs VALIDATE CONSTRAINT fk_report_jobs_template;
ALTER TABLE report_compounds VALIDATE CONSTRAINT fk_report_compounds_template;
