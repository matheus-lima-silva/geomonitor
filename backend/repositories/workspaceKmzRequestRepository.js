const {
    postgresStore,
    normalizeText,
    buildMetadata,
} = require('./common');

function hydrateWorkspaceKmzRow(row) {
    return buildMetadata(row.payload, row);
}

async function getByToken(token) {
    const normalizedToken = normalizeText(token);
    const result = await postgresStore.query(
        `
            SELECT token AS id, workspace_id, status_execucao, expires_at, payload,
                   created_at, updated_at, updated_by
            FROM workspace_kmz_requests
            WHERE token = $1
            LIMIT 1
        `,
        [normalizedToken],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateWorkspaceKmzRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            token: row.id,
            workspaceId: row.workspace_id,
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
        workspaceId: normalizeText(payload?.workspaceId || current?.workspaceId),
    };

    await postgresStore.query(
        `
            INSERT INTO workspace_kmz_requests (
                token, workspace_id, status_execucao, expires_at, payload,
                created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW(), $6)
            ON CONFLICT (token)
            DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                status_execucao = EXCLUDED.status_execucao,
                expires_at = EXCLUDED.expires_at,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedToken,
            nextPayload.workspaceId,
            normalizeText(nextPayload.statusExecucao) || 'queued',
            nextPayload.expiresAt ? new Date(nextPayload.expiresAt) : null,
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getByToken(normalizedToken);
}

async function getByWorkspaceAndToken(workspaceId, token) {
    const entry = await getByToken(token);
    if (!entry) return null;
    return normalizeText(entry.workspaceId) === normalizeText(workspaceId) ? entry : null;
}

module.exports = {
    getByToken,
    getByWorkspaceAndToken,
    save,
};
