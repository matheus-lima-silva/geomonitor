jest.mock('../data/postgresStore', () => ({ query: jest.fn() }));

const postgresStore = require('../data/postgresStore');
const repo = require('../repositories/projectGeometryRepository');

describe('projectGeometryRepository', () => {
    beforeEach(() => postgresStore.query.mockReset());

    test('upsertFromProject roda o UPSERT parametrizado por projeto', async () => {
        postgresStore.query.mockResolvedValueOnce({ rows: [] });
        await repo.upsertFromProject('P1');

        expect(postgresStore.query).toHaveBeenCalledTimes(1);
        const [sql, params] = postgresStore.query.mock.calls[0];
        expect(sql).toContain('INSERT INTO project_geometries');
        expect(sql).toContain('ST_MakeLine');
        expect(sql).toContain('ST_Multi(ST_Collect');
        expect(sql).toContain('WHERE p.id = $1');
        expect(sql).toContain('ON CONFLICT (project_id) DO UPDATE');
        expect(params).toEqual(['P1']);
    });

    test('upsertFromProject ignora id vazio (nao toca o banco)', async () => {
        await repo.upsertFromProject('');
        expect(postgresStore.query).not.toHaveBeenCalled();
    });

    test('getByProject mapeia a row (WKT + flags)', async () => {
        postgresStore.query.mockResolvedValueOnce({
            rows: [{
                project_id: 'P1',
                axis_wkt: 'LINESTRING(-43 -22,-43.2 -22.2)',
                towers_wkt: 'MULTIPOINT((-43 -22))',
                has_axis: true,
                has_towers: true,
                updated_at: '2026-06-13T00:00:00.000Z',
            }],
        });
        const g = await repo.getByProject('P1');
        expect(g).toEqual({
            projectId: 'P1',
            axisWkt: 'LINESTRING(-43 -22,-43.2 -22.2)',
            towersWkt: 'MULTIPOINT((-43 -22))',
            hasAxis: true,
            hasTowers: true,
            updatedAt: '2026-06-13T00:00:00.000Z',
        });
    });

    test('getByProject retorna null quando nao ha geometria', async () => {
        postgresStore.query.mockResolvedValueOnce({ rows: [] });
        expect(await repo.getByProject('X')).toBeNull();
    });
});
