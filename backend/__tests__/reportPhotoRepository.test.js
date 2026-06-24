// Unit test deterministico do fix de race "trash <-> archive de fotos". A
// reproducao da race real (transicoes concorrentes) vive no PBT opt-in
// reportPhotoState.race.pbt.test.js; aqui asseguramos que softDelete/restore
// carregam o guard de estado de origem (impede o estado incoerente
// deleted_at + archived_at ambos non-null) no gate padrao.
const mockQuery = jest.fn(async () => ({ rows: [] }));

jest.mock('../data/postgresStore', () => ({
    query: mockQuery,
    connect: jest.fn(),
}));

const repo = require('../repositories/reportPhotoRepository');

function updateSqlMatching(pattern) {
    const call = mockQuery.mock.calls.find(
        (c) => /UPDATE report_photos/.test(c[0]) && pattern.test(c[0]),
    );
    return call ? call[0] : null;
}

describe('reportPhotoRepository transicoes state-aware', () => {
    beforeEach(() => {
        mockQuery.mockClear();
    });

    test('softDelete so move para lixeira fotos NAO arquivadas (archived_at IS NULL)', async () => {
        await repo.softDelete('PH-1');
        const sql = updateSqlMatching(/deleted_at = NOW\(\)/);
        expect(sql).toBeTruthy();
        expect(sql).toMatch(/archived_at IS NULL/);
    });

    test('restore so age sobre fotos de fato na lixeira (deleted_at IS NOT NULL)', async () => {
        await repo.restore('PH-1');
        const sql = updateSqlMatching(/deleted_at = NULL/);
        expect(sql).toBeTruthy();
        expect(sql).toMatch(/deleted_at IS NOT NULL/);
    });

    test('archive permanece guardado (so de lixeira, nao re-arquiva)', async () => {
        await repo.archive('PH-1');
        const sql = updateSqlMatching(/archived_at = NOW\(\)/);
        expect(sql).toBeTruthy();
        expect(sql).toMatch(/deleted_at IS NOT NULL/);
        expect(sql).toMatch(/archived_at IS NULL/);
    });

    test('unarchiveToTrash permanece guardado (so de arquivado)', async () => {
        await repo.unarchiveToTrash('PH-1');
        const sql = updateSqlMatching(/archived_at = NULL/);
        expect(sql).toBeTruthy();
        expect(sql).toMatch(/archived_at IS NOT NULL/);
    });
});
