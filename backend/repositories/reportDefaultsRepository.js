const {
    postgresStore,
    isPostgresBackend,
    normalizeKey,
    getFirestoreDoc,
    saveFirestoreDoc,
    buildMetadata,
} = require('./common');

function hydrateReportDefaultsRow(row) {
    return buildMetadata(row.payload, row);
}

async function getByProjectId(projectId) {
    const normalizedProjectId = normalizeKey(projectId);

    if (!isPostgresBackend()) {
        return getFirestoreDoc('projectReportDefaults', normalizedProjectId);
    }

    const result = await postgresStore.query(
        `
            SELECT project_id AS id, faixa_buffer_meters_side, tower_suggestion_radius_meters,
                   base_tower_radius_meters, textos_base, preferencias, payload,
                   created_at, updated_at, updated_by
            FROM project_report_defaults
            WHERE project_id = $1
            LIMIT 1
        `,
        [normalizedProjectId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return hydrateReportDefaultsRow({
        ...row,
        payload: {
            ...(row.payload || {}),
            projectId: row.id,
            faixaBufferMetersSide: row.faixa_buffer_meters_side,
            towerSuggestionRadiusMeters: row.tower_suggestion_radius_meters,
            baseTowerRadiusMeters: row.base_tower_radius_meters,
            textosBase: row.textos_base || {},
            preferencias: row.preferencias || {},
        },
    });
}

async function save(projectId, payload, options = {}) {
    const normalizedProjectId = normalizeKey(projectId);

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('projectReportDefaults', normalizedProjectId, {
            ...payload,
            projectId: normalizedProjectId,
        }, options);
    }

    const current = options.merge ? await getByProjectId(normalizedProjectId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        projectId: normalizedProjectId,
    };

    await postgresStore.query(
        `
            INSERT INTO project_report_defaults (
                project_id,
                faixa_buffer_meters_side,
                tower_suggestion_radius_meters,
                base_tower_radius_meters,
                textos_base,
                preferencias,
                payload,
                created_at,
                updated_at,
                updated_by
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, NOW(), NOW(), $8)
            ON CONFLICT (project_id)
            DO UPDATE SET
                faixa_buffer_meters_side = EXCLUDED.faixa_buffer_meters_side,
                tower_suggestion_radius_meters = EXCLUDED.tower_suggestion_radius_meters,
                base_tower_radius_meters = EXCLUDED.base_tower_radius_meters,
                textos_base = EXCLUDED.textos_base,
                preferencias = EXCLUDED.preferencias,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedProjectId,
            Number.isFinite(Number(nextPayload.faixaBufferMetersSide)) ? Number(nextPayload.faixaBufferMetersSide) : 200,
            Number.isFinite(Number(nextPayload.towerSuggestionRadiusMeters)) ? Number(nextPayload.towerSuggestionRadiusMeters) : 300,
            Number.isFinite(Number(nextPayload.baseTowerRadiusMeters)) ? Number(nextPayload.baseTowerRadiusMeters) : 30,
            JSON.stringify(nextPayload.textosBase || {}),
            JSON.stringify(nextPayload.preferencias || {}),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getByProjectId(normalizedProjectId);
}

module.exports = {
    getByProjectId,
    save,
};
