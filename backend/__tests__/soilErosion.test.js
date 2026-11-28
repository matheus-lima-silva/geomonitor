const {
    soilFormTypeFromIbge, provisionalK, coverC, lsFactor, computeRusle,
} = require('../utils/soilErosion');

describe('soilFormTypeFromIbge', () => {
    it.each([
        [{ ordem: 'NEOSSOLO', subordem: 'QUARTZARÊNICO', textura: 'arenosa' }, 'arenoso'],
        [{ ordem: 'ARGISSOLO', subordem: 'VERMELHO-AMARELO', textura: 'arenosa/média' }, 'arenoso'],
        [{ ordem: 'NEOSSOLO', subordem: 'LITÓLICO', textura: 'média' }, 'solos_rasos'],
        [{ ordem: 'CAMBISSOLO', subordem: 'HÁPLICO', textura: 'argilosa' }, 'solos_rasos'],
        [{ ordem: 'LATOSSOLO', subordem: 'VERMELHO', textura: 'muito argilosa' }, 'lateritico'],
        [{ ordem: 'ARGISSOLO', subordem: 'VERMELHO', textura: 'média/argilosa' }, 'argiloso'],
        [{ ordem: 'NITOSSOLO', subordem: 'VERMELHO', textura: 'argilosa' }, 'argiloso'],
        [{}, null],
    ])('%j -> %s', (input, expected) => {
        expect(soilFormTypeFromIbge(input)).toBe(expected);
    });
});

describe('fatores da RUSLE', () => {
    it('K provisorio por ordem (subordem mais especifica primeiro)', () => {
        expect(provisionalK({ ordem: 'LATOSSOLO' })).toBe(0.015);
        expect(provisionalK({ ordem: 'NEOSSOLO', subordem: 'LITÓLICO' })).toBe(0.045);
        expect(provisionalK({ ordem: 'ARGISSOLO' })).toBe(0.035);
        expect(provisionalK({ ordem: 'XYZ' })).toBeNull();
    });

    it('C ponderado pelas fracoes MapBiomas', () => {
        expect(coverC({ 15: 1 })).toBeCloseTo(0.05, 5);
        expect(coverC({ 15: 0.5, 39: 0.5 })).toBeCloseTo(0.125, 5);
        expect(coverC({ 999: 1 })).toBeNull();
    });

    it('LS cresce com a declividade', () => {
        expect(lsFactor(0)).toBeLessThan(lsFactor(5));
        expect(lsFactor(5)).toBeLessThan(lsFactor(15));
        // 5 graus, rampa 50 m: (50/22,13)^0,5 x (65,41 sen2 + 4,56 sen + 0,065) = 1,44
        expect(lsFactor(5)).toBeCloseTo(1.44, 2);
        expect(lsFactor(null)).toBeNull();
    });

    it('indice e classe; falta de fator devolve null', () => {
        const out = computeRusle({ r: 7200, k: 0.035, slopeDeg: 10, cobertura: { 15: 1 } });
        // 7200 x 0,035 x LS(10 graus)=4,25 x 0,05 = ~53,6
        expect(out.perdaSoloIndice).toBeCloseTo(53.6, 0);
        expect(out.classe).toBe('muito_alta');
        expect(out.fatores).toMatchObject({ R: 7200, K: 0.035, C: 0.05, P: 1 });
        expect(computeRusle({ r: 7200, k: 0.015, slopeDeg: 2, cobertura: { 3: 1 } }).classe).toBe('baixa');
        expect(computeRusle({ r: null, k: 0.035, slopeDeg: 10, cobertura: { 15: 1 } })).toBeNull();
    });

    it('registra a fonte do K na observacao', () => {
        expect(computeRusle({ r: 7200, k: 0.03, slopeDeg: 5, cobertura: { 15: 1 }, kFonte: 'embrapa' }))
            .toMatchObject({ kFonte: 'embrapa', observacao: expect.stringContaining('Embrapa') });
        expect(computeRusle({ r: 7200, k: 0.03, slopeDeg: 5, cobertura: { 15: 1 } }).kFonte).toBe('provisorio');
    });
});
