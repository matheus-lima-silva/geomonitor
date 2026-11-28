const {
    resolveInspectionDateForTower,
    buildCriticalityHistory,
} = require('../utils/internalErosionHelpers');

describe('resolveInspectionDateForTower', () => {
    const inspection = {
        dataInicio: '2026-11-12',
        dataFim: '2026-11-13',
        detalhesDias: [
            { data: '2026-11-13', torres: ['104', '105'] },
            { data: '2026-11-12', torres: ['100'], torresDetalhadas: [{ numero: '101' }] },
        ],
    };

    it('usa o dia em que a torre aparece na vistoria', () => {
        expect(resolveInspectionDateForTower(inspection, '104')).toBe('2026-11-13');
        expect(resolveInspectionDateForTower(inspection, ' 104 ')).toBe('2026-11-13');
    });

    it('aceita a torre listada so em torresDetalhadas', () => {
        expect(resolveInspectionDateForTower(inspection, '101')).toBe('2026-11-12');
    });

    it('cai no inicio da vistoria quando a torre nao aparece', () => {
        expect(resolveInspectionDateForTower(inspection, '999')).toBe('2026-11-12');
        expect(resolveInspectionDateForTower(inspection, '')).toBe('2026-11-12');
    });

    it('retorna vazio sem vistoria ou sem datas', () => {
        expect(resolveInspectionDateForTower(null, '104')).toBe('');
        expect(resolveInspectionDateForTower({ detalhesDias: [] }, '104')).toBe('');
    });
});

describe('buildCriticalityHistory', () => {
    it('prioriza dataVistoria explicita sobre a data da vistoria vinculada', () => {
        const history = buildCriticalityHistory(null, { dataVistoria: '2026-10-01', status: 'Ativo' }, { score: 10 }, { inspectionDate: '2026-11-13' });
        expect(history[0].data_vistoria).toBe('2026-10-01');
    });

    it('usa a data da vistoria vinculada quando o payload nao traz data', () => {
        const history = buildCriticalityHistory(null, { status: 'Ativo' }, { score: 10 }, { inspectionDate: '2026-11-13' });
        expect(history[0].data_vistoria).toBe('2026-11-13');
    });

    it('sem vistoria mantem o comportamento antigo (data do dia)', () => {
        const history = buildCriticalityHistory(null, { status: 'Ativo' }, { score: 10 });
        expect(history[0].data_vistoria).toBe(new Date().toISOString().slice(0, 10));
    });
});
