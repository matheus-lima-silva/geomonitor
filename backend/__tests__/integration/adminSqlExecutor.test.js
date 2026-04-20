// Testa o console SQL admin: POST /api/admin/sql/execute e GET /api/admin/sql/audit.

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

// Mock do pool do Postgres: controla o que client.query() retorna.
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn(async () => ({
    query: mockClientQuery,
    release: mockClientRelease,
}));

jest.mock('../../data/postgresStore', () => ({
    __getPool: () => ({ connect: mockConnect }),
    query: jest.fn(async () => ({ rows: [] })),
}));

const auditRows = [];
jest.mock('../../repositories', () => ({
    adminSqlAuditRepository: {
        insert: jest.fn(async (entry) => {
            const record = { id: String(auditRows.length + 1), ...entry, executedAt: new Date().toISOString() };
            auditRows.push(record);
            return record;
        }),
        list: jest.fn(async ({ page = 1, limit = 20 } = {}) => {
            const total = auditRows.length;
            const start = (page - 1) * limit;
            return {
                items: auditRows.slice().reverse().slice(start, start + limit),
                total,
                page,
                limit,
            };
        }),
    },
    userRepository: { list: jest.fn(async () => []) },
    reportDefaultsRepository: {},
    reportWorkspaceRepository: {},
    reportPhotoRepository: {},
    projectRepository: {},
    operatingLicenseRepository: {},
    inspectionRepository: {},
    erosionRepository: {},
    reportDeliveryTrackingRepository: {},
    projectPhotoExportRepository: {},
    projectDossierRepository: {},
    reportCompoundRepository: {},
    reportArchiveRepository: {},
    reportJobRepository: {},
    workspaceImportRepository: {},
    workspaceKmzRequestRepository: {},
    mediaAssetRepository: {},
    reportTemplateRepository: {},
    rulesConfigRepository: {},
    workspaceMemberRepository: {},
}));

const request = require('supertest');
const app = require('../../server');

function resetMocks() {
    mockClientQuery.mockReset();
    mockClientRelease.mockReset();
    mockConnect.mockClear();
    auditRows.length = 0;
}

describe('POST /api/admin/sql/execute', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('executa SELECT e retorna rows + columns + envelope HATEOAS', async () => {
        mockClientQuery
            .mockResolvedValueOnce({}) // BEGIN READ ONLY
            .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
            .mockResolvedValueOnce({
                rows: [{ id: 1, nome: 'Alice' }, { id: 2, nome: 'Bob' }],
                fields: [{ name: 'id' }, { name: 'nome' }],
                command: 'SELECT',
            })
            .mockResolvedValueOnce({}); // ROLLBACK

        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: { sql: 'SELECT id, nome FROM users LIMIT 2' } });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.columns).toEqual(['id', 'nome']);
        expect(res.body.data.rows).toHaveLength(2);
        expect(res.body.data.rowCount).toBe(2);
        expect(res.body.data.truncated).toBe(false);
        expect(res.body.data._links.self.href).toContain('admin/sql/execute');

        expect(auditRows).toHaveLength(1);
        expect(auditRows[0].status).toBe('success');
        expect(auditRows[0].executedBy).toBe('admin@test.local');
    });

    it('bloqueia INSERT com 400 e audita status=blocked', async () => {
        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: { sql: 'INSERT INTO users VALUES (1)' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SQL_NOT_READ_ONLY');
        expect(mockConnect).not.toHaveBeenCalled();
        expect(auditRows).toHaveLength(1);
        expect(auditRows[0].status).toBe('blocked');
    });

    it('bloqueia multi-statement (SELECT; DROP TABLE)', async () => {
        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: { sql: 'SELECT 1; DROP TABLE users' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SQL_NOT_READ_ONLY');
        expect(auditRows[0].status).toBe('blocked');
    });

    it('trunca resultado em MAX_ROWS e marca truncated=true', async () => {
        const hugeRows = Array.from({ length: 1500 }, (_, i) => ({ n: i }));
        mockClientQuery
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: hugeRows, fields: [{ name: 'n' }], command: 'SELECT' })
            .mockResolvedValueOnce({});

        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: { sql: 'SELECT n FROM generate_series(1, 1500) n' } });

        expect(res.status).toBe(200);
        expect(res.body.data.rows).toHaveLength(1000);
        expect(res.body.data.rowCount).toBe(1500);
        expect(res.body.data.truncated).toBe(true);
    });

    it('rejeita body sem data.sql com 400 VALIDATION_ERROR', async () => {
        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: {} });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('propaga erro do Postgres com 400 SQL_EXECUTION_ERROR e audita status=error', async () => {
        mockClientQuery
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // SET LOCAL
            .mockRejectedValueOnce(new Error('relation "nao_existe" does not exist'))
            .mockResolvedValueOnce({}); // ROLLBACK

        const res = await request(app)
            .post('/api/admin/sql/execute')
            .set('Authorization', 'Bearer t')
            .send({ data: { sql: 'SELECT * FROM nao_existe' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SQL_EXECUTION_ERROR');
        expect(res.body.message).toContain('nao_existe');
        expect(auditRows[0].status).toBe('error');
        expect(auditRows[0].errorMessage).toContain('nao_existe');
    });
});

describe('GET /api/admin/sql/audit', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('lista audit paginado com envelope HATEOAS', async () => {
        for (let i = 0; i < 5; i += 1) {
            auditRows.push({
                id: String(i + 1),
                executedBy: 'admin@test.local',
                sqlText: `SELECT ${i}`,
                rowCount: i,
                durationMs: 10,
                status: 'success',
                errorMessage: null,
                executedAt: new Date().toISOString(),
            });
        }

        const res = await request(app)
            .get('/api/admin/sql/audit?page=1&limit=3')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveLength(3);
        expect(res.body.pagination).toEqual(expect.objectContaining({
            page: 1,
            limit: 3,
            total: 5,
        }));
        expect(res.body._links.self.href).toContain('admin/sql/audit');
    });
});
