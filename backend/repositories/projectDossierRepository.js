const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    normalizeKey,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
    buildMetadata,
} = require('./common');

function hydrateDossierRow(row) {
    return buildMetadata(row.payload, row);
}

async function listByProjectId(projectId) {
    const normalizedProjectId = normalizeKey(projectId);
    if (!isPostgresBackend()) {
        const rows = await listFirestoreDocs('projectDossiers');
        return rows.filter((row) => normalizeKey(row.projectId) === normalizedProjectId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, project_id, status, scope_json, draft_state, payload, created_at, updated_at, updated_by
            FROM project_dossiers
            WHERE project_id = $1
            ORDER BY updated_at DESC, id ASC
        `,
        [normalizedProjectId],
    );

    return result.rows.map((row) => hydrateDossierRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.project_id,
            status: row.status,
            scopeJson: row.scope_json || {},
            draftState: row.draft_state || {},
        },
    }));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('projectDossiers', normalizedId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, project_id, status, scope_json, draft_state, payload, created_at, updated_at, updated_by
            FROM project_dossiers
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateDossierRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.project_id,
            status: row.status,
            scopeJson: row.scope_json || {},
            draftState: row.draft_state || {},
        },
    });
}

async function getByProjectAndId(projectId, dossierId) {
    const dossier = await getById(dossierId);
    if (!dossier) return null;
    return normalizeKey(dossier.projectId) === normalizeKey(projectId) ? dossier : null;
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
        projectId: normalizeKey(payload?.projectId || current?.projectId),
    };

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('projectDossiers', normalizedId, nextPayload, options);
    }

    await postgresStore.query(
        `
            INSERT INTO project_dossiers (
                id, project_id, status, scope_json, draft_state, payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, NOW(), NOW(), $7)
            ON CONFLICT (id)
            DO UPDATE SET
                project_id = EXCLUDED.project_id,
                status = EXCLUDED.status,
                scope_json = EXCLUDED.scope_json,
                draft_state = EXCLUDED.draft_state,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            nextPayload.projectId,
            normalizeText(nextPayload.status) || 'draft',
            JSON.stringify(nextPayload.scopeJson || {}),
            JSON.stringify(nextPayload.draftState || {}),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

module.exports = {
    listByProjectId,
    getById,
    getByProjectAndId,
    save,
};
