const {
    postgresStore,
    normalizeText,
    buildMetadata,
} = require('./common');

function hydrateWorkspaceImportRow(row) {
    return buildMetadata(row.payload, row);
}

async function listByWorkspace(workspaceId) {
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, source_type, status, warnings, summary_json,
                   payload, created_at, updated_at, updated_by
            FROM workspace_imports
            WHERE workspace_id = $1
            ORDER BY updated_at DESC, id ASC
        `,
        [normalizedWorkspaceId],
    );

    return result.rows.map((row) => hydrateWorkspaceImportRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            sourceType: row.source_type,
            status: row.status,
            warnings: row.warnings || [],
            summaryJson: row.summary_json || {},
        },
    }));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    const result = await postgresStore.query(
        `
            SELECT id, workspace_id, source_type, status, warnings, summary_json,
                   payload, created_at, updated_at, updated_by
            FROM workspace_imports
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateWorkspaceImportRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            workspaceId: row.workspace_id,
            sourceType: row.source_type,
            status: row.status,
            warnings: row.warnings || [],
            summaryJson: row.summary_json || {},
        },
    });
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
        workspaceId: normalizeText(payload?.workspaceId || current?.workspaceId),
    };

    await postgresStore.query(
        `
            INSERT INTO workspace_imports (
                id, workspace_id, source_type, status, warnings, summary_json,
                payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, NOW(), NOW(), $8)
            ON CONFLICT (id)
            DO UPDATE SET
                workspace_id = EXCLUDED.workspace_id,
                source_type = EXCLUDED.source_type,
                status = EXCLUDED.status,
                warnings = EXCLUDED.warnings,
                summary_json = EXCLUDED.summary_json,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            nextPayload.workspaceId,
            normalizeText(nextPayload.sourceType) || 'manual',
            normalizeText(nextPayload.status) || 'completed',
            JSON.stringify(nextPayload.warnings || []),
            JSON.stringify(nextPayload.summaryJson || {}),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

module.exports = {
    listByWorkspace,
    getById,
    save,
};
