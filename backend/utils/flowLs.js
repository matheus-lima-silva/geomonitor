// Fator LS da RUSLE pelo escoamento real (Fase 6, docs/plans/erosao-acessos-geodados.md),
// no lugar da rampa fixa de 50 m. Funcoes puras sobre uma janela de relevo:
//
//  1. preenche depressoes (priority-flood, Barnes et al. 2014) para a agua sair;
//  2. fluxo acumulado em multiplas direcoes (Freeman 1991, expoente 1,1);
//  3. L por area de contribuicao (Desmet & Govers 1996), S de McCool et al. (1987),
//     m de McCool (rill/interrill moderado).
//
// Comprimento de rampa equivalente (area de contribuicao / largura da celula) e
// limitado a MAX_RAMPA_M: acima disso a agua ja corre concentrada em canal, e a
// RUSLE (erosao laminar e em sulcos) deixa de valer.

const MAX_RAMPA_M = 300;
const FREEMAN_P = 1.1;
const NEIGHBORS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
];

/** Fila de prioridade minima (heap binario) de indices por elevacao. */
function createMinHeap() {
    const idx = [];
    const key = [];
    function swap(a, b) {
        [idx[a], idx[b]] = [idx[b], idx[a]];
        [key[a], key[b]] = [key[b], key[a]];
    }
    return {
        get size() { return idx.length; },
        push(i, k) {
            idx.push(i); key.push(k);
            let n = idx.length - 1;
            while (n > 0) {
                const p = (n - 1) >> 1;
                if (key[p] <= key[n]) break;
                swap(p, n); n = p;
            }
        },
        pop() {
            const top = idx[0];
            const last = idx.length - 1;
            swap(0, last); idx.pop(); key.pop();
            let n = 0;
            for (;;) {
                const l = 2 * n + 1;
                const r = l + 1;
                let m = n;
                if (l < idx.length && key[l] < key[m]) m = l;
                if (r < idx.length && key[r] < key[m]) m = r;
                if (m === n) break;
                swap(m, n); n = m;
            }
            return top;
        },
    };
}

function isValid(v, nodata) {
    return Number.isFinite(v) && v !== nodata && v > -1000;
}

/**
 * Preenche depressoes: toda celula valida passa a ter caminho descendente ate a
 * borda da janela (ou ate uma celula sem dado). Celulas sem dado ficam NaN.
 */
function fillDepressions(values, width, height, nodata = null, epsilon = 1e-3) {
    const n = width * height;
    const out = new Float64Array(n).fill(NaN);
    const closed = new Uint8Array(n);
    const heap = createMinHeap();
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = y * width + x;
            if (!isValid(values[i], nodata)) { closed[i] = 1; continue; }
            const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
                || NEIGHBORS.some(([dx, dy]) => !isValid(values[(y + dy) * width + (x + dx)], nodata));
            if (border) {
                out[i] = values[i];
                closed[i] = 1;
                heap.push(i, out[i]);
            }
        }
    }
    while (heap.size) {
        const i = heap.pop();
        const x = i % width;
        const y = (i - x) / width;
        NEIGHBORS.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
            const j = ny * width + nx;
            if (closed[j]) return;
            closed[j] = 1;
            out[j] = Math.max(values[j], out[i] + epsilon);
            heap.push(j, out[j]);
        });
    }
    return out;
}

/**
 * Area de contribuicao (m2) que chega em cada celula, incluindo a propria, com
 * distribuicao para todos os vizinhos mais baixos (Freeman 1991).
 */
function flowAccumulation(filled, width, height, pixelW, pixelH, p = FREEMAN_P) {
    const n = width * height;
    const cellArea = pixelW * pixelH;
    const acc = new Float64Array(n);
    const order = [];
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(filled[i])) { acc[i] = cellArea; order.push(i); }
    }
    order.sort((a, b) => filled[b] - filled[a]);
    order.forEach((i) => {
        const x = i % width;
        const y = (i - x) / width;
        const weights = [];
        let total = 0;
        NEIGHBORS.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
            const j = ny * width + nx;
            const drop = filled[i] - filled[j];
            if (!(drop > 0)) return;
            const w = (drop / Math.hypot(dx * pixelW, dy * pixelH)) ** p;
            weights.push([j, w]);
            total += w;
        });
        if (total > 0) weights.forEach(([j, w]) => { acc[j] += acc[i] * (w / total); });
    });
    return acc;
}

/** Declividade (rad) e orientacao (rad, 0 = norte) pelo metodo de Horn, ou null na borda. */
function hornAt(values, width, height, x, y, pixelW, pixelH, nodata) {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return null;
    const at = (dx, dy) => values[(y + dy) * width + (x + dx)];
    const z = [at(-1, -1), at(0, -1), at(1, -1), at(-1, 0), at(1, 0), at(-1, 1), at(0, 1), at(1, 1)];
    if (z.some((v) => !isValid(v, nodata))) return null;
    const [a, b, c, d, f, g, h, i] = z;
    const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * pixelW);
    const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * pixelH);
    return { slope: Math.atan(Math.hypot(dzdx, dzdy)), aspect: Math.atan2(-dzdx, dzdy) };
}

/** Fator S de McCool et al. (1987). */
function sFactorMcCool(slopeRad) {
    const s = Math.sin(slopeRad);
    return Math.tan(slopeRad) < 0.09 ? 10.8 * s + 0.03 : 16.8 * s - 0.5;
}

/** Expoente m de McCool (razao rill/interrill moderada). */
function mExponent(slopeRad) {
    const s = Math.sin(slopeRad);
    const beta = (s / 0.0896) / (3 * s ** 0.8 + 0.56);
    return beta / (1 + beta);
}

/**
 * Fator L de Desmet & Govers (1996) para uma celula.
 * areaIn: area de contribuicao que entra pela borda de cima (m2), D: largura da celula (m).
 */
function lFactorDesmetGovers(areaIn, slopeRad, aspectRad, D) {
    const m = mExponent(slopeRad);
    const x = Math.abs(Math.sin(aspectRad)) + Math.abs(Math.cos(aspectRad));
    return ((areaIn + D * D) ** (m + 1) - areaIn ** (m + 1)) / (D ** (m + 2) * x ** m * 22.13 ** m);
}

/**
 * LS por fluxo acumulado em volta de (cx, cy), media e maxima no raio.
 * Entrada no formato de rasterSources.readWindow.
 * @returns {{ ls, lsMax, rampaEquivM, pixels } | null}
 */
function computeFlowLs({ values, width, height, pixelW, pixelH, cx, cy, radiusM, nodata = null, maxRampaM = MAX_RAMPA_M }) {
    const filled = fillDepressions(values, width, height, nodata);
    const acc = flowAccumulation(filled, width, height, pixelW, pixelH);
    const D = Math.sqrt(pixelW * pixelH);
    const cellArea = pixelW * pixelH;
    const lsValues = [];
    const rampas = [];
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            if (Math.hypot((x - cx) * pixelW, (y - cy) * pixelH) > radiusM) continue;
            const horn = hornAt(values, width, height, x, y, pixelW, pixelH, nodata);
            if (!horn) continue;
            const i = y * width + x;
            const areaIn = Math.min(Math.max(acc[i] - cellArea, 0), maxRampaM * D);
            const slope = Math.max(horn.slope, 1e-4);
            lsValues.push(lFactorDesmetGovers(areaIn, slope, horn.aspect, D) * sFactorMcCool(slope));
            rampas.push(areaIn / D);
        }
    }
    if (!lsValues.length) return null;
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const round2 = (v) => Math.round(v * 100) / 100;
    return {
        ls: round2(mean(lsValues)),
        lsMax: round2(Math.max(...lsValues)),
        rampaEquivM: Math.round(mean(rampas)),
        pixels: lsValues.length,
    };
}

module.exports = {
    MAX_RAMPA_M,
    fillDepressions,
    flowAccumulation,
    sFactorMcCool,
    mExponent,
    lFactorDesmetGovers,
    computeFlowLs,
};
