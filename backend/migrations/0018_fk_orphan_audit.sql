-- Diagnostico pre-FK (Fase 3 do roadmap de banco): registra em migration_issues
-- todos os orfaos das FKs "virtuais" (validadas so em codigo, sem REFERENCES no
-- banco). Read-only sobre os dados de negocio; so escreve linhas de auditoria.
-- A contagem por relacao decide a politica de cada FK real na Fase 4 (0019/0020):
--   SELECT entity_type, details->>'column', COUNT(*)
--   FROM migration_issues WHERE issue_code = 'fk_orphan'
--   GROUP BY 1, 2 ORDER BY 1, 2;
--
-- Idempotente: limpa os registros 'fk_orphan' antes de reinserir, entao reaplicar
-- a migracao (checksum novo) recomputa o retrato atual sem duplicar.

DELETE FROM migration_issues WHERE issue_code = 'fk_orphan';

-- report_workspaces.project_id -> projects
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_workspaces.project_id|' || c.id),
       'report_workspaces', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM report_workspaces c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- report_workspaces.inspection_id -> inspections
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_workspaces.inspection_id|' || c.id),
       'report_workspaces', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'inspection_id', 'value', c.inspection_id, 'parent', 'inspections')
FROM report_workspaces c
LEFT JOIN inspections p ON p.id = c.inspection_id
WHERE c.inspection_id IS NOT NULL AND p.id IS NULL;

-- report_photos.workspace_id -> report_workspaces
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_photos.workspace_id|' || c.id),
       'report_photos', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'workspace_id', 'value', c.workspace_id, 'parent', 'report_workspaces')
FROM report_photos c
LEFT JOIN report_workspaces p ON p.id = c.workspace_id
WHERE c.workspace_id IS NOT NULL AND p.id IS NULL;

-- report_photos.project_id -> projects
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_photos.project_id|' || c.id),
       'report_photos', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM report_photos c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- report_photos.media_asset_id -> media_assets
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_photos.media_asset_id|' || c.id),
       'report_photos', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'media_asset_id', 'value', c.media_asset_id, 'parent', 'media_assets')
FROM report_photos c
LEFT JOIN media_assets p ON p.id = c.media_asset_id
WHERE c.media_asset_id IS NOT NULL AND p.id IS NULL;

-- report_archives.compound_id -> report_compounds
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_archives.compound_id|' || c.id),
       'report_archives', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'compound_id', 'value', c.compound_id, 'parent', 'report_compounds')
FROM report_archives c
LEFT JOIN report_compounds p ON p.id = c.compound_id
WHERE c.compound_id IS NOT NULL AND p.id IS NULL;

-- license_conditions.license_id -> operating_licenses
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('license_conditions.license_id|' || c.id),
       'license_conditions', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'license_id', 'value', c.license_id, 'parent', 'operating_licenses')
FROM license_conditions c
LEFT JOIN operating_licenses p ON p.id = c.license_id
WHERE c.license_id IS NOT NULL AND p.id IS NULL;

-- erosions.project_id -> projects
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('erosions.project_id|' || c.id),
       'erosions', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM erosions c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- report_jobs.workspace_id -> report_workspaces
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_jobs.workspace_id|' || c.id),
       'report_jobs', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'workspace_id', 'value', c.workspace_id, 'parent', 'report_workspaces')
FROM report_jobs c
LEFT JOIN report_workspaces p ON p.id = c.workspace_id
WHERE c.workspace_id IS NOT NULL AND p.id IS NULL;

-- report_jobs.project_id -> projects
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_jobs.project_id|' || c.id),
       'report_jobs', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM report_jobs c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- report_jobs.compound_id -> report_compounds
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_jobs.compound_id|' || c.id),
       'report_jobs', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'compound_id', 'value', c.compound_id, 'parent', 'report_compounds')
FROM report_jobs c
LEFT JOIN report_compounds p ON p.id = c.compound_id
WHERE c.compound_id IS NOT NULL AND p.id IS NULL;

-- report_jobs.dossier_id -> project_dossiers
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_jobs.dossier_id|' || c.id),
       'report_jobs', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'dossier_id', 'value', c.dossier_id, 'parent', 'project_dossiers')
FROM report_jobs c
LEFT JOIN project_dossiers p ON p.id = c.dossier_id
WHERE c.dossier_id IS NOT NULL AND p.id IS NULL;

-- project_dossiers.project_id -> projects
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('project_dossiers.project_id|' || c.id),
       'project_dossiers', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM project_dossiers c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- project_report_defaults.project_id -> projects (project_id e a PK)
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('project_report_defaults.project_id|' || c.project_id),
       'project_report_defaults', c.project_id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM project_report_defaults c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- project_photo_exports.project_id -> projects (PK e token)
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('project_photo_exports.project_id|' || c.token),
       'project_photo_exports', c.token, 'error', 'fk_orphan',
       jsonb_build_object('column', 'project_id', 'value', c.project_id, 'parent', 'projects')
FROM project_photo_exports c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.project_id IS NOT NULL AND p.id IS NULL;

-- workspace_kmz_requests.workspace_id -> report_workspaces (PK e token)
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('workspace_kmz_requests.workspace_id|' || c.token),
       'workspace_kmz_requests', c.token, 'error', 'fk_orphan',
       jsonb_build_object('column', 'workspace_id', 'value', c.workspace_id, 'parent', 'report_workspaces')
FROM workspace_kmz_requests c
LEFT JOIN report_workspaces p ON p.id = c.workspace_id
WHERE c.workspace_id IS NOT NULL AND p.id IS NULL;

-- workspace_imports.workspace_id -> report_workspaces
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('workspace_imports.workspace_id|' || c.id),
       'workspace_imports', c.id, 'error', 'fk_orphan',
       jsonb_build_object('column', 'workspace_id', 'value', c.workspace_id, 'parent', 'report_workspaces')
FROM workspace_imports c
LEFT JOIN report_workspaces p ON p.id = c.workspace_id
WHERE c.workspace_id IS NOT NULL AND p.id IS NULL;

-- report_jobs.template_id -> report_templates
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_jobs.template_id|' || c.id),
       'report_jobs', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'template_id', 'value', c.template_id, 'parent', 'report_templates')
FROM report_jobs c
LEFT JOIN report_templates p ON p.id = c.template_id
WHERE c.template_id IS NOT NULL AND p.id IS NULL;

-- report_compounds.template_id -> report_templates
INSERT INTO migration_issues (id, entity_type, entity_id, severity, issue_code, details)
SELECT 'orphan-' || md5('report_compounds.template_id|' || c.id),
       'report_compounds', c.id, 'warning', 'fk_orphan',
       jsonb_build_object('column', 'template_id', 'value', c.template_id, 'parent', 'report_templates')
FROM report_compounds c
LEFT JOIN report_templates p ON p.id = c.template_id
WHERE c.template_id IS NOT NULL AND p.id IS NULL;
