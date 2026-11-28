// Helpers da carga de vias publicas do OpenStreetMap (Fase 1b). Os dados do OSM
// sao (c) OpenStreetMap contributors, licenca ODbL — creditar onde forem exibidos.

const PUBLIC_HIGHWAYS = [
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'unclassified', 'residential', 'living_street',
    'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
];

const PAVED_SURFACES = new Set(['asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'sett', 'cobblestone', 'chipseal', 'unhewn_cobblestone']);
const UNPAVED_SURFACES = new Set(['unpaved', 'dirt', 'ground', 'gravel', 'fine_gravel', 'compacted', 'earth', 'sand', 'grass', 'mud', 'pebblestone', 'rock']);

// Sem tag `surface`: rodovias e ruas -> asfalto; estrada rural sem classificacao -> terra.
const DEFAULT_CLASS_BY_HIGHWAY = {
    motorway: 'asfalto', trunk: 'asfalto', primary: 'asfalto', secondary: 'asfalto', tertiary: 'asfalto',
    residential: 'asfalto', living_street: 'asfalto', unclassified: 'terra',
};

function classifySurface(highway, surface) {
    const s = String(surface || '').trim().toLowerCase();
    if (PAVED_SURFACES.has(s)) return { surfaceClass: 'asfalto', inferred: false };
    if (UNPAVED_SURFACES.has(s)) return { surfaceClass: 'terra', inferred: false };
    const base = String(highway || '').replace(/_link$/, '');
    return { surfaceClass: DEFAULT_CLASS_BY_HIGHWAY[base] || 'terra', inferred: true };
}

/** Envelope das torres de um projeto + margem (graus). null sem torres validas. */
function projectBbox(torresCoordenadas, marginDeg = 0.03) {
    const pts = (Array.isArray(torresCoordenadas) ? torresCoordenadas : [])
        .map((t) => [Number(t?.longitude), Number(t?.latitude)])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180);
    if (pts.length === 0) return null;
    return {
        minLon: Math.min(...pts.map((p) => p[0])) - marginDeg,
        minLat: Math.min(...pts.map((p) => p[1])) - marginDeg,
        maxLon: Math.max(...pts.map((p) => p[0])) + marginDeg,
        maxLat: Math.max(...pts.map((p) => p[1])) + marginDeg,
    };
}

/** Divide um envelope em ladrilhos de no maximo `sizeDeg` graus (consultas menores ao Overpass). */
function tilesForBbox(bbox, sizeDeg = 0.4) {
    const tiles = [];
    for (let lon = bbox.minLon; lon < bbox.maxLon; lon += sizeDeg) {
        for (let lat = bbox.minLat; lat < bbox.maxLat; lat += sizeDeg) {
            tiles.push({
                minLon: lon,
                minLat: lat,
                maxLon: Math.min(lon + sizeDeg, bbox.maxLon),
                maxLat: Math.min(lat + sizeDeg, bbox.maxLat),
            });
        }
    }
    return tiles;
}

function roundDeg(value) {
    return Math.round(value * 1e6) / 1e6;
}

/** Chave estavel de um ladrilho (para retomar cargas interrompidas). */
function tileKey({ minLon, minLat }) {
    return `${roundDeg(minLon).toFixed(4)},${roundDeg(minLat).toFixed(4)}`;
}

/**
 * Ladrilhos de uma grade fixa (alinhada em multiplos de `sizeDeg`) que cobrem
 * cada torre com `marginDeg` de folga. So entram celulas com torre por perto, e
 * celulas compartilhadas por varios empreendimentos aparecem uma vez so.
 * `towers`: [{ longitude, latitude, projectId }].
 * @returns [{ minLon, minLat, maxLon, maxLat, key, projectIds: [] }]
 */
function tilesAroundTowers(towers, sizeDeg = 0.2, marginDeg = 0.03) {
    const cells = new Map();
    (Array.isArray(towers) ? towers : []).forEach((t) => {
        const lon = Number(t?.longitude);
        const lat = Number(t?.latitude);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        for (let x = Math.floor((lon - marginDeg) / sizeDeg); x <= Math.floor((lon + marginDeg) / sizeDeg); x += 1) {
            for (let y = Math.floor((lat - marginDeg) / sizeDeg); y <= Math.floor((lat + marginDeg) / sizeDeg); y += 1) {
                const tile = {
                    minLon: roundDeg(x * sizeDeg),
                    minLat: roundDeg(y * sizeDeg),
                    maxLon: roundDeg((x + 1) * sizeDeg),
                    maxLat: roundDeg((y + 1) * sizeDeg),
                };
                const key = tileKey(tile);
                if (!cells.has(key)) cells.set(key, { ...tile, key, projectIds: new Set() });
                if (t.projectId) cells.get(key).projectIds.add(t.projectId);
            }
        }
    });
    return [...cells.values()]
        .map((cell) => ({ ...cell, projectIds: [...cell.projectIds].sort() }))
        .sort((a, b) => (a.minLat - b.minLat) || (a.minLon - b.minLon));
}

function buildOverpassQuery({ minLon, minLat, maxLon, maxLat }, timeoutSec = 240) {
    const pattern = `^(${PUBLIC_HIGHWAYS.join('|')})$`;
    return `[out:json][timeout:${timeoutSec}];way["highway"~"${pattern}"](${minLat},${minLon},${maxLat},${maxLon});out tags geom;`;
}

/** Resposta JSON do Overpass -> linhas para osmRoadRepository.upsertMany. */
function parseOverpassWays(json) {
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    return elements
        .filter((el) => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2)
        .map((el) => {
            const tags = el.tags || {};
            const { surfaceClass, inferred } = classifySurface(tags.highway, tags.surface);
            return {
                osmId: el.id,
                highway: tags.highway,
                surface: tags.surface || null,
                surfaceClass,
                surfaceInferred: inferred,
                name: tags.name || null,
                coordinates: el.geometry.map((g) => [Math.round(g.lon * 1e7) / 1e7, Math.round(g.lat * 1e7) / 1e7]),
            };
        });
}

module.exports = {
    PUBLIC_HIGHWAYS,
    classifySurface,
    projectBbox,
    tilesForBbox,
    tilesAroundTowers,
    tileKey,
    buildOverpassQuery,
    parseOverpassWays,
};
