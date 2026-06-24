// Unit test deterministico do fix de race "numeracao de versao de archives".
// A reproducao da race real (deliveries concorrentes) vive no PBT opt-in
// reportArchiveVersion.race.pbt.test.js; aqui asseguramos o contrato
// transacional (advisory lock por compound + MAX+1 dentro do lock) e o desfecho
// no gate padrao.
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn(async () => ({
    query: mockClientQuery,
    release: mockClientRelease,
}));

jest.mock('../data/postgresStore', () => ({
    query: jest.fn(),
    connect: mockConnect,
}));

const repo = require('../repositories/reportArchiveRepository');

function buildInsertedRow(version) {
    return {
        id: 'RA-1',
        compound_id: 'RC-1',
        version,
        delivered_at: new Date('2026-06-23T00:00:00.000Z'),
        delivered_by: 'admin@test.local',
        generated_media_id: 'MED-1',
        generated_sha256: 'abc',
        delivered_media_id: null,
        delivered_sha256: null,
        notes: null,
        snapshot_payload: {},
        created_at: new Date('2026-06-23T00:00:00.000Z'),
        updated_at: new Date('2026-06-23T00:00:00.000Z'),
    };
}

describe('reportArchiveRepository.createNextVersion', () => {
    beforeEach(() => {
        mockClientQuery.mockReset();
        mockClientRelease.mockReset();
        mockConnect.mockClear();
    });

    function executedSql() {
        return mockClientQuery.mock.calls.map((call) => call[0]);
    }

    test('aloca MAX(version)+1 dentro de transacao com advisory lock por compound', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/pg_advisory_xact_lock/.test(sql)) return { rows: [{}] };
            if (/MAX\(version\)/.test(sql)) return { rows: [{ max_version: 2 }] };
            if (/INSERT INTO report_archives/.test(sql)) return { rows: [buildInsertedRow(3)] };
            return { rows: [] };
        });

        const out = await repo.createNextVersion({
            id: 'RA-1',
            compoundId: 'RC-1',
            deliveredBy: 'admin@test.local',
            generatedMediaId: 'MED-1',
            generatedSha256: 'abc',
            snapshotPayload: {},
        });

        expect(out.version).toBe(3);
        expect(out.compoundId).toBe('RC-1');

        const sqls = executedSql();
        expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
        expect(sqls.some((s) => /pg_advisory_xact_lock\(hashtext\(\$1\)\)/.test(s))).toBe(true);
        expect(sqls.some((s) => /MAX\(version\)/.test(s))).toBe(true);
        expect(sqls.some((s) => /INSERT INTO report_archives/.test(s))).toBe(true);
        expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);

        // O lock precede a leitura do MAX (serializa antes de calcular a versao).
        const lockIdx = sqls.findIndex((s) => /pg_advisory_xact_lock/.test(s));
        const maxIdx = sqls.findIndex((s) => /MAX\(version\)/.test(s));
        expect(lockIdx).toBeGreaterThanOrEqual(0);
        expect(lockIdx).toBeLessThan(maxIdx);

        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('primeira entrega de um compound recebe version 1', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/pg_advisory_xact_lock/.test(sql)) return { rows: [{}] };
            if (/MAX\(version\)/.test(sql)) return { rows: [{ max_version: 0 }] };
            if (/INSERT INTO report_archives/.test(sql)) return { rows: [buildInsertedRow(1)] };
            return { rows: [] };
        });

        const out = await repo.createNextVersion({
            id: 'RA-1',
            compoundId: 'RC-1',
            generatedMediaId: 'MED-1',
            snapshotPayload: {},
        });

        expect(out.version).toBe(1);
    });

    test('faz ROLLBACK e propaga erro inesperado, liberando o client', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/pg_advisory_xact_lock/.test(sql)) return { rows: [{}] };
            if (/MAX\(version\)/.test(sql)) throw new Error('boom');
            return { rows: [] };
        });

        await expect(repo.createNextVersion({
            id: 'RA-1',
            compoundId: 'RC-1',
            generatedMediaId: 'MED-1',
        })).rejects.toThrow('boom');

        expect(executedSql().some((s) => /ROLLBACK/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });
});
