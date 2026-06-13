const { postgresStore, normalizeText } = require('./common');

// Reconstroi a geometria materializada de um projeto (eixo da LT + torres) a
// partir de projects.payload. Mesma logica do backfill em
// migrations/0024_project_geometries.sql, aqui parametrizada por projeto e
// chamada no save do projeto (projectRepository.save).
//
// axis: LineString das linhaCoordenadas em ordem (>=2 vertices validos, senao NULL).
// towers: MultiPoint das torresCoordenadas (ST_Multi forca MultiPoint com 1 torre).
// Guarda regex ignora coordenada nao-numerica. geography(4326) => metros.
const UPSERT_SQL = `
    INSERT INTO project_geometries (project_id, axis, towers, updated_at)
    SELECT
        p.id,
        (
            SELECT ST_MakeLine(ARRAY_AGG(pt ORDER BY ord))
            FROM (
                SELECT ord, ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
                FROM jsonb_array_elements(p.payload->'linhaCoordenadas') WITH ORDINALITY AS t(e, ord)
                WHERE (e->>'longitude') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (e->>'latitude')  ~ '^-?[0-9]+(\\.[0-9]+)?$'
            ) s
            HAVING COUNT(*) >= 2
        )::geography AS axis,
        (
            SELECT ST_Multi(ST_Collect(ARRAY_AGG(pt)))
            FROM (
                SELECT ST_SetSRID(ST_MakePoint((e->>'longitude')::float8, (e->>'latitude')::float8), 4326) AS pt
                FROM jsonb_array_elements(p.payload->'torresCoordenadas') AS e
                WHERE (e->>'longitude') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (e->>'latitude')  ~ '^-?[0-9]+(\\.[0-9]+)?$'
            ) s
            HAVING COUNT(*) >= 1
        )::geography AS towers,
        NOW()
    FROM projects p
    WHERE p.id = $1
    ON CONFLICT (project_id) DO UPDATE SET
        axis = EXCLUDED.axis,
        towers = EXCLUDED.towers,
        updated_at = NOW()
`;

async function upsertFromProject(projectId) {
    const normalizedId = normalizeText(projectId);
    if (!normalizedId) return;
    await postgresStore.query(UPSERT_SQL, [normalizedId]);
}

async function getByProject(projectId) {
    const normalizedId = normalizeText(projectId);
    if (!normalizedId) return null;

    const result = await postgresStore.query(
        `
            SELECT project_id,
                   ST_AsText(axis::geometry) AS axis_wkt,
                   ST_AsText(towers::geometry) AS towers_wkt,
                   (axis IS NOT NULL) AS has_axis,
                   (towers IS NOT NULL) AS has_towers,
                   updated_at
            FROM project_geometries
            WHERE project_id = $1
        `,
        [normalizedId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        projectId: row.project_id,
        axisWkt: row.axis_wkt,
        towersWkt: row.towers_wkt,
        hasAxis: row.has_axis,
        hasTowers: row.has_towers,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
}

async function remove(projectId) {
    const normalizedId = normalizeText(projectId);
    if (!normalizedId) return;
    await postgresStore.query('DELETE FROM project_geometries WHERE project_id = $1', [normalizedId]);
}

module.exports = {
    upsertFromProject,
    getByProject,
    remove,
};
