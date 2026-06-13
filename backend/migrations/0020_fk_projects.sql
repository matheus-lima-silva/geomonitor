-- Fase 4 (parte 2): FKs reais cujo pai e um document-store (projects) ou que
-- soltam a referencia (report_jobs).
--
-- projects-children -> RESTRICT: nao deixa apagar um projeto que ainda tem
-- workspaces / fotos / erosoes. Isso protege contra delete acidental e evita o
-- problema do CASCADE deixar orfaos no S3 (o delete do projeto passa a exigir
-- remover os filhos antes, por rotas que ja limpam o storage).
--
-- report_jobs.* -> SET NULL: jobs sao registros de execucao; se o recurso
-- referenciado some, o job sobrevive com a coluna anulada (limpeza nao-destrutiva
-- feita aqui antes do VALIDATE).
--
-- Como na 0019, relacoes RESTRICT NAO apagam orfaos automaticamente: se houver
-- orfaos o VALIDATE falha (rollback da migracao) e eles devem ser tratados via
-- migrations/0018_fk_orphan_audit.sql antes de reaplicar.

-- report_workspaces.project_id -> projects (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_workspaces_project') THEN
    ALTER TABLE report_workspaces ADD CONSTRAINT fk_report_workspaces_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE report_workspaces VALIDATE CONSTRAINT fk_report_workspaces_project;

-- report_photos.project_id -> projects (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_photos_project') THEN
    ALTER TABLE report_photos ADD CONSTRAINT fk_report_photos_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE report_photos VALIDATE CONSTRAINT fk_report_photos_project;

-- erosions.project_id -> projects (RESTRICT; coluna e nullable, NULL ignora a FK)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_erosions_project') THEN
    ALTER TABLE erosions ADD CONSTRAINT fk_erosions_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE erosions VALIDATE CONSTRAINT fk_erosions_project;

-- report_jobs.* -> SET NULL. Limpeza nao-destrutiva antes de validar.
UPDATE report_jobs SET workspace_id = NULL
WHERE workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM report_workspaces w WHERE w.id = report_jobs.workspace_id);
UPDATE report_jobs SET project_id = NULL
WHERE project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = report_jobs.project_id);
UPDATE report_jobs SET compound_id = NULL
WHERE compound_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM report_compounds c WHERE c.id = report_jobs.compound_id);
UPDATE report_jobs SET dossier_id = NULL
WHERE dossier_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_dossiers d WHERE d.id = report_jobs.dossier_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_jobs_workspace') THEN
    ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_workspace
      FOREIGN KEY (workspace_id) REFERENCES report_workspaces(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_jobs_project') THEN
    ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_jobs_compound') THEN
    ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_compound
      FOREIGN KEY (compound_id) REFERENCES report_compounds(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_jobs_dossier') THEN
    ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_dossier
      FOREIGN KEY (dossier_id) REFERENCES project_dossiers(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
ALTER TABLE report_jobs VALIDATE CONSTRAINT fk_report_jobs_workspace;
ALTER TABLE report_jobs VALIDATE CONSTRAINT fk_report_jobs_project;
ALTER TABLE report_jobs VALIDATE CONSTRAINT fk_report_jobs_compound;
ALTER TABLE report_jobs VALIDATE CONSTRAINT fk_report_jobs_dossier;
