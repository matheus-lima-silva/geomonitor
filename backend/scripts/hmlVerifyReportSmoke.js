const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const jobIds = ['JOB-SMOKE-DOSSIER-HML', 'JOB-SMOKE-COMPOUND-HML'];

  const jobs = (
    await client.query(
      `SELECT id, kind, status_execucao, output_docx_media_id, error_log
       FROM report_jobs
       WHERE id = ANY($1::text[])
       ORDER BY id`,
      [jobIds]
    )
  ).rows;

  const mediaIds = jobs.map((job) => job.output_docx_media_id).filter(Boolean);
  const media = mediaIds.length
    ? (
      await client.query(
        `SELECT id, purpose, linked_resource_type, linked_resource_id, status_execucao, content_type, size_bytes
         FROM media_assets
         WHERE id = ANY($1::text[])
         ORDER BY id`,
        [mediaIds]
      )
    ).rows
    : [];

  console.log(JSON.stringify({ jobs, media }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
