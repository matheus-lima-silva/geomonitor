const {
    fillDepressions, flowAccumulation, sFactorMcCool, mExponent, lFactorDesmetGovers, computeFlowLs,
} = require('../utils/flowLs');

const deg = (d) => (d * Math.PI) / 180;

// Plano que sobe para o sul (linha y cresce para o sul): a agua corre para o norte (y = 0).
function plane({ width = 21, height = 21, pixel = 30, slopeDeg = 5 }) {
    const rise = Math.tan(deg(slopeDeg));
    const values = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) values[y * width + x] = 500 + y * pixel * rise;
    }
    return { values, width, height, pixelW: pixel, pixelH: pixel };
}

describe('fatores S e m (McCool)', () => {
    it('S nos dois ramos da formula', () => {
        expect(sFactorMcCool(deg(5))).toBeCloseTo(10.8 * Math.sin(deg(5)) + 0.03, 6); // tan 5 = 0,087 < 0,09
        expect(sFactorMcCool(deg(10))).toBeCloseTo(16.8 * Math.sin(deg(10)) - 0.5, 6);
    });

    it('m cresce com a declividade e fica entre 0 e 1', () => {
        expect(mExponent(deg(1))).toBeLessThan(mExponent(deg(10)));
        expect(mExponent(deg(30))).toBeLessThan(1);
        expect(mExponent(deg(0.1))).toBeGreaterThan(0);
    });
});

describe('lFactorDesmetGovers', () => {
    it('vale 1 numa celula de 22,13 m sem area a montante (parcela padrao)', () => {
        expect(lFactorDesmetGovers(0, deg(9), 0, 22.13)).toBeCloseTo(1, 6);
    });

    it('cresce com a area de contribuicao', () => {
        const l0 = lFactorDesmetGovers(0, deg(8), 0, 30);
        const l1 = lFactorDesmetGovers(30 * 100, deg(8), 0, 30);
        const l2 = lFactorDesmetGovers(30 * 300, deg(8), 0, 30);
        expect(l1).toBeGreaterThan(l0);
        expect(l2).toBeGreaterThan(l1);
    });
});

describe('fillDepressions', () => {
    it('levanta o buraco ate a cota do anel em volta e mantem as bordas', () => {
        const values = Float32Array.from([
            10, 10, 10, 10, 10,
            10, 9, 9, 9, 10,
            10, 9, 1, 9, 10,
            10, 9, 9, 9, 10,
            10, 10, 10, 5, 10,
        ]);
        const filled = fillDepressions(values, 5, 5);
        expect(filled[0]).toBe(10);
        expect(filled[4 * 5 + 3]).toBe(5); // saida na borda
        // o anel de cota 9 e a soleira: o fundo (1) sobe ate logo acima dela, e as
        // celulas planas ganham um declive minimo (epsilon) ate a saida
        expect(filled[1 * 5 + 2]).toBeGreaterThanOrEqual(9);
        expect(filled[1 * 5 + 2]).toBeLessThan(9.01);
        expect(filled[2 * 5 + 2]).toBeGreaterThan(9);
        expect(filled[2 * 5 + 2]).toBeLessThan(9.01);
    });

    it('celula sem dado vira NaN e funciona como saida', () => {
        const values = Float32Array.from([5, 5, 5, 5, -9999, 5, 5, 5, 5]);
        const filled = fillDepressions(values, 3, 3, -9999);
        expect(Number.isNaN(filled[4])).toBe(true);
        expect(filled[0]).toBe(5);
    });
});

describe('flowAccumulation', () => {
    it('num plano a area acumula descendo a encosta', () => {
        const p = plane({ slopeDeg: 5 });
        const filled = fillDepressions(p.values, p.width, p.height);
        const acc = flowAccumulation(filled, p.width, p.height, p.pixelW, p.pixelH);
        const cell = 30 * 30;
        const col = 10;
        // topo (sul, y = 20) so tem a propria celula; descendo, cada linha soma uma
        expect(acc[20 * p.width + col]).toBeCloseTo(cell, 3);
        expect(acc[15 * p.width + col]).toBeCloseTo(6 * cell, 0);
        expect(acc[1 * p.width + col]).toBeGreaterThan(acc[10 * p.width + col]);
    });
});

describe('computeFlowLs', () => {
    it('torre mais abaixo na encosta tem LS maior que a do topo', () => {
        const p = plane({ slopeDeg: 6, width: 41, height: 41 });
        const baixo = computeFlowLs({ ...p, cx: 20, cy: 5, radiusM: 50 });
        const topo = computeFlowLs({ ...p, cx: 20, cy: 35, radiusM: 50 });
        expect(baixo.ls).toBeGreaterThan(topo.ls);
        expect(baixo.rampaEquivM).toBeGreaterThan(topo.rampaEquivM);
        expect(baixo.lsMax).toBeGreaterThanOrEqual(baixo.ls);
    });

    it('o limite de rampa segura o LS no pe de encostas longas', () => {
        const p = plane({ slopeDeg: 6, width: 61, height: 61 });
        const livre = computeFlowLs({ ...p, cx: 30, cy: 3, radiusM: 30, maxRampaM: 10000 });
        const limitado = computeFlowLs({ ...p, cx: 30, cy: 3, radiusM: 30, maxRampaM: 300 });
        expect(limitado.rampaEquivM).toBeLessThanOrEqual(300);
        expect(limitado.ls).toBeLessThan(livre.ls);
    });

    it('plano sem area a montante equivale ao L de uma celula', () => {
        const p = plane({ slopeDeg: 6, width: 9, height: 9 });
        const out = computeFlowLs({ ...p, cx: 4, cy: 4, radiusM: 10, maxRampaM: 0 });
        const slope = deg(6);
        const esperado = lFactorDesmetGovers(0, slope, Math.PI, 30) * sFactorMcCool(slope);
        expect(out.ls).toBeCloseTo(esperado, 1);
        expect(out.pixels).toBe(1);
    });

    it('janela sem dado devolve null', () => {
        const values = new Float32Array(9).fill(-9999);
        expect(computeFlowLs({ values, width: 3, height: 3, pixelW: 30, pixelH: 30, cx: 1, cy: 1, radiusM: 50, nodata: -9999 })).toBeNull();
    });
});
