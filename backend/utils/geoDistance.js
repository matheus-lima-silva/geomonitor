// Fase 6.3/6.4: calculo de distancias geograficas via PostGIS contra a geometria
// materializada do projeto (project_geometries). Uma unica query por ponto.
// geography(4326) => distancias em METROS.
const postgresStore = require('../data/postgresStore');

const DEFAULT_FAIXA_BUFFER_M = 200;
const DEFAULT_TOWER_RADIUS_M = 30;

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Distancia de um ponto (lat/lon) ao eixo e a torre mais proxima do projeto, e os
 * flags de dentro-da-faixa / dentro-do-raio-de-torre. O ponto e construido dos
 * parametros (nao da coluna geom gerada), entao funciona ANTES do INSERT.
 *
 * Retorna `null` quando nao da para calcular (sem projeto, sem coordenadas, ou o
 * projeto nao tem geometria materializada) — o chamador deve, nesse caso, deixar
 * os campos como estao. Quando ha geometria, retorna:
 *   { distanceToAxisM, distanceToTowerM, insideRightOfWay, insideTowerRadius }
 * (distancias podem ser null se o projeto so tem eixo OU so tem torres).
 */
async function computeGeoDistance({ projectId, lat, lon, faixaBufferM, towerRadiusM } = {}) {
    const pid = typeof projectId === 'string' ? projectId.trim() : '';
    const latitude = toFiniteNumber(lat);
    const longitude = toFiniteNumber(lon);
    if (!pid || latitude === null || longitude === null) return null;

    const faixa = toFiniteNumber(faixaBufferM) ?? DEFAULT_FAIXA_BUFFER_M;
    const radius = toFiniteNumber(towerRadiusM) ?? DEFAULT_TOWER_RADIUS_M;

    const result = await postgresStore.query(
        `
            SELECT
                ST_Distance(q.p, pg.axis)                       AS distance_to_axis_m,
                ST_Distance(q.p, pg.towers)                     AS distance_to_tower_m,
                COALESCE(ST_DWithin(q.p, pg.axis,   $4), false) AS inside_right_of_way,
                COALESCE(ST_DWithin(q.p, pg.towers, $5), false) AS inside_tower_radius
            FROM project_geometries pg
            CROSS JOIN (
                SELECT ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography AS p
            ) q
            WHERE pg.project_id = $1
        `,
        [pid, longitude, latitude, faixa, radius],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        distanceToAxisM: row.distance_to_axis_m === null ? null : Number(row.distance_to_axis_m),
        distanceToTowerM: row.distance_to_tower_m === null ? null : Number(row.distance_to_tower_m),
        insideRightOfWay: Boolean(row.inside_right_of_way),
        insideTowerRadius: Boolean(row.inside_tower_radius),
    };
}

/**
 * Resolve qual distancia "a estrutura" alimenta a criticidade (modelo hibrido):
 *   1. operador sobrescreveu (manualOverride) -> usa o valor manual;
 *   2. senao, ha distancia calculada -> usa a calculada;
 *   3. senao, cai no valor manual legado (fallback).
 * Retorna numero ou null. Pura (sem I/O) — facil de testar.
 */
function resolveEffectiveStructureDistance({ manualOverride, manualValue, computed } = {}) {
    const manual = toFiniteNumber(manualValue);
    const comp = toFiniteNumber(computed);
    if (manualOverride === true) return manual;
    if (comp !== null) return comp;
    return manual;
}

module.exports = {
    computeGeoDistance,
    resolveEffectiveStructureDistance,
    DEFAULT_FAIXA_BUFFER_M,
    DEFAULT_TOWER_RADIUS_M,
};
