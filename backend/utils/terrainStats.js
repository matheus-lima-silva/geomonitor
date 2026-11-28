// Estatisticas de relevo e cobertura do solo a partir de janelas de raster
// (Fases 3/4). Funcoes puras: a leitura dos rasters fica em rasterSources.js.

const ORIENTATIONS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

/**
 * Janela raster -> pixels dentro de um raio (m) em volta de (cx, cy) em pixels.
 * `pixelW`/`pixelH` em metros.
 */
function insideRadius(x, y, cx, cy, pixelW, pixelH, radiusM) {
    return Math.hypot((x - cx) * pixelW, (y - cy) * pixelH) <= radiusM;
}

/**
 * Declividade e orientacao (metodo de Horn) dos pixels dentro do raio.
 * @param {ArrayLike<number>} values  elevacoes em linha (width x height)
 * @returns {{ elevacaoM, declividadeMediaGraus, declividadeMaxGraus, orientacao, pixels } | null}
 */
function computeTerrainStats({ values, width, height, pixelW, pixelH, cx, cy, radiusM, nodata = null }) {
    const at = (x, y) => {
        const v = values[y * width + x];
        return (v === nodata || !Number.isFinite(v)) ? null : v;
    };
    const slopes = [];
    let sinSum = 0;
    let cosSum = 0;
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            if (!insideRadius(x, y, cx, cy, pixelW, pixelH, radiusM)) continue;
            const z = [at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1), at(x - 1, y), at(x + 1, y), at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1)];
            if (z.some((v) => v === null)) continue;
            const [a, b, c, d, f, g, h, i] = z;
            const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * pixelW);
            const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * pixelH);
            const slope = Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI);
            slopes.push(slope);
            if (slope > 1) {
                // direcao para onde a encosta desce (0 = norte, sentido horario); linha cresce para o sul
                const aspect = (Math.atan2(-dzdx, dzdy) * (180 / Math.PI) + 360) % 360;
                sinSum += Math.sin((aspect * Math.PI) / 180);
                cosSum += Math.cos((aspect * Math.PI) / 180);
            }
        }
    }
    const center = at(Math.round(cx), Math.round(cy));
    if (slopes.length === 0 && center === null) return null;
    const round1 = (v) => Math.round(v * 10) / 10;
    const mean = slopes.length ? slopes.reduce((s, v) => s + v, 0) / slopes.length : null;
    let orientacao = null;
    if (Math.hypot(sinSum, cosSum) > 0) {
        const deg = (Math.atan2(sinSum, cosSum) * (180 / Math.PI) + 360) % 360;
        orientacao = ORIENTATIONS[Math.round(deg / 45) % 8];
    }
    return {
        elevacaoM: center === null ? null : Math.round(center),
        declividadeMediaGraus: mean === null ? null : round1(mean),
        declividadeMaxGraus: slopes.length ? round1(Math.max(...slopes)) : null,
        orientacao: mean !== null && mean < 2 ? 'plano' : orientacao,
        pixels: slopes.length,
    };
}

// ESA WorldCover v200 -> classes do formulario de erosao (usosSolo).
const WORLDCOVER_CLASSES = {
    10: { nome: 'Cobertura arborea', usoSolo: 'veg_arborea' },
    20: { nome: 'Arbustos', usoSolo: 'campo' },
    30: { nome: 'Gramineas (pastagem ou campo)', usoSolo: 'pastagem' },
    40: { nome: 'Agricultura', usoSolo: 'cultivo' },
    50: { nome: 'Area construida', usoSolo: 'outro', outro: 'Area urbana/construida' },
    60: { nome: 'Solo exposto / vegetacao esparsa', usoSolo: 'outro', outro: 'Solo exposto' },
    70: { nome: 'Neve e gelo', usoSolo: 'outro', outro: 'Neve' },
    80: { nome: 'Agua', usoSolo: 'curso_agua' },
    90: { nome: 'Area umida herbacea', usoSolo: 'campo' },
    95: { nome: 'Mangue', usoSolo: 'veg_arborea' },
    100: { nome: 'Musgos e liquens', usoSolo: 'campo' },
};
const MIN_SHARE_FOR_SUGGESTION = 0.2;

/** Fracao de cada classe dentro do raio + usos do solo sugeridos (>= 20%). */
function computeLandCoverStats({ values, width, height, pixelW, pixelH, cx, cy, radiusM, nodata = 0 }) {
    const counts = new Map();
    let total = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!insideRadius(x, y, cx, cy, pixelW, pixelH, radiusM)) continue;
            const v = values[y * width + x];
            if (v === nodata || !WORLDCOVER_CLASSES[v]) continue;
            counts.set(v, (counts.get(v) || 0) + 1);
            total += 1;
        }
    }
    if (total === 0) return null;
    const cobertura = {};
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([code, n]) => {
        cobertura[code] = Math.round((n / total) * 100) / 100;
    });
    const usos = new Set();
    const outros = new Set();
    Object.entries(cobertura).forEach(([code, share]) => {
        if (share < MIN_SHARE_FOR_SUGGESTION) return;
        const cls = WORLDCOVER_CLASSES[code];
        usos.add(cls.usoSolo);
        if (cls.outro) outros.add(cls.outro);
    });
    const center = values[Math.round(cy) * width + Math.round(cx)];
    return {
        cobertura,
        coberturaNomes: Object.fromEntries(Object.keys(cobertura).map((code) => [code, WORLDCOVER_CLASSES[code].nome])),
        classeNoPonto: WORLDCOVER_CLASSES[center] ? WORLDCOVER_CLASSES[center].nome : null,
        usosSoloSugeridos: [...usos],
        usoSoloOutroSugerido: [...outros].join(', '),
    };
}

module.exports = {
    WORLDCOVER_CLASSES,
    computeTerrainStats,
    computeLandCoverStats,
};
