// Solo e suscetibilidade a erosao por torre (Fases 3/6, docs/plans/erosao-acessos-geodados.md).
//
// Fontes:
//  - classe de solo: IBGE BDiA Pedologia 1:250.000 (2026), tabela ibge_pedologia;
//  - R (erosividade): REDB-BR (Zenodo 4428308, CC BY 4.0), MJ mm ha-1 h-1 ano-1;
//  - LS: declividade do Copernicus DEM com comprimento de rampa fixo;
//  - C: uso do solo MapBiomas;
//  - K: ESTIMATIVA PROVISORIA por ordem de solo (ordem de grandeza de estudos
//    brasileiros). O mapa de erodibilidade da Embrapa e CC BY-NC e nao foi usado.
// A perda de solo (A = R.K.LS.C.P, P = 1) e um indice RELATIVO para ranquear torres,
// nao uma medida de perda real.

function normalize(text) {
    return String(text || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Tipo de solo do formulario (lateritico | argiloso | solos_rasos | arenoso) a partir
 * da classe do IBGE. Ordem do solo primeiro; textura arenosa prevalece.
 */
function soilFormTypeFromIbge({ ordem, subordem, textura, legenda } = {}) {
    const all = normalize([ordem, subordem, legenda].filter(Boolean).join(' '));
    const tex = normalize(textura);
    if (all.includes('QUARTZARENICO') || tex.startsWith('ARENOSA') || tex === 'MUITO ARENOSA') return 'arenoso';
    if (all.includes('AFLORAMENTO') || all.includes('LITOLICO') || all.includes('CAMBISSOLO')) return 'solos_rasos';
    if (all.includes('LATOSSOLO') || all.includes('PLINTOSSOLO')) return 'lateritico';
    if (all.trim()) return 'argiloso';
    return null;
}

// K provisorio (t h MJ-1 mm-1) por ordem de solo. Ordem de grandeza; substituir por
// mapa oficial de erodibilidade quando houver base com licenca adequada.
const K_PROVISORIO = [
    ['QUARTZARENICO', 0.035],
    ['LITOLICO', 0.045],
    ['REGOLITICO', 0.040],
    ['FLUVICO', 0.035],
    ['LATOSSOLO', 0.015],
    ['NITOSSOLO', 0.020],
    ['ARGISSOLO', 0.035],
    ['CAMBISSOLO', 0.040],
    ['PLANOSSOLO', 0.040],
    ['LUVISSOLO', 0.040],
    ['PLINTOSSOLO', 0.030],
    ['GLEISSOLO', 0.020],
    ['CHERNOSSOLO', 0.030],
    ['ESPODOSSOLO', 0.030],
    ['VERTISSOLO', 0.030],
    ['ORGANOSSOLO', 0.010],
    ['AFLORAMENTO', 0.005],
];

function provisionalK({ ordem, subordem, legenda } = {}) {
    const all = normalize([subordem, ordem, legenda].filter(Boolean).join(' '));
    const hit = K_PROVISORIO.find(([key]) => all.includes(key));
    return hit ? hit[1] : null;
}

// C por classe MapBiomas (ordem de grandeza da literatura; P = 1).
const C_POR_CLASSE = {
    3: 0.001, 4: 0.02, 5: 0.001, 6: 0.001, 49: 0.001, // florestas e savanas
    9: 0.01, // silvicultura
    7: 0.02, 11: 0.01, 12: 0.03, 32: 0.01, 50: 0.03, 77: 0.03, 84: 0.01, // campos e areas umidas
    15: 0.05, // pastagem
    21: 0.1, // mosaico de usos
    18: 0.2, 19: 0.2, 39: 0.2, 40: 0.2, 41: 0.2, 62: 0.2, // lavouras temporarias
    20: 0.1, // cana
    35: 0.1, 36: 0.1, 46: 0.1, 47: 0.1, 48: 0.1, // perenes
    24: 0.01, 75: 0.05, 91: 0.05, // urbano / usinas
    23: 1, 25: 1, 30: 1, // solo exposto, mineracao
    26: 0, 31: 0, 33: 0, 29: 0, // agua, rocha
};

/** C medio ponderado pelas fracoes MapBiomas { codigo: fracao }. */
function coverC(cobertura) {
    const entries = Object.entries(cobertura || {})
        .map(([code, share]) => [C_POR_CLASSE[code], Number(share)])
        .filter(([c, share]) => Number.isFinite(c) && Number.isFinite(share) && share > 0);
    const total = entries.reduce((s, [, share]) => s + share, 0);
    if (total === 0) return null;
    return entries.reduce((s, [c, share]) => s + c * share, 0) / total;
}

const RAMPA_M = 50; // comprimento de rampa fixo (sem rede de drenagem ainda)

/** Fator LS (Wischmeier & Smith 1978) a partir da declividade em graus. */
function lsFactor(slopeDeg, lengthM = RAMPA_M) {
    if (!Number.isFinite(slopeDeg)) return null;
    const theta = (slopeDeg * Math.PI) / 180;
    const pct = Math.tan(theta) * 100;
    let m = 0.5;
    if (pct < 1) m = 0.2;
    else if (pct < 3) m = 0.3;
    else if (pct < 5) m = 0.4;
    const s = Math.sin(theta);
    return ((lengthM / 22.13) ** m) * (65.41 * s * s + 4.56 * s + 0.065);
}

const CLASSES_PERDA = [
    [5, 'baixa'],
    [15, 'moderada'],
    [50, 'alta'],
    [Infinity, 'muito_alta'],
];

/** Indice RUSLE da torre. Retorna null se faltar algum fator. */
function computeRusle({ r, k, slopeDeg, cobertura }) {
    const ls = lsFactor(slopeDeg);
    const c = coverC(cobertura);
    if (![r, k, ls, c].every(Number.isFinite)) return null;
    const a = r * k * ls * c;
    const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
    return {
        perdaSoloIndice: round(a, 2),
        classe: CLASSES_PERDA.find(([max]) => a < max)[1],
        fatores: { R: round(r, 0), K: k, LS: round(ls, 2), C: round(c, 3), P: 1 },
        observacao: 'Indice relativo (RUSLE): K provisorio por ordem de solo, C por uso MapBiomas, rampa fixa de 50 m.',
    };
}

module.exports = {
    soilFormTypeFromIbge,
    provisionalK,
    coverC,
    lsFactor,
    computeRusle,
    RAMPA_M,
};
