// Cobre endpoints de routes/reports.js: GET /:id, POST /preflight, POST /generate.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'test', email: 'test@test.local' };
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

const mockState = { jobs: new Map() };

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        reportJobRepository: {
            list: jest.fn(async () => Array.from(mockState.jobs.values())),
            getById: jest.fn(async (id) => mockState.jobs.get(id) || null),
            save: jest.fn(async (data) => {
                mockState.jobs.set(data.id, data);
                return data;
            }),
            remove: jest.fn(async (id) => { mockState.jobs.delete(id); }),
        },
        userRepository: { list: noopList, getById: jest.fn(), save: jest.fn(), listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })) },
        erosionRepository: { list: noopList, listPaginated: jest.fn(), getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        inspectionRepository: { list: noopList, listPaginated: jest.fn(), getById: jest.fn(), save: jest.fn(), remove: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn() },
        mediaAssetRepository: { getById: jest.fn() },
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

beforeEach(() => {
    mockState.jobs.clear();
});

describe('GET /api/reports/:id', () => {
    it('retorna 200 com _links quando relatorio existe', async () => {
        mockState.jobs.set('REP-1', {
            id: 'REP-1',
            kind: 'report_legacy',
            workspaceId: 'WS-1',
            statusExecucao: 'ready',
            nome: 'Relatorio teste',
        });

        const res = await request(app)
            .get('/api/reports/REP-1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.id).toBe('REP-1');
        expect(res.body.data._links.self.href).toContain('reports/REP-1');
    });

    it('retorna 404 quando relatorio nao existe', async () => {
        const res = await request(app)
            .get('/api/reports/NAO-EXISTE')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(404);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toBe('Relatorio nao encontrado');
    });
});

describe('POST /api/reports/preflight', () => {
    it('retorna 200 com _links.generate quando slots validos', async () => {
        const res = await request(app)
            .post('/api/reports/preflight')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    workspaceId: 'WS-1',
                    slots: [
                        { id: 'slot-1', label: 'Projeto A', projectId: 'PROJ-A', assetCount: 5 },
                        { id: 'slot-2', label: 'Projeto B', projectId: 'PROJ-B', assetCount: 3 },
                    ],
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.workspaceId).toBe('WS-1');
        expect(res.body.data.slotCount).toBe(2);
        expect(res.body.data.readySlotCount).toBe(2);
        expect(res.body.data.canGenerate).toBe(true);
        expect(res.body.data.errors).toEqual([]);
        expect(res.body._links.self.href).toContain('reports/preflight');
        expect(res.body._links.generate.href).toContain('reports/generate');
    });

    it('retorna 200 com errors quando slots vazio', async () => {
        const res = await request(app)
            .post('/api/reports/preflight')
            .set('Authorization', 'Bearer t')
            .send({ data: { workspaceId: 'WS-1', slots: [] } });

        expect(res.status).toBe(200);
        expect(res.body.data.slotCount).toBe(0);
        expect(res.body.data.errors).toContain('Nenhum slot informado para preflight.');
        expect(res.body.data.canGenerate).toBe(false);
    });

    it('retorna warnings quando slots sem assets', async () => {
        const res = await request(app)
            .post('/api/reports/preflight')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    workspaceId: 'WS-1',
                    slots: [
                        { id: 'slot-1', projectId: 'PROJ-A', assetCount: 0 },
                        { id: 'slot-2', projectId: 'PROJ-B', assetCount: 0 },
                    ],
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.data.readySlotCount).toBe(0);
        expect(res.body.data.warnings).toContain('Nenhum slot possui assets contabilizados ainda.');
        // Sem errors, entao pode gerar (mesmo que vazio)
        expect(res.body.data.canGenerate).toBe(true);
    });

    it('aceita body vazio (schema tem default) e retorna errors', async () => {
        const res = await request(app)
            .post('/api/reports/preflight')
            .set('Authorization', 'Bearer t')
            .send({ data: {} });

        expect(res.status).toBe(200);
        expect(res.body.data.slotCount).toBe(0);
        expect(res.body.data.errors.length).toBeGreaterThan(0);
    });
});

describe('POST /api/reports/generate', () => {
    it('retorna 400 VALIDATION_ERROR quando falta workspaceId', async () => {
        const res = await request(app)
            .post('/api/reports/generate')
            .set('Authorization', 'Bearer t')
            .send({ data: { nome: 'Sem workspace' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.errors.some((e) => e.path.includes('workspaceId'))).toBe(true);
    });

    it('retorna 400 quando workspaceId e string vazia', async () => {
        const res = await request(app)
            .post('/api/reports/generate')
            .set('Authorization', 'Bearer t')
            .send({ data: { workspaceId: '', nome: 'X' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('retorna 400 quando data ausente', async () => {
        const res = await request(app)
            .post('/api/reports/generate')
            .set('Authorization', 'Bearer t')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('retorna 202 com _links e persiste no repository', async () => {
        const res = await request(app)
            .post('/api/reports/generate')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    workspaceId: 'WS-1',
                    nome: 'Relatorio Q1',
                    slots: [
                        { id: 'slot-1', projectId: 'PROJ-A', assetCount: 10 },
                    ],
                },
            });

        expect(res.status).toBe(202);
        expect(res.body.status).toBe('success');
        expect(res.body.data.workspaceId).toBe('WS-1');
        expect(res.body.data.nome).toBe('Relatorio Q1');
        expect(res.body.data.statusExecucao).toBe('queued');
        expect(res.body.data.kind).toBe('report_legacy');
        expect(res.body.data.slotCount).toBe(1);
        expect(res.body.data.readySlotCount).toBe(1);
        expect(res.body.data._links.self.href).toMatch(/reports\/REP-/);
        expect(res.body.data._links.update.method).toBe('PUT');

        // Confirma que foi persistido via save
        expect(mockState.jobs.size).toBe(1);
    });

    it('gera ID automatico com prefixo REP- quando nao fornecido', async () => {
        const res = await request(app)
            .post('/api/reports/generate')
            .set('Authorization', 'Bearer t')
            .send({ data: { workspaceId: 'WS-1' } });

        expect(res.status).toBe(202);
        expect(res.body.data.id).toMatch(/^REP-/);
    });
});
