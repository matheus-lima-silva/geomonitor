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

/**
 * Junta dados do MapBiomas no payload ja calculado (WorldCover/relevo), em lote.
 * O MapBiomas vira a fonte principal dos usos do solo sugeridos; as sugestoes do
 * WorldCover ficam em worldcoverUsosSoloSugeridos. Retorna quantas torres foram
 * atualizadas (torres sem linha em tower_environment sao ignoradas).
 * rows: [{ projectId, towerNumber, mapbiomas: { ano, colecao, cobertura, ... } }]
 */
async function mergeMapbiomas(rows, source) {
    let updated = 0;
    for (let start = 0; start < rows.length; start += 1000) {
        const chunk = rows.slice(start, start + 1000);
        const result = await postgresStore.query(
            `
                UPDATE tower_environment te SET
                    payload = te.payload
                        || jsonb_build_object(
                            'mapbiomas', r.mapbiomas,
                            'worldcoverUsosSoloSugeridos', COALESCE(te.payload->'worldcoverUsosSoloSugeridos', te.payload->'usosSoloSugeridos', '[]'::jsonb),
                            'usosSoloSugeridos', r.mapbiomas->'usosSoloSugeridos',
                            'usoSoloOutroSugerido', r.mapbiomas->'usoSoloOutroSugerido',
                            'usosSoloFonte', $2::text
                        ),
                    sources = te.sources || jsonb_build_object('coberturaMapbiomas', $3::jsonb)
                FROM jsonb_to_recordset($1::jsonb) AS r(project_id text, tower_number text, mapbiomas jsonb)
                WHERE te.project_id = r.project_id AND te.tower_number = r.tower_number
            `,
            [
                JSON.stringify(chunk.map((row) => ({ project_id: row.projectId, tower_number: String(row.towerNumber), mapbiomas: row.mapbiomas }))),
                source.rotulo,
                JSON.stringify(source),
            ],
        );
        updated += result.rowCount;
    }
    return updated;
}

module.exports = {
    mergeMapbiomas,
    listByProject,
    listComputedKeys,
    upsert,
};
