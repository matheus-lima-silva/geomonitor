const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const now = new Date().toISOString();
  const projectId = 'PRJ-SMOKE-HML';
  const workspaceId = 'WS-SMOKE-HML';
  const dossierId = 'DOS-SMOKE-HML';
  const compoundId = 'RC-SMOKE-HML';
  const jobDossierId = 'JOB-SMOKE-DOSSIER-HML';
  const jobCompoundId = 'JOB-SMOKE-COMPOUND-HML';

  const scope = {
    includeLicencas: false,
    includeInspecoes: false,
    includeErosoes: false,
    includeEntregas: false,
    includeWorkspaces: true,
    includeFotos: false,
  };

  await client.query(
    `INSERT INTO projects (id, payload, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (id)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [projectId, JSON.stringify({ id: projectId, nome: 'Projeto Smoke HML', lt: 'LT Smoke HML' }), 'smoke-script']
  );

  await client.query(
    `INSERT INTO report_workspaces (id, project_id, status, draft_state, payload, updated_at, updated_by)
     VALUES ($1, $2, 'ready', '{}'::jsonb, $3::jsonb, NOW(), $4)
     ON CONFLICT (id)
     DO UPDATE SET project_id = EXCLUDED.project_id, status = EXCLUDED.status, payload = EXCLUDED.payload, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [workspaceId, projectId, JSON.stringify({ id: workspaceId, projectId, nome: 'Workspace Smoke HML', status: 'ready' }), 'smoke-script']
  );

  await client.query(
    `INSERT INTO project_dossiers (id, project_id, status, scope_json, draft_state, payload, updated_at, updated_by)
     VALUES ($1, $2, 'queued', $3::jsonb, '{}'::jsonb, $4::jsonb, NOW(), $5)
     ON CONFLICT (id)
     DO UPDATE SET
       project_id = EXCLUDED.project_id,
       status = EXCLUDED.status,
       scope_json = EXCLUDED.scope_json,
       payload = EXCLUDED.payload,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [dossierId, projectId, JSON.stringify(scope), JSON.stringify({ id: dossierId, projectId, nome: 'Dossie Smoke HML', status: 'queued', scopeJson: scope }), 'smoke-script']
  );

  await client.query(
    `INSERT INTO report_compounds (id, nome, status, workspace_ids, order_json, shared_texts_json, draft_state, payload, updated_at, updated_by)
     VALUES ($1, $2, 'queued', $3::jsonb, $4::jsonb, '{}'::jsonb, '{}'::jsonb, $5::jsonb, NOW(), $6)
     ON CONFLICT (id)
     DO UPDATE SET
       nome = EXCLUDED.nome,
       status = EXCLUDED.status,
       workspace_ids = EXCLUDED.workspace_ids,
       order_json = EXCLUDED.order_json,
       payload = EXCLUDED.payload,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [
      compoundId,
      'Relatorio Composto Smoke HML',
      JSON.stringify([workspaceId]),
      JSON.stringify([workspaceId]),
      JSON.stringify({ id: compoundId, nome: 'Relatorio Composto Smoke HML', status: 'queued', workspaceIds: [workspaceId], orderJson: [workspaceId] }),
      'smoke-script',
    ]
  );

  await client.query(
    `INSERT INTO report_jobs (id, kind, project_id, dossier_id, status_execucao, payload, created_at, updated_at, updated_by)
     VALUES ($1, 'project_dossier', $2, $3, 'queued', '{}'::jsonb, NOW(), NOW(), $4)
     ON CONFLICT (id)
     DO UPDATE SET
       kind = EXCLUDED.kind,
       project_id = EXCLUDED.project_id,
       dossier_id = EXCLUDED.dossier_id,
       status_execucao = 'queued',
       error_log = NULL,
       output_docx_media_id = NULL,
       output_kmz_media_id = NULL,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [jobDossierId, projectId, dossierId, 'smoke-script']
  );

  await client.query(
    `INSERT INTO report_jobs (id, kind, compound_id, status_execucao, payload, created_at, updated_at, updated_by)
     VALUES ($1, 'report_compound', $2, 'queued', '{}'::jsonb, NOW(), NOW(), $3)
     ON CONFLICT (id)
     DO UPDATE SET
       kind = EXCLUDED.kind,
       compound_id = EXCLUDED.compound_id,
       status_execucao = 'queued',
       error_log = NULL,
       output_docx_media_id = NULL,
       output_kmz_media_id = NULL,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [jobCompoundId, compoundId, 'smoke-script']
  );

  const { rows } = await client.query(
    'SELECT id, kind, status_execucao FROM report_jobs WHERE id IN ($1, $2) ORDER BY id',
    [jobDossierId, jobCompoundId]
  );

  console.log(JSON.stringify({ seededAt: now, jobs: rows }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
