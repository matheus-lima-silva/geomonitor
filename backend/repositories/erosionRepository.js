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

function normalizeNumeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeCriticality(payload = {}) {
    const source = payload.criticalidade
        || payload.criticalidadeV2
        || payload.criticidadeV2
        || payload.criticalityV2
        || payload.criticality
        || null;

    if (!source || typeof source !== 'object') return {};

    return {
        code: normalizeText(source.codigo || source.code),
        score: normalizeNumeric(source.criticidade_score || source.score || source.valor),
    };
}

function normalizeInspectionIds(payload = {}) {
    const values = [
        ...(Array.isArray(payload.vistoriaIds) ? payload.vistoriaIds : []),
        ...(Array.isArray(payload.inspectionIds) ? payload.inspectionIds : []),
        payload.vistoriaId,
        payload.inspectionId,
    ];

    return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function buildProjectId(payload = {}) {
    return normalizeKey(payload.projectId || payload.projetoId);
}

function hydrateRow(row) {
    return buildMetadata({
        ...(row.payload || {}),
        ...(row.project_id ? { projectId: row.project_id } : {}),
        ...(row.status ? { status: row.status } : {}),
        ...(row.criticality_code ? { criticalityCode: row.criticality_code } : {}),
        ...(row.criticality_score !== undefined ? { criticalityScore: row.criticality_score } : {}),
        ...(row.latitude !== undefined ? { latitude: row.latitude } : {}),
        ...(row.longitude !== undefined ? { longitude: row.longitude } : {}),
        ...(row.inspection_ids ? { vistoriaIds: row.inspection_ids } : {}),
    }, row);
}

async function list() {
    if (!isPostgresBackend()) {
        return listFirestoreDocs('erosions');
    }

    const result = await postgresStore.query(
        `
            SELECT id, project_id, status, criticality_code, criticality_score,
                   inspection_ids, latitude, longitude, payload, created_at, updated_at, updated_by
            FROM erosions
            ORDER BY updated_at DESC, id ASC
        `,
    );

    return result.rows.map((row) => hydrateRow(row));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('erosions', normalizedId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, project_id, status, criticality_code, criticality_score,
                   inspection_ids, latitude, longitude, payload, created_at, updated_at, updated_by
            FROM erosions
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    return hydrateRow(result.rows[0]);
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
        return saveFirestoreDoc('erosions', normalizedId, nextPayload, options);
    }

    const criticality = normalizeCriticality(nextPayload);
    const inspectionIds = normalizeInspectionIds(nextPayload);

    await postgresStore.query(
        `
            INSERT INTO erosions (
                id, project_id, status, criticality_code, criticality_score,
                inspection_ids, latitude, longitude, payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, NOW(), NOW(), $10)
            ON CONFLICT (id)
            DO UPDATE SET
                project_id = EXCLUDED.project_id,
                status = EXCLUDED.status,
                criticality_code = EXCLUDED.criticality_code,
                criticality_score = EXCLUDED.criticality_score,
                inspection_ids = EXCLUDED.inspection_ids,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            buildProjectId(nextPayload) || null,
            normalizeText(nextPayload.status) || null,
            criticality.code || null,
            criticality.score,
            JSON.stringify(inspectionIds),
            normalizeNumeric(nextPayload.latitude),
            normalizeNumeric(nextPayload.longitude),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return require('../data').getDataStore().deleteDoc('erosions', normalizedId);
    }

    await postgresStore.query('DELETE FROM erosions WHERE id = $1', [normalizedId]);
}

async function countByProject(projectId) {
    const normalizedProjectId = normalizeKey(projectId);
    if (!isPostgresBackend()) {
        const rows = await list();
        return rows.filter((row) => buildProjectId(row) === normalizedProjectId).length;
    }

    const result = await postgresStore.query(
        'SELECT COUNT(*)::int AS count FROM erosions WHERE project_id = $1',
        [normalizedProjectId],
    );

    return result.rows[0]?.count || 0;
}

module.exports = {
    list,
    getById,
    save,
    remove,
    countByProject,
};
