// Valida comportamento do crudFactory end-to-end via supertest:
// - POST retorna 201 com body HATEOAS
// - POST com payload invalido retorna 400 VALIDATION_ERROR
// - PUT retorna 200 (nao 201)
// - DELETE retorna 204 sem body
// - GET / pagina quando ?page ou ?limit presentes
// - GET / retorna legado (array) quando nenhum param

// Mocks de middlewares e repositorios — executam ANTES do require(app).
jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'test-user', email: 'test@test.local' };
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

jest.mock('../../utils/workspaceAccess', () => ({
    isGlobalSuperuser: () => true,
    checkWorkspaceAccess: () => ({ allowed: true }),
    requireWorkspaceRead: (req, res, next) => next(),
    requireWorkspaceWrite: (req, res, next) => next(),
}));

// Mock state compartilhado — cada test pode resetar.
const mockInspectionState = { items: new Map() };

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    const noopPaginated = jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 }));
    return {
        inspectionRepository: {
            list: jest.fn(async () => Array.from(mockInspectionState.items.values())),
            listPaginated: jest.fn(async ({ page = 1, limit = 50 } = {}) => {
                const all = Array.from(mockInspectionState.items.values());
                const p = Number(page) || 1;
                const l = Number(limit) || 50;
                const start = (p - 1) * l;
                return { items: all.slice(start, start + l), total: all.length, page: p, limit: l };
            }),
            getById: jest.fn(async (id) => mockInspectionState.items.get(id) || null),
            save: jest.fn(async (data) => {
                mockInspectionState.items.set(data.id, data);
                return data;
            }),
            remove: jest.fn(async (id) => {
                mockInspectionState.items.delete(id);
            }),
        },
        userRepository: { list: noopList, getById: jest.fn(async () => null), save: jest.fn(), remove: jest.fn(), listPaginated: noopPaginated },
        erosionRepository: { list: noopList, listPaginated: noopPaginated, getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList, getById: jest.fn() },
        reportJobRepository: { list: noopList, getById: jest.fn(async () => null), save: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn() },
        mediaAssetRepository: { getById: jest.fn(async () => null) },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listWorkspaceIdsByUser: jest.fn(async () => []),
            addMember: jest.fn(),
        },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

const validInspection = {
    data: {
        id: 'VS-TEST-1',
        projetoId: 'PROJ-1',
        dataInicio: '2026-01-15',
        dataFim: '2026-01-20',
        status: 'aberta',
        detalhesDias: [],
    },
    meta: { updatedBy: 'test@test.local' },
};

beforeEach(() => {
    mockInspectionState.items.clear();
});

describe('crudFactory end-to-end (via /api/inspections)', () => {
    describe('POST /', () => {
        it('retorna 201 com _links e body HATEOAS', async () => {
            const res = await request(app)
                .post('/api/inspections')
                .set('Authorization', 'Bearer test-token')
                .send(validInspection);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data._links).toBeDefined();
            expect(res.body.data._links.self.href).toContain('inspections/VS-TEST-1');
            expect(res.body.data._links.update.method).toBe('PUT');
            expect(res.body.data._links.delete.method).toBe('DELETE');
        });

        it('rejeita payload sem projetoId com 400 VALIDATION_ERROR', async () => {
            const res = await request(app)
                .post('/api/inspections')
                .set('Authorization', 'Bearer test-token')
                .send({
                    data: {
                        id: 'VS-BAD',
                        dataInicio: '2026-01-15',
                        // projetoId ausente
                    },
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(Array.isArray(res.body.errors)).toBe(true);
            expect(res.body.errors.some((e) => e.path.includes('projetoId'))).toBe(true);
        });

        it('rejeita body sem data com 400', async () => {
            const res = await request(app)
                .post('/api/inspections')
                .set('Authorization', 'Bearer test-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('PUT /:id', () => {
        it('retorna 200 (nao 201) com body HATEOAS', async () => {
            // Primeiro cria via POST
            await request(app)
                .post('/api/inspections')
                .set('Authorization', 'Bearer test-token')
                .send(validInspection);

            const res = await request(app)
                .put('/api/inspections/VS-TEST-1')
                .set('Authorization', 'Bearer test-token')
                .send({
                    data: {
                        projetoId: 'PROJ-1',
                        dataInicio: '2026-01-15',
                        status: 'concluida',
                    },
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data._links.self.href).toContain('inspections/VS-TEST-1');
        });
    });

    describe('DELETE /:id', () => {
        it('retorna 204 sem body', async () => {
            // Cria primeiro
            await request(app)
                .post('/api/inspections')
                .set('Authorization', 'Bearer test-token')
                .send(validInspection);

            const res = await request(app)
                .delete('/api/inspections/VS-TEST-1')
                .set('Authorization', 'Bearer test-token');

            expect(res.status).toBe(204);
            // 204 nao deve ter body
            expect(res.body).toEqual({});
            // supertest .text vira '' ou undefined em 204
            expect(res.text === '' || res.text === undefined).toBe(true);
        });
    });

    describe('GET /', () => {
        it('retorna array legado quando sem query params', async () => {
            // Cria 2
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send(validInspection);
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send({
                ...validInspection,
                data: { ...validInspection.data, id: 'VS-TEST-2' },
            });

            const res = await request(app)
                .get('/api/inspections')
                .set('Authorization', 'Bearer test-token');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeUndefined(); // legado — sem pagination
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]._links.self).toBeDefined();
        });

        it('retorna envelope paginado quando ?page=1&limit=1', async () => {
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send(validInspection);
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send({
                ...validInspection,
                data: { ...validInspection.data, id: 'VS-TEST-2' },
            });

            const res = await request(app)
                .get('/api/inspections?page=1&limit=1')
                .set('Authorization', 'Bearer test-token');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination).toEqual({
                page: 1,
                limit: 1,
                total: 2,
                totalPages: 2,
            });
            expect(res.body._links.next.href).toContain('page=2');
            expect(res.body._links.last.href).toContain('page=2');
            expect(res.body._links.prev).toBeUndefined();
        });

        it('pagina 2 tem prev mas nao next (quando e a ultima)', async () => {
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send(validInspection);
            await request(app).post('/api/inspections').set('Authorization', 'Bearer t').send({
                ...validInspection,
                data: { ...validInspection.data, id: 'VS-TEST-2' },
            });

            const res = await request(app)
                .get('/api/inspections?page=2&limit=1')
                .set('Authorization', 'Bearer test-token');

            expect(res.status).toBe(200);
            expect(res.body._links.prev.href).toContain('page=1');
            expect(res.body._links.next).toBeUndefined();
        });
    });
});
