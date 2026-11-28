// MapBiomas Brasil (Colecao 11, legenda oficial) -> usos do solo do formulario
// de erosao (usosSolo). Dados (c) MapBiomas, CC BY 4.0. Obtidos pelo Google
// Earth Engine (asset projects/mapbiomas-public/assets/brazil/lulc/v1) porque o
// download direto de GeoTIFF esta suspenso pelo MapBiomas.

const MAPBIOMAS_CLASSES = {
    3: { nome: 'Formacao florestal', usos: ['veg_arborea'] },
    4: { nome: 'Formacao savanica', usos: ['veg_arborea'] },
    5: { nome: 'Mangue', usos: ['veg_arborea'] },
    6: { nome: 'Floresta alagavel', usos: ['veg_arborea'] },
    7: { nome: 'Savana inundavel', usos: ['campo'] },
    9: { nome: 'Silvicultura', usos: ['veg_arborea'] },
    11: { nome: 'Campo alagado e area pantanosa', usos: ['campo'] },
    12: { nome: 'Formacao campestre', usos: ['campo'] },
    15: { nome: 'Pastagem', usos: ['pastagem'] },
    18: { nome: 'Agricultura', usos: ['cultivo'] },
    19: { nome: 'Lavoura temporaria', usos: ['cultivo'] },
    20: { nome: 'Cana', usos: ['cultivo'] },
    21: { nome: 'Mosaico de usos', usos: ['pastagem', 'cultivo'] },
    23: { nome: 'Praia, duna e areal', usos: ['outro'], outro: 'Praia/duna' },
    24: { nome: 'Area urbanizada', usos: ['outro'], outro: 'Area urbana' },
    25: { nome: 'Outras areas nao vegetadas', usos: ['outro'], outro: 'Solo exposto' },
    26: { nome: 'Corpo d\'agua', usos: ['curso_agua'] },
    29: { nome: 'Afloramento rochoso', usos: ['outro'], outro: 'Afloramento rochoso' },
    30: { nome: 'Mineracao', usos: ['outro'], outro: 'Mineracao' },
    31: { nome: 'Aquicultura', usos: ['curso_agua'] },
    32: { nome: 'Apicum', usos: ['campo'] },
    33: { nome: 'Rio, lago e oceano', usos: ['curso_agua'] },
    35: { nome: 'Dende', usos: ['cultivo'] },
    36: { nome: 'Lavoura perene', usos: ['cultivo'] },
    39: { nome: 'Soja', usos: ['cultivo'] },
    40: { nome: 'Arroz', usos: ['cultivo'] },
    41: { nome: 'Outras lavouras temporarias', usos: ['cultivo'] },
    46: { nome: 'Cafe', usos: ['cultivo'] },
    47: { nome: 'Citrus', usos: ['cultivo'] },
    48: { nome: 'Outras lavouras perenes', usos: ['cultivo'] },
    49: { nome: 'Restinga arborea', usos: ['veg_arborea'] },
    50: { nome: 'Restinga herbacea', usos: ['campo'] },
    62: { nome: 'Algodao', usos: ['cultivo'] },
    75: { nome: 'Usina fotovoltaica', usos: ['outro'], outro: 'Usina fotovoltaica' },
    77: { nome: 'Mosaico herbaceo-arbustivo', usos: ['campo'] },
    84: { nome: 'Marisma', usos: ['campo'] },
    91: { nome: 'Parque eolico', usos: ['outro'], outro: 'Parque eolico' },
};
const MIN_SHARE_FOR_SUGGESTION = 0.2;

/**
 * Histograma { codigo: pixels } (frequencyHistogram do Earth Engine, pode vir
 * fracionado nas bordas) -> fracoes, nomes e usos do solo sugeridos (>= 20%).
 */
function summarizeMapbiomasHistogram(histogram) {
    const entries = Object.entries(histogram || {})
        .map(([code, count]) => [Number(code), Number(count)])
        .filter(([code, count]) => Number.isFinite(code) && code > 0 && Number.isFinite(count) && count > 0);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return null;
    // Chaves numericas nao preservam ordem de insercao em objetos JS: a classe
    // predominante sai da lista ordenada, nao de Object.keys(cobertura).
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const cobertura = {};
    sorted.forEach(([code, count]) => {
        cobertura[code] = Math.round((count / total) * 100) / 100;
    });
    const principal = sorted[0][0];
    const usos = new Set();
    const outros = new Set();
    Object.entries(cobertura).forEach(([code, share]) => {
        if (share < MIN_SHARE_FOR_SUGGESTION) return;
        const cls = MAPBIOMAS_CLASSES[code];
        if (!cls) return;
        cls.usos.forEach((u) => usos.add(u));
        if (cls.outro) outros.add(cls.outro);
    });

    return {
        cobertura,
        coberturaNomes: Object.fromEntries(Object.keys(cobertura).map((code) => [code, MAPBIOMAS_CLASSES[code]?.nome || `Classe ${code}`])),
        classePredominante: MAPBIOMAS_CLASSES[principal]?.nome || null,
        usosSoloSugeridos: [...usos],
        usoSoloOutroSugerido: [...outros].join(', '),
    };
}

/** Linha CSV simples com campos entre aspas ("" escapa aspas). */
function parseCsvLine(line) {
    const out = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') { quoted = false; } else { field += ch; }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            out.push(field); field = '';
        } else {
            field += ch;
        }
    }
    out.push(field);
    return out;
}

/** CSV exportado pelo script do Earth Engine -> [{ projeto, torre, ano, colecao, histogram }]. */
function parseMapbiomasTowerCsv(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.trim());
    const idx = (name) => header.indexOf(name);
    ['projeto', 'torre', 'ano', 'classes'].forEach((name) => {
        if (idx(name) < 0) throw new Error(`Coluna "${name}" ausente no CSV.`);
    });
    return lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        let histogram = {};
        try { histogram = JSON.parse(cols[idx('classes')] || '{}') || {}; } catch { histogram = {}; }
        return {
            projeto: String(cols[idx('projeto')] || '').trim().toUpperCase(),
            torre: String(cols[idx('torre')] || '').trim(),
            ano: Number(cols[idx('ano')]),
            colecao: idx('colecao') >= 0 ? Number(cols[idx('colecao')]) : null,
            histogram,
        };
    }).filter((r) => r.projeto && r.torre);
}

module.exports = {
    MAPBIOMAS_CLASSES,
    summarizeMapbiomasHistogram,
    parseMapbiomasTowerCsv,
};
