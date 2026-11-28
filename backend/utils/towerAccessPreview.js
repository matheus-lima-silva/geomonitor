// Previa da importacao de tracados de acesso (Fase 1b): para cada linha do
// arquivo, sugere torre/destino, orienta entrada -> torre e pinta os trechos
// (asfalto / terra / acesso) contra as vias publicas do OSM. Nao grava nada.
const {
    SAMPLE_STEP_M,
    samplePoints,
    buildSegments,
    normalizeTowers,
    suggestTower,
    buildFlags,
    summarizeSegments,
    lineLength,
} = require('./accessClassification');

const MAX_SAMPLES_AT_BASE_STEP = 120000;

function envelopeOf(features) {
    let minLon = Infinity; let minLat = Infinity; let maxLon = -Infinity; let maxLat = -Infinity;
    features.forEach((f) => f.geometry.coordinates.forEach(([lon, lat]) => {
        minLon = Math.min(minLon, lon); minLat = Math.min(minLat, lat);
        maxLon = Math.max(maxLon, lon); maxLat = Math.max(maxLat, lat);
    }));
    return { minLon, minLat, maxLon, maxLat };
}

const ACTION_ORDER = { acesso: 0, rota_guia: 1, ignorar: 2 };

/**
 * @param {object} args
 * @param {Array} args.features   [{ id, name, geometry: LineString }]
 * @param {Array} args.torresCoordenadas  do payload do empreendimento
 * @param {object} args.osmRoadRepository  { classifyPoints, hasCoverage }
 */
async function buildAccessPreview({ features, torresCoordenadas, osmRoadRepository }) {
    const towers = normalizeTowers(torresCoordenadas);
    const osmLoaded = await osmRoadRepository.hasCoverage(envelopeOf(features));

    const totalLength = features.reduce((sum, f) => sum + lineLength(f.geometry.coordinates), 0);
    // Arquivos muito grandes: amostra mais espacada para a consulta caber no tempo.
    const step = totalLength / SAMPLE_STEP_M > MAX_SAMPLES_AT_BASE_STEP ? SAMPLE_STEP_M * 2 : SAMPLE_STEP_M;

    const prepared = features.map((feature) => {
        const suggestion = suggestTower(feature.geometry.coordinates, towers);
        return { feature, suggestion, samples: samplePoints(suggestion.coordinates, step) };
    });

    let classes = [];
    if (osmLoaded) {
        classes = await osmRoadRepository.classifyPoints(prepared.flatMap((p) => p.samples.map((s) => s.point)));
    }

    let cursor = 0;
    const items = prepared.map(({ feature, suggestion, samples }) => {
        const typed = samples.map((s) => {
            const hit = osmLoaded ? classes[cursor] : null;
            cursor += 1;
            return { ...s, tipo: hit ? hit.surfaceClass : 'acesso', inferido: hit ? hit.inferred : false };
        });
        const segments = buildSegments(suggestion.coordinates, typed);
        return {
            featureId: feature.id,
            name: feature.name || '',
            action: suggestion.action,
            towerNumber: suggestion.towerNumber,
            towerDistanceM: suggestion.towerDistanceM === null ? null : Math.round(suggestion.towerDistanceM),
            relation: suggestion.relation,
            geometry: { type: 'LineString', coordinates: suggestion.coordinates },
            lengthM: Math.round(lineLength(suggestion.coordinates) * 10) / 10,
            segments,
            resumo: summarizeSegments(segments),
            flags: buildFlags({ suggestion, segments, osmLoaded }),
        };
    });

    items.sort((a, b) => (ACTION_ORDER[a.action] - ACTION_ORDER[b.action])
        || String(a.towerNumber || '').localeCompare(String(b.towerNumber || ''), 'pt-BR', { numeric: true }));

    return {
        items,
        meta: {
            osmLoaded,
            sampleStepM: step,
            totals: items.reduce((acc, item) => {
                acc[item.action] = (acc[item.action] || 0) + 1;
                return acc;
            }, {}),
        },
    };
}

module.exports = { buildAccessPreview };
