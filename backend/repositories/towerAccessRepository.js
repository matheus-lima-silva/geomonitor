const { postgresStore, normalizeText } = require('./common');

// Acessos por torre e rotas-guia do empreendimento (tabela tower_accesses,
// migracao 0032). geom e a linha inteira; segments guarda os trechos coloridos.

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        projectId: row.project_id,
        towerNumber: row.tower_number,
        kind: row.kind,
        name: row.name,
        geometry: row.geojson ? JSON.parse(row.geojson) : null,
        lengthM: Number(row.length_m) || 0,
        segments: Array.isArray(row.segments) ? row.segments : [],
        source: row.source && typeof row.source === 'object' ? row.source : {},
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        updatedBy: row.updated_by || null,
    };
}

const SELECT_COLUMNS = `
    id, project_id, tower_number, kind, name, ST_AsGeoJSON(geom::geometry, 7) AS geojson,
    length_m, segments, source, created_at, updated_at, updated_by
`;

async function listByProject(projectId) {
    const result = await postgresStore.query(
        `SELECT ${SELECT_COLUMNS} FROM tower_accesses WHERE project_id = $1
         ORDER BY kind, tower_number NULLS LAST, created_at`,
        [normalizeText(projectId)],
    );
    return result.rows.map(mapRow);
}

async function getById(projectId, id) {
    const result = await postgresStore.query(
        `SELECT ${SELECT_COLUMNS} FROM tower_accesses WHERE project_id = $1 AND id = $2`,
        [normalizeText(projectId), normalizeText(id)],
    );
    return mapRow(result.rows[0]);
}

/** Insere varios numa transacao. `replaceIds`: acessos substituidos (apagados antes). */
async function insertMany(projectId, items, { updatedBy = null, replaceIds = [] } = {}) {
    const client = await postgresStore.connect();
    try {
        await client.query('BEGIN');
        if (replaceIds.length > 0) {
            await client.query(
                'DELETE FROM tower_accesses WHERE project_id = $1 AND id = ANY($2::text[])',
                [normalizeText(projectId), replaceIds],
            );
        }
        const inserted = [];
        for (const item of items) {
            const result = await client.query(
                `
                    INSERT INTO tower_accesses (id, project_id, tower_number, kind, name, geom, length_m, segments, source, updated_by)
                    VALUES ($1, $2, $3, $4, $5, ST_GeomFromGeoJSON($6)::geography, $7, $8::jsonb, $9::jsonb, $10)
                    RETURNING ${SELECT_COLUMNS}
                `,
                [
                    item.id, normalizeText(projectId), item.towerNumber || null, item.kind, item.name || '',
                    JSON.stringify(item.geometry), item.lengthM || 0, JSON.stringify(item.segments || []),
                    JSON.stringify(item.source || {}), updatedBy,
                ],
            );
            inserted.push(mapRow(result.rows[0]));
        }
        await client.query('COMMIT');
        return inserted;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/** Atualiza torre, tipo, nome e trechos (repintura manual). */
async function update(projectId, id, { towerNumber, kind, name, segments }, { updatedBy = null } = {}) {
    const result = await postgresStore.query(
        `
            UPDATE tower_accesses SET
                tower_number = $3,
                kind = $4,
                name = $5,
                segments = $6::jsonb,
                updated_at = NOW(),
                updated_by = $7
            WHERE project_id = $1 AND id = $2
            RETURNING ${SELECT_COLUMNS}
        `,
        [normalizeText(projectId), normalizeText(id), towerNumber || null, kind, name || '', JSON.stringify(segments || []), updatedBy],
    );
    return mapRow(result.rows[0]);
}

async function remove(projectId, id) {
    const result = await postgresStore.query(
        'DELETE FROM tower_accesses WHERE project_id = $1 AND id = $2',
        [normalizeText(projectId), normalizeText(id)],
    );
    return result.rowCount > 0;
}

module.exports = {
    listByProject,
    getById,
    insertMany,
    update,
    remove,
};
