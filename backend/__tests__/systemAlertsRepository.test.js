jest.mock('../data/postgresStore', () => ({
    query: jest.fn(),
}));

const postgresStore = require('../data/postgresStore');
const repo = require('../repositories/systemAlertsRepository');

describe('systemAlertsRepository', () => {
    beforeEach(() => {
        postgresStore.query.mockReset();
    });

    test('insert grava e mapeia row', async () => {
        postgresStore.query.mockResolvedValueOnce({
            rows: [{
                id: 7,
                type: 'query_count_exceeded',
                payload: { count: 20 },
                created_at: '2026-04-22T12:00:00Z',
                acknowledged_at: null,
                acknowledged_by: null,
            }],
        });

        const result = await repo.insert({
            type: 'query_count_exceeded',
            payload: { count: 20 },
        });

        expect(postgresStore.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO system_alerts'),
            ['query_count_exceeded', JSON.stringify({ count: 20 })],
        );
        expect(result).toEqual({
            id: '7',
            type: 'query_count_exceeded',
            payload: { count: 20 },
            createdAt: '2026-04-22T12:00:00Z',
            acknowledgedAt: null,
            acknowledgedBy: null,
        });
    });

    test('listRecent sem onlyPending nao filtra', async () => {
        postgresStore.query
            .mockResolvedValueOnce({
                rows: [
                    { id: 2, type: 't', payload: {}, created_at: 'now', acknowledged_at: null, acknowledged_by: null },
                    { id: 1, type: 't', payload: {}, created_at: 'old', acknowledged_at: 'yes', acknowledged_by: 'u' },
                ],
            })
            .mockResolvedValueOnce({ rows: [{ n: 2 }] });

        const result = await repo.listRecent({ page: 1, limit: 10 });

        expect(postgresStore.query.mock.calls[0][0]).not.toContain('acknowledged_at IS NULL');
        expect(result.total).toBe(2);
        expect(result.items).toHaveLength(2);
    });

    test('listRecent com onlyPending filtra', async () => {
        postgresStore.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ n: 0 }] });

        await repo.listRecent({ onlyPending: true });

        expect(postgresStore.query.mock.calls[0][0]).toContain('acknowledged_at IS NULL');
        expect(postgresStore.query.mock.calls[1][0]).toContain('acknowledged_at IS NULL');
    });

    test('acknowledge marca e retorna row', async () => {
        postgresStore.query.mockResolvedValueOnce({
            rows: [{
                id: 5,
                type: 't',
                payload: {},
                created_at: 'now',
                acknowledged_at: 'now',
                acknowledged_by: 'admin@test',
            }],
        });

        const result = await repo.acknowledge('5', 'admin@test');

        expect(postgresStore.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE system_alerts'),
            [5, 'admin@test'],
        );
        expect(result.acknowledgedBy).toBe('admin@test');
    });

    test('acknowledge retorna null quando ja revisado (0 rows)', async () => {
        postgresStore.query.mockResolvedValueOnce({ rows: [] });
        const result = await repo.acknowledge(99, 'x@y');
        expect(result).toBeNull();
    });

    test('getById busca por id', async () => {
        postgresStore.query.mockResolvedValueOnce({
            rows: [{ id: 1, type: 't', payload: {}, created_at: 'now', acknowledged_at: null, acknowledged_by: null }],
        });
        const result = await repo.getById(1);
        expect(result.id).toBe('1');
    });

    test('getById retorna null quando inexistente', async () => {
        postgresStore.query.mockResolvedValueOnce({ rows: [] });
        expect(await repo.getById(1)).toBeNull();
    });
});
