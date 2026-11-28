// Declividade por torre pelo ANADEM v1 (UFRGS/ANA), modelo de TERRENO de 30 m
// (Copernicus GLO-30 com o vies da vegetacao removido). Vem do CSV exportado pelo
// script do Earth Engine exportar_anadem_geomonitor.js (raio de 50 m por torre),
// que traz tambem o Copernicus calculado do mesmo jeito para comparacao.
// Ver docs/plans/erosao-acessos-geodados.md, Fases 3 e 6.

const { parseCsvLine } = require('./mapbiomasClasses');

const ANADEM_SOURCE = {
    nome: 'ANADEM v1 (UFRGS/ANA)',
    descricao: 'Modelo digital de terreno 30 m, Copernicus GLO-30 sem vies da vegetacao',
    url: 'https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/',
    asset: 'projects/et-brasil/assets/anadem/v1',
    metodo: 'ee.Terrain.slope, media e maxima num raio de 50 m (Earth Engine)',
};

function toNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * CSV do Earth Engine -> [{ projeto, torre, anadem, copernicusGee }].
 * Linhas sem declividade media do ANADEM sao descartadas.
 */
function parseAnademTowerCsv(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.trim());
    const idx = (name) => header.indexOf(name);
    ['projeto', 'torre', 'anadem_decl_media'].forEach((name) => {
        if (idx(name) < 0) throw new Error(`Coluna "${name}" ausente no CSV.`);
    });
    const col = (cols, name) => (idx(name) >= 0 ? toNumber(cols[idx(name)]) : null);
    return lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const media = col(cols, 'anadem_decl_media');
        const elev = col(cols, 'anadem_elev');
        const copMedia = col(cols, 'cop_decl_media');
        const copElev = col(cols, 'cop_elev');
        return {
            projeto: String(cols[idx('projeto')] || '').trim().toUpperCase(),
            torre: String(cols[idx('torre')] || '').trim(),
            anadem: media === null ? null : {
                declividadeMediaGraus: round1(media),
                declividadeMaxGraus: round1(col(cols, 'anadem_decl_max')),
                elevacaoM: elev === null ? null : Math.round(elev),
            },
            copernicusGee: copMedia === null ? null : {
                declividadeMediaGraus: round1(copMedia),
                declividadeMaxGraus: round1(col(cols, 'cop_decl_max')),
                elevacaoM: copElev === null ? null : Math.round(copElev),
            },
        };
    }).filter((r) => r.projeto && r.torre && r.anadem);
}

module.exports = {
    ANADEM_SOURCE,
    parseAnademTowerCsv,
};
