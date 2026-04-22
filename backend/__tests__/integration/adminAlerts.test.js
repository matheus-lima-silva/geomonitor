// Integration: GET /api/admin/alerts e POST /api/admin/alerts/:id/ack.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'admin-1', email: 'admin@test.local' };
        req.userProfile = { status: 'Ativo', perfil: 'Administrador' };
        next();
    };
    return {
        verifyToken: pass,
        requireActiveUser: pass,
        requireActiveUserOrWorker: pass,
        requireEditor: [pass],
        requireEditorOrWorker: pass,
        requireAdmin: [pass],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

jest.mock('../../data/postgresStore', () => ({
    __getPool: () => ({ connect: jest.fn() }),
    query: jest.fn(async () => ({ rows: [] })),
}));

const mockAlertsRepo = {
    listRecent: jest.fn(),
    acknowledge: jest.fn(),
    getById: jest.fn(),
    insert: jest.fn(),
};

jest.mock('../../repositories/systemAlertsRepository', () => mockAlertsRepo);

const request = require('supertest');
const app = require('../../server');

beforeEach(() => {
    mockAlertsRepo.listRecent.mockReset();
    mockAlertsRepo.acknowledge.mockReset();
    mockAlertsRepo.getById.mockReset();
    mockAlertsRepo.insert.mockReset();
});

describe('GET /api/admin/alerts', () => {
    test('retorna lista paginada com HATEOAS', async () => {
        mockAlertsRepo.listRecent.mockResolvedValueOnce({
            items: [
                {
                    id: '1',
                    type: 'query_count_exceeded',
                    payload: { method: 'GET', url: '/api/x', count: 20, threshold: 15 },
                    createdAt: '2026-04-22T10:00:00Z',
                    acknowledgedAt: null,
                    acknowledgedBy: null,
                },
            ],
            total: 1,
            page: 1,
            limit: 20,
        });

        const res = await request(app).get('/api/admin/alerts');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data[0]).toHaveProperty('_links.self.href');
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
        expect(res.body._links).toHaveProperty('self');
        expect(mockAlertsRepo.listRecent).toHaveBeenCalledWith({
            page: 1,
            limit: 20,
            onlyPending: true,
        });
    });

    test('aceita status=all para listar todos', async () => {
        mockAlertsRepo.listRecent.mockResolvedValueOnce({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
        });

        await request(app).get('/api/admin/alerts?status=all');

        expect(mockAlertsRepo.listRecent).toHaveBeenCalledWith({
            page: 1,
            limit: 20,
            onlyPending: false,
        });
    });

    test('respeita page e limit', async () => {
        mockAlertsRepo.listRecent.mockResolvedValueOnce({
            items: [],
            total: 0,
            page: 3,
            limit: 5,
        });

        await request(app).get('/api/admin/alerts?page=3&limit=5');

        expect(mockAlertsRepo.listRecent).toHaveBeenCalledWith({
            page: 3,
            limit: 5,
            onlyPending: true,
        });
    });
});

describe('POST /api/admin/alerts/:id/ack', () => {
    test('marca como revisado e retorna o alerta atualizado', async () => {
        mockAlertsRepo.acknowledge.mockResolvedValueOnce({
            id: '42',
            type: 'query_count_exceeded',
            payload: {},
            createdAt: '2026-04-22T10:00:00Z',
            acknowledgedAt: '2026-04-22T11:00:00Z',
            acknowledgedBy: 'admin@test.local',
        });

        const res = await request(app).post('/api/admin/alerts/42/ack');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.acknowledgedBy).toBe('admin@test.local');
        expect(res.body.data._links.self.href).toContain('admin/alerts/42');
        expect(mockAlertsRepo.acknowledge).toHaveBeenCalledWith(42, 'admin@test.local');
    });

    test('retorna 400 para id invalido', async () => {
        const res = await request(app).post('/api/admin/alerts/not-a-number/ack');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_ALERT_ID');
        expect(mockAlertsRepo.acknowledge).not.toHaveBeenCalled();
    });

    test('retorna 404 quando alerta nao existe', async () => {
        mockAlertsRepo.acknowledge.mockResolvedValueOnce(null);
        mockAlertsRepo.getById.mockResolvedValueOnce(null);

        const res = await request(app).post('/api/admin/alerts/999/ack');

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('ALERT_NOT_FOUND');
    });

    test('retorna 409 quando alerta ja foi revisado', async () => {
        mockAlertsRepo.acknowledge.mockResolvedValueOnce(null);
        mockAlertsRepo.getById.mockResolvedValueOnce({
            id: '7',
            type: 'query_count_exceeded',
            payload: {},
            createdAt: '2026-04-22T10:00:00Z',
            acknowledgedAt: '2026-04-22T10:30:00Z',
            acknowledgedBy: 'prev@test.local',
        });

        const res = await request(app).post('/api/admin/alerts/7/ack');

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('ALERT_ALREADY_ACKNOWLEDGED');
    });
});
