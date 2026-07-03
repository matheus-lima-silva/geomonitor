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

    it('bloco list sem nenhum item salvo continua pendencia (sem listItemsMap)', () => {
        const pendencies = computePendencies(manifest, { usina: 'x', cnpj: 'y' });
        expect(pendencies).toContainEqual(
            { kind: 'list', key: 'brigadistas', label: 'Relacao de brigadistas', section: null },
        );
    });

    it('bloco list com pelo menos 1 item salvo deixa de ser pendencia', () => {
        const pendencies = computePendencies(manifest, { usina: 'x', cnpj: 'y' }, {
            brigadistas: [{ nome: 'Fulano' }],
        });
        expect(pendencies.some((p) => p.key === 'brigadistas')).toBe(false);
    });

    it('bloco list com array vazio continua pendencia', () => {
        const pendencies = computePendencies(manifest, { usina: 'x', cnpj: 'y' }, { brigadistas: [] });
        expect(pendencies).toContainEqual(
            { kind: 'list', key: 'brigadistas', label: 'Relacao de brigadistas', section: null },
        );
    });

    it('bloco manual e sempre pendencia, independente de listItemsMap', () => {
        const pendencies = computePendencies(manifest, { usina: 'x', cnpj: 'y' }, {
            anexo_vii: [{ qualquer: 'coisa' }],
        });
        expect(pendencies).toContainEqual(
            { kind: 'manual_block', key: 'anexo_vii', label: 'Rota de fuga', section: null },
        );
    });

    it('imageSlot sem nenhuma imagem salva vira pendencia image', () => {
        const withSlots = {
            ...manifest,
            imageSlots: [{ assetKey: 'rota_de_fuga', label: 'Rota de fuga (imagens)', maxImages: 5 }],
        };
        const pendencies = computePendencies(withSlots, { usina: 'x', cnpj: 'y' }, {}, {});
        expect(pendencies).toContainEqual(
            { kind: 'image', key: 'rota_de_fuga', label: 'Rota de fuga (imagens)', section: null },
        );
    });

    it('imageSlot com pelo menos 1 imagem deixa de ser pendencia', () => {
        const withSlots = {
            ...manifest,
            imageSlots: [{ assetKey: 'rota_de_fuga', label: 'Rota de fuga (imagens)', maxImages: 5 }],
        };
        const pendencies = computePendencies(withSlots, { usina: 'x', cnpj: 'y' }, {}, {
            rota_de_fuga: ['MEDIA-1'],
        });
        expect(pendencies.some((p) => p.key === 'rota_de_fuga')).toBe(false);
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
