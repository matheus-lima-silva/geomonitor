const { computeAuc, computeAucWithinGroups, erosionRateByClass } = require('../utils/rusleValidation');

describe('computeAuc', () => {
    it('separacao perfeita, inversa e empate', () => {
        const perfeita = [{ erosao: 1, valor: 10 }, { erosao: 1, valor: 8 }, { erosao: 0, valor: 2 }, { erosao: 0, valor: 1 }];
        expect(computeAuc(perfeita)).toEqual({ auc: 1, positivos: 2, negativos: 2 });
        expect(computeAuc(perfeita.map((r) => ({ ...r, valor: -r.valor }))).auc).toBe(0);
        expect(computeAuc([{ erosao: 1, valor: 5 }, { erosao: 0, valor: 5 }]).auc).toBe(0.5);
    });

    it('ignora valores ausentes e devolve null sem um dos grupos', () => {
        expect(computeAuc([{ erosao: 1, valor: 3 }, { erosao: 0, valor: null }])).toEqual({ auc: null, positivos: 1, negativos: 0 });
        // 1 par vencido de 2 -> 0,5; 3 > 2 e 3 < 4
        expect(computeAuc([{ erosao: 1, valor: 3 }, { erosao: 0, valor: 2 }, { erosao: 0, valor: 4 }]).auc).toBe(0.5);
    });
});

describe('computeAucWithinGroups', () => {
    it('compara so dentro do mesmo grupo', () => {
        // Geral: so o par (A 100 x B 2) e vencido, 1 de 4. Dentro dos grupos: nenhum.
        const rows = [
            { grupo: 'A', erosao: 1, valor: 100 }, { grupo: 'A', erosao: 0, valor: 200 },
            { grupo: 'B', erosao: 1, valor: 1 }, { grupo: 'B', erosao: 0, valor: 2 },
        ];
        expect(computeAuc(rows).auc).toBe(0.25);
        expect(computeAucWithinGroups(rows)).toEqual({ auc: 0, pares: 2 });
        expect(computeAucWithinGroups([{ grupo: 'A', erosao: 1, valor: 1 }])).toEqual({ auc: null, pares: 0 });
    });
});

describe('erosionRateByClass', () => {
    it('conta erosao e taxa por classe', () => {
        const rows = [
            { classe: 'baixa', erosao: 0 }, { classe: 'baixa', erosao: 1 },
            { classe: 'muito_alta', erosao: 1 },
        ];
        expect(erosionRateByClass(rows)).toEqual([
            { classe: 'baixa', comErosao: 1, total: 2, taxa: 0.5 },
            { classe: 'moderada', comErosao: 0, total: 0, taxa: null },
            { classe: 'alta', comErosao: 0, total: 0, taxa: null },
            { classe: 'muito_alta', comErosao: 1, total: 1, taxa: 1 },
        ]);
    });
});
