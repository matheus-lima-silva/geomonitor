// Unit test deterministico do fix de race "ultimo owner". A reproducao da race
// real (DELETEs concorrentes) vive no PBT opt-in workspaceOwners.race.pbt.test.js;
// aqui asseguramos o contrato transacional e os desfechos no gate padrao.
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

const repo = require('../repositories/workspaceMemberRepository');

describe('workspaceMemberRepository.removeMemberGuardingLastOwner', () => {
    beforeEach(() => {
        mockClientQuery.mockReset();
        mockClientRelease.mockReset();
        mockConnect.mockClear();
    });

    function mockLockRows(lockRows) {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/^\s*SELECT/i.test(sql)) return { rows: lockRows };
            return { rows: [] };
        });
    }

    function executedSql() {
        return mockClientQuery.mock.calls.map((call) => call[0]);
    }

    test('remove membro non-owner (caminho feliz)', async () => {
        mockLockRows([
            { user_id: 'u1', role: 'owner' },
            { user_id: 'u2', role: 'editor' },
        ]);

        const out = await repo.removeMemberGuardingLastOwner('ws1', 'u2');

        expect(out).toEqual({ removed: true });
        const sqls = executedSql();
        expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
        expect(sqls.some((s) => /FOR UPDATE/.test(s))).toBe(true);
        expect(sqls.some((s) => /DELETE FROM workspace_members/.test(s))).toBe(true);
        expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('remove um owner quando ha mais de um', async () => {
        mockLockRows([
            { user_id: 'u1', role: 'owner' },
            { user_id: 'u2', role: 'owner' },
        ]);

        const out = await repo.removeMemberGuardingLastOwner('ws1', 'u1');

        expect(out).toEqual({ removed: true });
        expect(executedSql().some((s) => /DELETE FROM workspace_members/.test(s))).toBe(true);
    });

    test('bloqueia remocao do ultimo owner (sem DELETE, com ROLLBACK)', async () => {
        mockLockRows([
            { user_id: 'u1', role: 'owner' },
            { user_id: 'u2', role: 'editor' },
        ]);

        const out = await repo.removeMemberGuardingLastOwner('ws1', 'u1');

        expect(out).toEqual({ lastOwner: true });
        const sqls = executedSql();
        expect(sqls.some((s) => /DELETE/.test(s))).toBe(false);
        expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('retorna notFound quando o membro nao existe', async () => {
        mockLockRows([{ user_id: 'u1', role: 'owner' }]);

        const out = await repo.removeMemberGuardingLastOwner('ws1', 'ghost');

        expect(out).toEqual({ notFound: true });
        expect(executedSql().some((s) => /DELETE/.test(s))).toBe(false);
    });

    test('retorna notFound sem abrir transacao quando faltam ids', async () => {
        const out = await repo.removeMemberGuardingLastOwner('', 'u1');

        expect(out).toEqual({ notFound: true });
        expect(mockConnect).not.toHaveBeenCalled();
    });

    test('faz ROLLBACK e propaga erro inesperado', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/^\s*SELECT/i.test(sql)) throw new Error('boom');
            return { rows: [] };
        });

        await expect(repo.removeMemberGuardingLastOwner('ws1', 'u1')).rejects.toThrow('boom');
        expect(executedSql().some((s) => /ROLLBACK/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });
});
