const { computePendencies, computeStats } = require('../utils/paecPendencies');

const manifest = {
    fields: [
        { key: 'usina', label: 'Usina', section: 'identificacao', required: true },
        { key: 'cnpj', label: 'CNPJ', section: 'identificacao', required: true },
        { key: 'obs', label: 'Observacao', section: null, required: false },
    ],
    blocks: [
        { key: 'brigadistas', kind: 'list', label: 'Relacao de brigadistas' },
        { key: 'anexo_vii', kind: 'manual', label: 'Rota de fuga' },
    ],
};

describe('computePendencies', () => {
    it('campo requerido sem valor vira pendencia field', () => {
        const pendencies = computePendencies(manifest, { usina: 'PCH Anta' });
        expect(pendencies).toEqual([
            { kind: 'field', key: 'cnpj', label: 'CNPJ', section: 'identificacao' },
            { kind: 'list', key: 'brigadistas', label: 'Relacao de brigadistas', section: null },
            { kind: 'manual_block', key: 'anexo_vii', label: 'Rota de fuga', section: null },
        ]);
    });

    it('campo opcional vazio nao gera pendencia', () => {
        const pendencies = computePendencies(manifest, { usina: 'x', cnpj: 'y' });
        expect(pendencies.filter((p) => p.kind === 'field')).toEqual([]);
    });

    it('valor so de espacos conta como vazio', () => {
        const pendencies = computePendencies(manifest, { usina: '   ', cnpj: 'y' });
        expect(pendencies[0]).toEqual(
            expect.objectContaining({ kind: 'field', key: 'usina' }),
        );
    });

    it('manifest vazio nao quebra', () => {
        expect(computePendencies(null, null)).toEqual([]);
        expect(computePendencies({}, {})).toEqual([]);
    });
});

describe('computeStats', () => {
    it('conta preenchidos x total', () => {
        expect(computeStats(manifest, { usina: 'x', obs: 'nota' })).toEqual({
            fieldsFilled: 2,
            fieldsTotal: 3,
        });
        expect(computeStats(manifest, {})).toEqual({ fieldsFilled: 0, fieldsTotal: 3 });
    });
});
