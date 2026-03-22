const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    getFirestoreDoc,
    saveFirestoreDoc,
} = require('./common');

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('reportJobs', normalizedId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, payload
            FROM report_jobs
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    return result.rows.length > 0 ? { id: result.rows[0].id, ...(result.rows[0].payload || {}) } : null;
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
    };

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('reportJobs', normalizedId, nextPayload, options);
    }

    await postgresStore.query(
        `
            INSERT INTO report_jobs (
                id, kind, workspace_id, project_id, dossier_id, compound_id, template_id,
                status_execucao, error_log, output_docx_media_id, output_kmz_media_id,
                payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW(), NOW(), $13)
            ON CONFLICT (id)
            DO UPDATE SET
                kind = EXCLUDED.kind,
                workspace_id = EXCLUDED.workspace_id,
                project_id = EXCLUDED.project_id,
                dossier_id = EXCLUDED.dossier_id,
                compound_id = EXCLUDED.compound_id,
                template_id = EXCLUDED.template_id,
                status_execucao = EXCLUDED.status_execucao,
                error_log = EXCLUDED.error_log,
                output_docx_media_id = EXCLUDED.output_docx_media_id,
                output_kmz_media_id = EXCLUDED.output_kmz_media_id,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            normalizeText(nextPayload.kind) || null,
            normalizeText(nextPayload.workspaceId) || null,
            normalizeText(nextPayload.projectId) || null,
            normalizeText(nextPayload.dossierId) || null,
            normalizeText(nextPayload.compoundId) || null,
            normalizeText(nextPayload.templateId) || null,
            normalizeText(nextPayload.statusExecucao) || 'queued',
            normalizeText(nextPayload.errorLog) || null,
            normalizeText(nextPayload.outputDocxMediaId) || null,
            normalizeText(nextPayload.outputKmzMediaId) || null,
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

module.exports = {
    getById,
    save,
};
