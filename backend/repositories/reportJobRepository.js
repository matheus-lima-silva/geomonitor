const {
    postgresStore,
    normalizeText,
    buildMetadata,
} = require('./common');
const projectDossierRepository = require('./projectDossierRepository');
const reportCompoundRepository = require('./reportCompoundRepository');
const workspaceKmzRequestRepository = require('./workspaceKmzRequestRepository');

const STUCK_PROCESSING_THRESHOLD_MINUTES = Number.parseInt(
    process.env.REPORT_JOB_STUCK_MINUTES || '15',
    10,
) || 15;
const AUTO_RECLAIM_MARKER = '[auto-reclaim]';

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
    const result = await postgresStore.query(
        `${JOB_SELECT} WHERE id = $1 LIMIT 1`,
        [normalizedId],
    );

    return result.rows.length > 0 ? hydrateRow(result.rows[0]) : null;
}

async function list() {
    const result = await postgresStore.query(`${JOB_SELECT} ORDER BY created_at DESC, id ASC`);
    return result.rows.map((row) => hydrateRow(row));
}

async function listQueued() {
    const result = await postgresStore.query(
        `${JOB_SELECT} WHERE status_execucao = 'queued' ORDER BY created_at ASC`,
    );
    return result.rows.map((row) => hydrateRow(row));
}

async function reclaimStuckJobs(meta = {}) {
    const updatedBy = normalizeText(meta.updatedBy) || 'API';
    const thresholdMinutes = Number.isFinite(Number(meta.thresholdMinutes))
        ? Math.max(1, Number(meta.thresholdMinutes))
        : STUCK_PROCESSING_THRESHOLD_MINUTES;

    const reclaimNote = `\n${AUTO_RECLAIM_MARKER} job estava em processing sem atualizacao ha >${thresholdMinutes} min (${new Date().toISOString()})`;

    const result = await postgresStore.query(
        `
            UPDATE report_jobs
            SET status_execucao = 'queued',
                error_log = COALESCE(error_log, '') || $1,
                updated_at = NOW(),
                updated_by = $2
            WHERE status_execucao = 'processing'
              AND updated_at < NOW() - (INTERVAL '1 minute' * $3)
            RETURNING id, kind, workspace_id, project_id, dossier_id, compound_id, template_id,
                      status_execucao, error_log, output_docx_media_id, output_kmz_media_id,
                      payload, created_at, updated_at, updated_by
        `,
        [reclaimNote, updatedBy, thresholdMinutes],
    );

    const reclaimed = result.rows.map((row) => hydrateRow(row));
    for (const job of reclaimed) {
        try {
            await syncParentJobStatus(job, {
                status: 'queued',
                updatedBy,
                lastError: String(job.errorLog || ''),
            });
        } catch (error) {
            console.error(`[report-jobs] falha ao sincronizar parent durante reclaim do job ${job.id}:`, error);
        }
    }
    return reclaimed;
}

async function claimNext(meta = {}) {
    const updatedBy = normalizeText(meta.updatedBy) || 'API';

    try {
        const reclaimed = await reclaimStuckJobs({ updatedBy });
        if (reclaimed.length > 0) {
            console.warn(
                `[report-jobs] ${reclaimed.length} job(s) recuperado(s) de processing stuck:`,
                reclaimed.map((job) => job.id),
            );
        }
    } catch (error) {
        console.error('[report-jobs] falha ao recuperar jobs stuck (prosseguindo com claim):', error);
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
        // Metadados do resultado devolvidos pelo worker (ex.: pendencias do
        // PAEC). Persistem no payload JSONB do job e voltam no GET /:id.
        ...(outputIds.resultMeta && typeof outputIds.resultMeta === 'object'
            ? { resultMeta: outputIds.resultMeta }
            : {}),
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

// Progresso intra-job (ex.: fotos processadas/total durante a geracao do KMZ).
// Persistido no workspace_kmz_request (consumido pelo polling do frontend) — NAO
// altera statusExecucao, so o campo `progress`. Best-effort: so rastreia
// workspace_kmz hoje; outros kinds sao no-op.
async function reportProgress(id, progress = {}, meta = {}) {
    const job = await getById(normalizeText(id));
    if (!job) return null;
    if (normalizeText(job.kind) !== 'workspace_kmz' || !normalizeText(job.workspaceKmzToken)) {
        return job;
    }
    const current = await workspaceKmzRequestRepository.getByToken(job.workspaceKmzToken);
    if (!current) return job;

    const total = Math.max(0, Math.trunc(Number(progress.total) || 0));
    const rawProcessed = Math.max(0, Math.trunc(Number(progress.processed) || 0));
    const processed = total > 0 ? Math.min(total, rawProcessed) : rawProcessed;
    const phase = normalizeText(progress.phase) || 'rendering';

    await workspaceKmzRequestRepository.save(job.workspaceKmzToken, {
        ...current,
        progress: { processed, total, phase, updatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
        updatedBy: normalizeText(meta.updatedBy) || current.updatedBy || 'worker',
    }, { merge: true });
    return job;
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
    };

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
    reclaimStuckJobs,
    markComplete,
    markFailed,
    reportProgress,
    STUCK_PROCESSING_THRESHOLD_MINUTES,
};
