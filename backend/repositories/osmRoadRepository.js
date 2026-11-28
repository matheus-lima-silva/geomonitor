const { postgresStore } = require('./common');

// Vias publicas do OSM (tabela osm_roads, migracao 0032) usadas para pintar os
// tracados de acesso por trecho. Carga em scripts/loadOsmRoads.js.

const CLASSIFY_CHUNK = 4000;
const DEFAULT_TOLERANCE_M = 15;

/**
 * Para cada ponto [lon, lat], a via publica mais proxima a ate `toleranceM`
 * metros: { surfaceClass, inferred } ou null (fora de via publica = acesso).
 */
async function classifyPoints(points, { toleranceM = DEFAULT_TOLERANCE_M } = {}) {
    const out = [];
    for (let start = 0; start < points.length; start += CLASSIFY_CHUNK) {
        const chunk = points.slice(start, start + CLASSIFY_CHUNK);
        const result = await postgresStore.query(
            `
                SELECT s.idx, r.surface_class, r.surface_inferred
                FROM unnest($1::float8[], $2::float8[]) WITH ORDINALITY AS s(lon, lat, idx)
                LEFT JOIN LATERAL (
                    SELECT o.surface_class, o.surface_inferred
                    FROM osm_roads o
                    WHERE ST_DWithin(o.geom, ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography, $3)
                    ORDER BY o.geom <-> ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography
                    LIMIT 1
                ) r ON true
                ORDER BY s.idx
            `,
            [chunk.map((p) => p[0]), chunk.map((p) => p[1]), toleranceM],
        );
        result.rows.forEach((row) => {
            out.push(row.surface_class ? { surfaceClass: row.surface_class, inferred: Boolean(row.surface_inferred) } : null);
        });
    }
    return out;
}

/** true quando alguma carga do OSM cobre (intersecta) o envelope dado. */
async function hasCoverage({ minLon, minLat, maxLon, maxLat }) {
    const result = await postgresStore.query(
        `SELECT EXISTS (
            SELECT 1 FROM osm_road_loads
            WHERE ST_Intersects(bbox, ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography)
        ) AS covered`,
        [minLon, minLat, maxLon, maxLat],
    );
    return Boolean(result.rows[0]?.covered);
}

/** Upsert de vias: [{ osmId, highway, surface, surfaceClass, surfaceInferred, name, coordinates }]. */
async function upsertMany(roads) {
    let written = 0;
    for (let start = 0; start < roads.length; start += 500) {
        const chunk = roads.slice(start, start + 500);
        await postgresStore.query(
            `
                INSERT INTO osm_roads (osm_id, highway, surface, surface_class, surface_inferred, name, geom, loaded_at)
                SELECT r.osm_id, r.highway, r.surface, r.surface_class, r.surface_inferred, r.name,
                       ST_GeomFromGeoJSON(r.geojson)::geography, NOW()
                FROM jsonb_to_recordset($1::jsonb) AS r(
                    osm_id bigint, highway text, surface text, surface_class text,
                    surface_inferred boolean, name text, geojson text
                )
                ON CONFLICT (osm_id) DO UPDATE SET
                    highway = EXCLUDED.highway,
                    surface = EXCLUDED.surface,
                    surface_class = EXCLUDED.surface_class,
                    surface_inferred = EXCLUDED.surface_inferred,
                    name = EXCLUDED.name,
                    geom = EXCLUDED.geom,
                    loaded_at = NOW()
            `,
            [JSON.stringify(chunk.map((r) => ({
                osm_id: r.osmId,
                highway: r.highway,
                surface: r.surface || null,
                surface_class: r.surfaceClass,
                surface_inferred: Boolean(r.surfaceInferred),
                name: r.name || null,
                geojson: JSON.stringify({ type: 'LineString', coordinates: r.coordinates }),
            })))],
        );
        written += chunk.length;
    }
    return written;
}

async function recordLoad({ minLon, minLat, maxLon, maxLat, projectIds = [], ways = 0, source = 'overpass' }) {
    await postgresStore.query(
        `INSERT INTO osm_road_loads (bbox, project_ids, ways, source)
         VALUES (ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography, $5, $6, $7)`,
        [minLon, minLat, maxLon, maxLat, projectIds, ways, source],
    );
}

/** Envelopes ja carregados ([{ minLon, minLat, maxLon, maxLat }]), para retomar cargas. */
async function listLoadedBboxes() {
    const result = await postgresStore.query(
        `SELECT ST_XMin(bbox::geometry) AS min_lon, ST_YMin(bbox::geometry) AS min_lat,
                ST_XMax(bbox::geometry) AS max_lon, ST_YMax(bbox::geometry) AS max_lat
         FROM osm_road_loads`,
    );
    return result.rows.map((row) => ({
        minLon: Number(row.min_lon), minLat: Number(row.min_lat), maxLon: Number(row.max_lon), maxLat: Number(row.max_lat),
    }));
}

module.exports = {
    classifyPoints,
    listLoadedBboxes,
    hasCoverage,
    upsertMany,
    recordLoad,
};
