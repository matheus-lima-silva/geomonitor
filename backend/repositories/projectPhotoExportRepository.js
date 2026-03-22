const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    normalizeKey,
    getFirestoreDoc,
    saveFirestoreDoc,
    buildMetadata,
} = require('./common');

function hydrateExportRow(row) {
    return buildMetadata(row.payload, row);
}

async function getByToken(token) {
    const normalizedToken = normalizeText(token);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('projectPhotoExports', normalizedToken);
    }

    const result = await postgresStore.query(
        `
            SELECT token AS id, project_id, folder_mode, selection_ids, filters, item_count,
                   status_execucao, expires_at, payload, created_at, updated_at, updated_by
            FROM project_photo_exports
            WHERE token = $1
            LIMIT 1
        `,
        [normalizedToken],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateExportRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            token: row.id,
            projectId: row.project_id,
            folderMode: row.folder_mode,
            selectionIds: row.selection_ids || [],
            filters: row.filters || {},
            itemCount: row.item_count,
            statusExecucao: row.status_execucao,
            expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
        },
    });
}

async function save(token, payload, options = {}) {
    const normalizedToken = normalizeText(token);
    const current = options.merge ? await getByToken(normalizedToken) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        token: normalizedToken,
        projectId: normalizeKey(payload?.projectId || current?.projectId),
    };

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('projectPhotoExports', normalizedToken, nextPayload, options);
    }

    await postgresStore.query(
        `
            INSERT INTO project_photo_exports (
                token, project_id, folder_mode, selection_ids, filters, item_count,
                status_execucao, expires_at, payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb, NOW(), NOW(), $10)
            ON CONFLICT (token)
            DO UPDATE SET
                project_id = EXCLUDED.project_id,
                folder_mode = EXCLUDED.folder_mode,
                selection_ids = EXCLUDED.selection_ids,
                filters = EXCLUDED.filters,
                item_count = EXCLUDED.item_count,
                status_execucao = EXCLUDED.status_execucao,
                expires_at = EXCLUDED.expires_at,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedToken,
            nextPayload.projectId,
            normalizeText(nextPayload.folderMode) || 'tower',
            JSON.stringify(nextPayload.selectionIds || []),
            JSON.stringify(nextPayload.filters || {}),
            Number.isFinite(Number(nextPayload.itemCount)) ? Number(nextPayload.itemCount) : 0,
            normalizeText(nextPayload.statusExecucao) || 'queued',
            nextPayload.expiresAt ? new Date(nextPayload.expiresAt) : null,
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getByToken(normalizedToken);
}

async function getByProjectAndToken(projectId, token) {
    const entry = await getByToken(token);
    if (!entry) return null;
    return normalizeKey(entry.projectId) === normalizeKey(projectId) ? entry : null;
}

module.exports = {
    getByToken,
    getByProjectAndToken,
    save,
};
