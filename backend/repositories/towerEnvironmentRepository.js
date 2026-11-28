const { postgresStore, normalizeText } = require('./common');

// Atributos do meio fisico por torre (tabela tower_environment, migracao 0033).

function mapRow(row) {
    return {
        projectId: row.project_id,
        towerNumber: row.tower_number,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        ...(row.payload || {}),
        sources: row.sources || {},
        computedAt: row.computed_at instanceof Date ? row.computed_at.toISOString() : row.computed_at,
    };
}

async function listByProject(projectId) {
    const result = await postgresStore.query(
        `SELECT project_id, tower_number, latitude, longitude, payload, sources, computed_at
         FROM tower_environment WHERE project_id = $1`,
        [normalizeText(projectId)],
    );
    return result.rows.map(mapRow);
}

/** Chaves "PROJ|torre|lat|lon" ja calculadas (pula torres sem mudanca de coordenada). */
async function listComputedKeys(projectIds) {
    const result = await postgresStore.query(
        `SELECT project_id, tower_number, latitude, longitude FROM tower_environment
         WHERE project_id = ANY($1::text[])`,
        [projectIds],
    );
    return new Set(result.rows.map((r) => `${r.project_id}|${r.tower_number}|${Number(r.latitude).toFixed(6)}|${Number(r.longitude).toFixed(6)}`));
}

async function upsert({ projectId, towerNumber, latitude, longitude, payload, sources }) {
    await postgresStore.query(
        `
            INSERT INTO tower_environment (project_id, tower_number, latitude, longitude, payload, sources, computed_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
            ON CONFLICT (project_id, tower_number) DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                payload = EXCLUDED.payload,
                sources = EXCLUDED.sources,
                computed_at = NOW()
        `,
        [normalizeText(projectId), String(towerNumber), latitude, longitude, JSON.stringify(payload || {}), JSON.stringify(sources || {})],
    );
}

module.exports = {
    listByProject,
    listComputedKeys,
    upsert,
};
