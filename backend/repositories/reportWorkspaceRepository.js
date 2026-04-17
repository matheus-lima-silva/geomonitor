const {
    postgresStore,
    normalizeText,
    normalizeKey,
    buildMetadata,
} = require('./common');

function hydrateWorkspaceRow(row) {
    return buildMetadata(row.payload, row);
}

async function list() {
    const result = await postgresStore.query(
        `
            SELECT id, project_id, inspection_id, status, draft_state, payload, created_at, updated_at, updated_by
            FROM report_workspaces
            ORDER BY updated_at DESC, id ASC
        `,
    );

    return result.rows.map((row) => hydrateWorkspaceRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.project_id,
            inspectionId: row.inspection_id || null,
            status: row.status,
            draftState: row.draft_state || {},
        },
    }));
}

async function getById(id) {
    const normalizedId = normalizeText(id);

    const result = await postgresStore.query(
        `
            SELECT id, project_id, inspection_id, status, draft_state, payload, created_at, updated_at, updated_by
            FROM report_workspaces
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateWorkspaceRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.project_id,
            inspectionId: row.inspection_id || null,
            status: row.status,
            draftState: row.draft_state || {},
        },
    });
}

async function listByProject(projectId) {
    const normalizedProjectId = normalizeKey(projectId);
    const result = await postgresStore.query(
        `
            SELECT id, project_id, inspection_id, status, draft_state, payload, created_at, updated_at, updated_by
            FROM report_workspaces
            WHERE project_id = $1
            ORDER BY updated_at DESC, id ASC
        `,
        [normalizedProjectId],
    );

    return result.rows.map((row) => hydrateWorkspaceRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.project_id,
            inspectionId: row.inspection_id || null,
            status: row.status,
            draftState: row.draft_state || {},
        },
    }));
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
        projectId: normalizeKey(payload?.projectId || current?.projectId),
        inspectionId: normalizeText(payload?.inspectionId ?? current?.inspectionId) || null,
    };

    await postgresStore.query(
        `
            INSERT INTO report_workspaces (
                id,
                project_id,
                inspection_id,
                status,
                draft_state,
                payload,
                created_at,
                updated_at,
                updated_by
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW(), NOW(), $7)
            ON CONFLICT (id)
            DO UPDATE SET
                project_id = EXCLUDED.project_id,
                inspection_id = EXCLUDED.inspection_id,
                status = EXCLUDED.status,
                draft_state = EXCLUDED.draft_state,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            nextPayload.projectId,
            nextPayload.inspectionId,
            normalizeText(nextPayload.status) || 'draft',
            JSON.stringify(nextPayload.draftState || {}),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    await postgresStore.query('DELETE FROM report_workspaces WHERE id = $1', [normalizedId]);
}

async function countByProject(projectId) {
    const normalizedProjectId = normalizeKey(projectId);
    const result = await postgresStore.query(
        'SELECT COUNT(*)::int AS count FROM report_workspaces WHERE project_id = $1',
        [normalizedProjectId],
    );
    return result.rows[0]?.count || 0;
}

module.exports = {
    list,
    getById,
    listByProject,
    save,
    remove,
    countByProject,
};
