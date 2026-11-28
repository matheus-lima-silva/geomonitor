// Classificacao de tracados de acesso (Fase 1b): liga cada linha a uma torre do
// empreendimento, orienta entrada -> torre e divide em trechos coloridos
// (asfalto / terra / acesso) a partir de amostras classificadas contra as vias
// publicas do OSM. Funcoes puras: a consulta PostGIS fica no osmRoadRepository.
//
// Coordenadas em GeoJSON ([lon, lat]); distancias em metros.

const EARTH_RADIUS_M = 6371008.8;
const SAMPLE_STEP_M = 10;
const MIN_RUN_M = 30; // trechos menores que isso sao ruido (cruzamento de via etc.)
const ENDPOINT_TOWER_TOL_M = 100;
const PASS_NEAR_TOWER_TOL_M = 100;
const IGNORE_BEYOND_M = 5000;
const SHORT_ACCESS_M = 30;

const toRad = (deg) => (deg * Math.PI) / 180;

function haversineMeters(a, b) {
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulativeLengths(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i += 1) cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
    return cum;
}

function lineLength(coords) {
    const cum = cumulativeLengths(coords);
    return cum[cum.length - 1] || 0;
}

function round7(value) {
    return Math.round(value * 1e7) / 1e7;
}

function interpolateAt(coords, cum, distance) {
    if (distance <= 0) return coords[0];
    const total = cum[cum.length - 1];
    if (distance >= total) return coords[coords.length - 1];
    let i = 1;
    while (i < cum.length && cum[i] < distance) i += 1;
    const span = cum[i] - cum[i - 1];
    const t = span === 0 ? 0 : (distance - cum[i - 1]) / span;
    return [
        round7(coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t),
        round7(coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t),
    ];
}

/** Pontos a cada `step` metros ao longo da linha (meio de cada passo). */
function samplePoints(coords, step = SAMPLE_STEP_M) {
    const cum = cumulativeLengths(coords);
    const total = cum[cum.length - 1];
    const count = Math.max(1, Math.ceil(total / step));
    const size = total / count;
    const points = [];
    for (let k = 0; k < count; k += 1) {
        points.push({ point: interpolateAt(coords, cum, (k + 0.5) * size), from: k * size, to: (k + 1) * size });
    }
    return points;
}

/** Recorte da linha entre duas distancias ao longo dela. */
function substring(coords, cum, from, to) {
    const out = [interpolateAt(coords, cum, from)];
    for (let i = 1; i < coords.length - 1; i += 1) {
        if (cum[i] > from && cum[i] < to) out.push(coords[i]);
    }
    out.push(interpolateAt(coords, cum, to));
    return out.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
}

/**
 * Agrupa amostras classificadas em trechos e funde os curtos (< MIN_RUN_M) no
 * vizinho mais longo. `samples[i].tipo` in asfalto|terra|acesso.
 */
function buildRuns(samples) {
    let runs = [];
    samples.forEach((s) => {
        const last = runs[runs.length - 1];
        if (last && last.tipo === s.tipo) {
            last.to = s.to;
            last.inferido = last.inferido || Boolean(s.inferido);
        } else {
            runs.push({ tipo: s.tipo, from: s.from, to: s.to, inferido: Boolean(s.inferido) });
        }
    });
    let changed = true;
    while (changed && runs.length > 1) {
        changed = false;
        const idx = runs.findIndex((r) => r.to - r.from < MIN_RUN_M);
        if (idx >= 0) {
            const prev = runs[idx - 1];
            const next = runs[idx + 1];
            const target = !prev ? next : !next ? prev : ((prev.to - prev.from) >= (next.to - next.from) ? prev : next);
            target.from = Math.min(target.from, runs[idx].from);
            target.to = Math.max(target.to, runs[idx].to);
            runs.splice(idx, 1);
            // funde vizinhos que ficaram com o mesmo tipo
            runs = runs.reduce((acc, r) => {
                const last = acc[acc.length - 1];
                if (last && last.tipo === r.tipo) {
                    last.to = r.to;
                    last.inferido = last.inferido || r.inferido;
                } else acc.push(r);
                return acc;
            }, []);
            changed = true;
        }
    }
    return runs;
}

/** Trechos coloridos com coordenadas proprias e comprimento. */
function buildSegments(coords, samples) {
    const cum = cumulativeLengths(coords);
    return buildRuns(samples).map((run) => ({
        tipo: run.tipo,
        inferido: run.tipo === 'acesso' ? false : run.inferido,
        manual: false,
        comprimentoM: Math.round((run.to - run.from) * 10) / 10,
        coordinates: substring(coords, cum, run.from, run.to),
    }));
}

function nearestTower(point, towers) {
    let best = null;
    towers.forEach((tower) => {
        const d = haversineMeters(point, [tower.longitude, tower.latitude]);
        if (!best || d < best.distanceM) best = { numero: tower.numero, distanceM: d };
    });
    return best;
}

/** torresCoordenadas do payload do projeto -> [{ numero, latitude, longitude }] validas. */
function normalizeTowers(torresCoordenadas = []) {
    return (Array.isArray(torresCoordenadas) ? torresCoordenadas : [])
        .map((row) => ({
            numero: String(row?.numero ?? '').trim(),
            latitude: Number(row?.latitude),
            longitude: Number(row?.longitude),
        }))
        .filter((t) => t.numero && Number.isFinite(t.latitude) && Number.isFinite(t.longitude)
            && Math.abs(t.latitude) <= 90 && Math.abs(t.longitude) <= 180);
}

/**
 * Sugere o destino da linha:
 *  - ponta a <= 100 m de uma torre -> 'acesso' daquela torre, orientado entrada -> torre;
 *  - passa a <= 100 m de uma torre  -> 'rota_guia' com torre sugerida (relation 'passa');
 *  - mais de 5 km de qualquer torre -> 'ignorar';
 *  - senao                          -> 'rota_guia'.
 */
function suggestTower(coords, towers) {
    if (!towers.length || coords.length < 2) {
        return { action: 'rota_guia', towerNumber: null, towerDistanceM: null, relation: 'sem_torres', coordinates: coords };
    }
    const atStart = nearestTower(coords[0], towers);
    const atEnd = nearestTower(coords[coords.length - 1], towers);
    const endpoint = atStart.distanceM <= atEnd.distanceM ? { ...atStart, end: 'start' } : { ...atEnd, end: 'end' };
    if (endpoint.distanceM <= ENDPOINT_TOWER_TOL_M) {
        return {
            action: 'acesso',
            towerNumber: endpoint.numero,
            towerDistanceM: endpoint.distanceM,
            relation: 'ponta',
            coordinates: endpoint.end === 'start' ? [...coords].reverse() : coords,
        };
    }
    let closest = endpoint;
    coords.forEach((point) => {
        const t = nearestTower(point, towers);
        if (t.distanceM < closest.distanceM) closest = t;
    });
    if (closest.distanceM <= PASS_NEAR_TOWER_TOL_M) {
        return { action: 'rota_guia', towerNumber: closest.numero, towerDistanceM: closest.distanceM, relation: 'passa', coordinates: coords };
    }
    return {
        action: closest.distanceM > IGNORE_BEYOND_M ? 'ignorar' : 'rota_guia',
        towerNumber: null,
        towerDistanceM: closest.distanceM,
        relation: 'longe',
        coordinates: coords,
    };
}

/** Alertas para a tela de revisao. */
function buildFlags({ suggestion, segments, osmLoaded }) {
    const flags = [];
    if (!osmLoaded) flags.push('sem_osm');
    if (segments.some((s) => s.inferido)) flags.push('tipo_inferido');
    if (suggestion.relation === 'passa') flags.push('passa_perto_da_torre');
    if (suggestion.action === 'acesso') {
        const last = segments[segments.length - 1];
        const accessTail = last && last.tipo === 'acesso' ? last.comprimentoM : 0;
        if (accessTail < SHORT_ACCESS_M) flags.push('acesso_curto');
    }
    return flags;
}

function summarizeSegments(segments) {
    return segments.reduce((acc, s) => {
        acc[s.tipo] = Math.round(((acc[s.tipo] || 0) + s.comprimentoM) * 10) / 10;
        return acc;
    }, {});
}

module.exports = {
    SAMPLE_STEP_M,
    MIN_RUN_M,
    haversineMeters,
    lineLength,
    samplePoints,
    buildRuns,
    buildSegments,
    normalizeTowers,
    suggestTower,
    buildFlags,
    summarizeSegments,
};
