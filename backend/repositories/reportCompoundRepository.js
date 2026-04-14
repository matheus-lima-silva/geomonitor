const {
    postgresStore,
    normalizeText,
    buildMetadata,
} = require('./common');

function hydrateCompoundRow(row) {
    return buildMetadata(row.payload, row);
}

async function list() {
    const result = await postgresStore.query(
        `
            SELECT id, nome, status, workspace_ids, order_json, shared_texts_json,
                   template_id, draft_state, payload, created_at, updated_at, updated_by
            FROM report_compounds
            ORDER BY updated_at DESC, id ASC
        `,
    );

    return result.rows.map((row) => hydrateCompoundRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            nome: row.nome,
            status: row.status,
            workspaceIds: row.workspace_ids || [],
            orderJson: row.order_json || [],
            sharedTextsJson: row.shared_texts_json || {},
            templateId: row.template_id,
            draftState: row.draft_state || {},
        },
    }));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    const result = await postgresStore.query(
        `
            SELECT id, nome, status, workspace_ids, order_json, shared_texts_json,
                   template_id, draft_state, payload, created_at, updated_at, updated_by
            FROM report_compounds
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateCompoundRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            nome: row.nome,
            status: row.status,
            workspaceIds: row.workspace_ids || [],
            orderJson: row.order_json || [],
            sharedTextsJson: row.shared_texts_json || {},
            templateId: row.template_id,
            draftState: row.draft_state || {},
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
    };

    await postgresStore.query(
        `
            INSERT INTO report_compounds (
                id, nome, status, workspace_ids, order_json, shared_texts_json,
                template_id, draft_state, payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9::jsonb, NOW(), NOW(), $10)
            ON CONFLICT (id)
            DO UPDATE SET
                nome = EXCLUDED.nome,
                status = EXCLUDED.status,
                workspace_ids = EXCLUDED.workspace_ids,
                order_json = EXCLUDED.order_json,
                shared_texts_json = EXCLUDED.shared_texts_json,
                template_id = EXCLUDED.template_id,
                draft_state = EXCLUDED.draft_state,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            normalizeText(nextPayload.nome) || 'Relatorio composto',
            normalizeText(nextPayload.status) || 'draft',
            JSON.stringify(nextPayload.workspaceIds || []),
            JSON.stringify(nextPayload.orderJson || []),
            JSON.stringify(nextPayload.sharedTextsJson || {}),
            normalizeText(nextPayload.templateId) || null,
            JSON.stringify(nextPayload.draftState || {}),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

module.exports = {
    list,
    getById,
    save,
};
