// Unit test deterministico do fix de race "rotacao de refresh token". A
// reproducao da race real (reuse concorrente) vive no PBT opt-in
// refreshTokenRotation.race.pbt.test.js; aqui asseguramos o contrato
// transacional do rotate (FOR UPDATE + single-use + reuse detection + janela de
// graca) e os desfechos no gate padrao.
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn(async () => ({
    query: mockClientQuery,
    release: mockClientRelease,
}));
const mockQuery = jest.fn(async () => ({ rows: [] }));

jest.mock('../data/postgresStore', () => ({
    query: mockQuery,
    connect: mockConnect,
}));

const repo = require('../repositories/refreshTokenRepository');

function future(ms = 3_600_000) {
    return new Date(Date.now() + ms);
}
function past(ms = 1_000) {
    return new Date(Date.now() - ms);
}

function clientSql() {
    return mockClientQuery.mock.calls.map((c) => c[0]);
}

describe('refreshTokenRepository', () => {
    beforeEach(() => {
        mockClientQuery.mockReset();
        mockClientRelease.mockReset();
        mockConnect.mockClear();
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [] });
    });

    test('issueFamily insere e devolve jti + familyId distintos', async () => {
        const out = await repo.issueFamily('U-1');
        expect(out.jti).toBeTruthy();
        expect(out.familyId).toBeTruthy();
        expect(out.jti).not.toBe(out.familyId);
        expect(mockQuery.mock.calls.some((c) => /INSERT INTO refresh_tokens/.test(c[0]))).toBe(true);
    });

    test('rotate caminho feliz: consome o token e emite sucessor na mesma familia', async () => {
        const row = {
            jti: 'J-1', user_id: 'U-1', family_id: 'F-1',
            replaced_by: null, revoked_at: null, expires_at: future(),
        };
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE/.test(sql)) return { rows: [row] };
            return { rows: [] };
        });

        const out = await repo.rotate('J-1');

        expect(out.userId).toBe('U-1');
        expect(out.familyId).toBe('F-1');
        expect(out.jti).toBeTruthy();
        expect(out.jti).not.toBe('J-1');

        const sqls = clientSql();
        expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
        expect(sqls.some((s) => /FOR UPDATE/.test(s))).toBe(true);
        expect(sqls.some((s) => /INSERT INTO refresh_tokens/.test(s))).toBe(true);
        expect(sqls.some((s) => /SET revoked_at = NOW\(\), replaced_by/.test(s))).toBe(true);
        expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('rotate de jti desconhecido => reuse, com ROLLBACK', async () => {
        mockClientQuery.mockImplementation(async () => ({ rows: [] }));
        const out = await repo.rotate('J-ghost');
        expect(out).toEqual({ reuse: true });
        expect(clientSql().some((s) => /ROLLBACK/.test(s))).toBe(true);
    });

    test('rotate de token expirado => expired', async () => {
        const row = {
            jti: 'J-1', user_id: 'U-1', family_id: 'F-1',
            replaced_by: null, revoked_at: null, expires_at: past(),
        };
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE/.test(sql)) return { rows: [row] };
            return { rows: [] };
        });
        const out = await repo.rotate('J-1');
        expect(out.expired).toBe(true);
    });

    test('reuse concorrente DENTRO da graca => devolve o mesmo sucessor (idempotente)', async () => {
        const row = {
            jti: 'J-1', user_id: 'U-1', family_id: 'F-1',
            replaced_by: 'J-2', revoked_at: past(1_000), expires_at: future(),
        };
        const successor = { jti: 'J-2', user_id: 'U-1', family_id: 'F-1' };
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE/.test(sql)) return { rows: [row] };
            if (/SELECT jti, user_id, family_id FROM refresh_tokens/.test(sql)) return { rows: [successor] };
            return { rows: [] };
        });

        const out = await repo.rotate('J-1');

        expect(out).toEqual({
            jti: 'J-2', userId: 'U-1', familyId: 'F-1', idempotent: true,
        });
        // Nao revoga a familia dentro da graca.
        expect(clientSql().some((s) => /WHERE family_id = \$1 AND revoked_at IS NULL/.test(s))).toBe(false);
    });

    test('reuse FORA da graca => reuse e revoga a familia inteira', async () => {
        const row = {
            jti: 'J-1', user_id: 'U-1', family_id: 'F-1',
            replaced_by: 'J-2', revoked_at: past(60_000), expires_at: future(),
        };
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE/.test(sql)) return { rows: [row] };
            return { rows: [] };
        });

        const out = await repo.rotate('J-1');

        expect(out.reuse).toBe(true);
        expect(clientSql().some((s) => /WHERE family_id = \$1 AND revoked_at IS NULL/.test(s))).toBe(true);
    });

    test('rotate faz ROLLBACK e propaga erro inesperado, liberando o client', async () => {
        mockClientQuery.mockImplementation(async (sql) => {
            if (/FOR UPDATE/.test(sql)) throw new Error('boom');
            return { rows: [] };
        });
        await expect(repo.rotate('J-1')).rejects.toThrow('boom');
        expect(clientSql().some((s) => /ROLLBACK/.test(s))).toBe(true);
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('revokeFamilyByJti revoga a familia via subselect do jti', async () => {
        await repo.revokeFamilyByJti('J-1');
        const sql = mockQuery.mock.calls.map((c) => c[0]).find((s) => /UPDATE refresh_tokens/.test(s));
        expect(sql).toBeTruthy();
        expect(sql).toMatch(/family_id = \(SELECT family_id FROM refresh_tokens WHERE jti = \$1\)/);
    });

    test('deleteExpired apaga tokens ha muito expirados e devolve a contagem', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 7 });
        const removed = await repo.deleteExpired();

        expect(removed).toBe(7);
        const call = mockQuery.mock.calls.find((c) => /DELETE FROM refresh_tokens/.test(c[0]));
        expect(call).toBeTruthy();
        expect(call[0]).toMatch(/expires_at < NOW\(\) - \(\$1 \* INTERVAL '1 day'\)/);
        expect(call[1]).toEqual([1]);
    });

    test('deleteExpired respeita retentionDays custom', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        await repo.deleteExpired({ retentionDays: 30 });
        const call = mockQuery.mock.calls.find((c) => /DELETE FROM refresh_tokens/.test(c[0]));
        expect(call[1]).toEqual([30]);
    });
});
