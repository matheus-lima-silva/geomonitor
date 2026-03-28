const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
    buildMetadata,
} = require('./common');
const projectDossierRepository = require('./projectDossierRepository');
const reportCompoundRepository = require('./reportCompoundRepository');
const workspaceKmzRequestRepository = require('./workspaceKmzRequestRepository');

function hydrateRow(row) {
    return buildMetadata(
        {
            ...(row.payload || {}),
            kind: row.kind,
            workspaceId: row.workspace_id,
            projectId: row.project_id,
            dossierId: row.dossier_id,
            compoundId: row.compound_id,
            templateId: row.template_id,
            statusExecucao: row.status_execucao,
            errorLog: row.error_log,
            outputDocxMediaId: row.output_docx_media_id,
            outputKmzMediaId: row.output_kmz_media_id,
        },
        row,
    );
}

const JOB_SELECT = `
    SELECT id, kind, workspace_id, project_id, dossier_id, compound_id, template_id,
           status_execucao, error_log, output_docx_media_id, output_kmz_media_id,
           payload, created_at, updated_at, updated_by
    FROM report_jobs
`;

async function syncParentJobStatus(job, overrides = {}) {
    if (!job || typeof job !== 'object') return;

    const updatedBy = normalizeText(overrides.updatedBy) || normalizeText(job.updatedBy) || 'API';
    const status = normalizeText(overrides.status || job.statusExecucao);
    const outputDocxMediaId = normalizeText(
        overrides.outputDocxMediaId !== undefined ? overrides.outputDocxMediaId : job.outputDocxMediaId,
    );
    const outputKmzMediaId = normalizeText(
        overrides.outputKmzMediaId !== undefined ? overrides.outputKmzMediaId : job.outputKmzMediaId,
    );
    const lastError = overrides.lastError !== undefined
        ? String(overrides.lastError || '')
        : String(job.errorLog || '');

    if (normalizeText(job.kind) === 'project_dossier' && normalizeText(job.dossierId)) {
        const current = await projectDossierRepository.getById(job.dossierId);
        if (!current) return;
        await projectDossierRepository.save({
            ...current,
            status: status || current.status || 'draft',
            lastJobId: job.id,
            outputDocxMediaId: outputDocxMediaId || current.outputDocxMediaId || '',
            lastError,
            updatedAt: new Date().toISOString(),
            updatedBy,
        }, { merge: true });
        return;
    }

    if (normalizeText(job.kind) === 'report_compound' && normalizeText(job.compoundId)) {
        const current = await reportCompoundRepository.getById(job.compoundId);
        if (!current) return;
        await reportCompoundRepository.save({
            ...current,
            status: status || current.status || 'draft',
            lastJobId: job.id,
            outputDocxMediaId: outputDocxMediaId || current.outputDocxMediaId || '',
            lastError,
            updatedAt: new Date().toISOString(),
            updatedBy,
        }, { merge: true });
        return;
    }

    if (normalizeText(job.kind) === 'workspace_kmz' && normalizeText(job.workspaceKmzToken)) {
        const current = await workspaceKmzRequestRepository.getByToken(job.workspaceKmzToken);
        if (!current) return;
        await workspaceKmzRequestRepository.save(job.workspaceKmzToken, {
            ...current,
            statusExecucao: status || current.statusExecucao || 'queued',
            lastJobId: job.id,
            outputKmzMediaId: outputKmzMediaId || current.outputKmzMediaId || '',
            lastError,
            updatedAt: new Date().toISOString(),
            updatedBy,
        }, { merge: true });
    }
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('reportJobs', normalizedId);
    }

    const result = await postgresStore.query(
        `${JOB_SELECT} WHERE id = $1 LIMIT 1`,
        [normalizedId],
    );

    return result.rows.length > 0 ? hydrateRow(result.rows[0]) : null;
}

async function list() {
    if (!isPostgresBackend()) {
        return listFirestoreDocs('reportJobs');
    }

    const result = await postgresStore.query(`${JOB_SELECT} ORDER BY created_at DESC, id ASC`);
    return result.rows.map((row) => hydrateRow(row));
}

async function listQueued() {
    if (!isPostgresBackend()) {
        const all = await listFirestoreDocs('reportJobs');
        return all.filter((item) => normalizeText(item.statusExecucao) === 'queued');
    }

    const result = await postgresStore.query(
        `${JOB_SELECT} WHERE status_execucao = 'queued' ORDER BY created_at ASC`,
    );
    return result.rows.map((row) => hydrateRow(row));
}

async function claimNext(meta = {}) {
    const updatedBy = normalizeText(meta.updatedBy) || 'API';
    if (!isPostgresBackend()) {
        const queued = await listQueued();
        if (queued.length === 0) return null;
        const job = queued[0];
        const saved = await saveFirestoreDoc('reportJobs', job.id, {
            ...job,
            statusExecucao: 'processing',
            updatedAt: new Date().toISOString(),
            updatedBy,
        }, { merge: true });
        await syncParentJobStatus(saved, { status: 'processing', updatedBy, lastError: '' });
        return saved;
    }

    const result = await postgresStore.query(
        `
            UPDATE report_jobs
            SET status_execucao = 'processing', updated_at = NOW(), updated_by = $1
            WHERE id = (
                SELECT id FROM report_jobs
                WHERE status_execucao = 'queued'
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, kind, workspace_id, project_id, dossier_id, compound_id, template_id,
                      status_execucao, error_log, output_docx_media_id, output_kmz_media_id,
                      payload, created_at, updated_at, updated_by
        `,
        [updatedBy],
    );

    const job = result.rows.length > 0 ? hydrateRow(result.rows[0]) : null;
    if (job) {
        await syncParentJobStatus(job, { status: 'processing', updatedBy, lastError: '' });
    }
    return job;
}

async function markComplete(id, outputIds = {}, meta = {}) {
    const normalizedId = normalizeText(id);
    const job = await getById(normalizedId);
    if (!job) return null;

    const nextPayload = {
        ...job,
        id: normalizedId,
        statusExecucao: 'completed',
        outputDocxMediaId: normalizeText(outputIds.outputDocxMediaId) || job.outputDocxMediaId,
        outputKmzMediaId: normalizeText(outputIds.outputKmzMediaId) || job.outputKmzMediaId,
        updatedAt: new Date().toISOString(),
        updatedBy: normalizeText(meta.updatedBy) || job.updatedBy || 'API',
    };

    const saved = await save(nextPayload, { merge: true });
    await syncParentJobStatus(saved, {
        status: 'completed',
        outputDocxMediaId: saved.outputDocxMediaId,
        outputKmzMediaId: saved.outputKmzMediaId,
        updatedBy: nextPayload.updatedBy,
        lastError: '',
    });
    return saved;
}

async function markFailed(id, errorLog, meta = {}) {
    const normalizedId = normalizeText(id);
    const job = await getById(normalizedId);
    if (!job) return null;

    const nextPayload = {
        ...job,
        id: normalizedId,
        statusExecucao: 'failed',
        errorLog: String(errorLog || ''),
        updatedAt: new Date().toISOString(),
        updatedBy: normalizeText(meta.updatedBy) || job.updatedBy || 'API',
    };

    const saved = await save(nextPayload, { merge: true });
    await syncParentJobStatus(saved, {
        status: 'failed',
        updatedBy: nextPayload.updatedBy,
        lastError: String(errorLog || ''),
    });
    return saved;
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
    list,
    listQueued,
    save,
    claimNext,
    markComplete,
    markFailed,
};
