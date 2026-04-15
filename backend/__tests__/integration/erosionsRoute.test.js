// Cobre endpoints GET /api/erosions (legado + paginado) e
// valida que o schema Zod fecha mass assignment no top-level do data.

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

const mockState = { erosions: new Map() };

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        erosionRepository: {
            list: jest.fn(async () => Array.from(mockState.erosions.values())),
            listPaginated: jest.fn(async ({ page = 1, limit = 50 } = {}) => {
                const items = Array.from(mockState.erosions.values());
                const p = Number(page) || 1;
                const l = Number(limit) || 50;
                const start = (p - 1) * l;
                return { items: items.slice(start, start + l), total: items.length, page: p, limit: l };
            }),
            getById: jest.fn(async (id) => mockState.erosions.get(id) || null),
            save: jest.fn(async (data) => {
                mockState.erosions.set(data.id, data);
                return data;
            }),
            remove: jest.fn(async (id) => { mockState.erosions.delete(id); }),
        },
        reportJobRepository: { save: jest.fn(), getById: jest.fn(async () => null), list: noopList },
        userRepository: { list: noopList, getById: jest.fn(), save: jest.fn(), listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })) },
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

jest.mock('../../utils/workerTrigger', () => ({
    triggerWorkerRun: jest.fn(),
}));

const request = require('supertest');
const app = require('../../server');

beforeEach(() => {
    mockState.erosions.clear();
});

describe('GET /api/erosions', () => {
    it('retorna array legado sem query params', async () => {
        mockState.erosions.set('ERS-1', { id: 'ERS-1', projetoId: 'P-1' });
        mockState.erosions.set('ERS-2', { id: 'ERS-2', projetoId: 'P-1' });

        const res = await request(app)
            .get('/api/erosions')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.pagination).toBeUndefined();
        expect(res.body.data[0]._links.self).toBeDefined();
    });

    it('retorna envelope paginado com ?page=1&limit=1', async () => {
        mockState.erosions.set('ERS-1', { id: 'ERS-1', projetoId: 'P-1' });
        mockState.erosions.set('ERS-2', { id: 'ERS-2', projetoId: 'P-1' });
        mockState.erosions.set('ERS-3', { id: 'ERS-3', projetoId: 'P-1' });

        const res = await request(app)
            .get('/api/erosions?page=1&limit=1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.pagination).toEqual({
            page: 1,
            limit: 1,
            total: 3,
            totalPages: 3,
        });
        expect(res.body._links.next.href).toContain('page=2');
        expect(res.body._links.last.href).toContain('page=3');
    });
});

describe('POST /api/erosions/fichas-cadastro/generate (Zod)', () => {
    it('rejeita body sem projectId', async () => {
        const res = await request(app)
            .post('/api/erosions/fichas-cadastro/generate')
            .set('Authorization', 'Bearer t')
            .send({ erosionIds: ['ERS-1'] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('aceita payload valido e enfileira job', async () => {
        const res = await request(app)
            .post('/api/erosions/fichas-cadastro/generate')
            .set('Authorization', 'Bearer t')
            .send({ projectId: 'PROJ-1', erosionIds: ['ERS-1', 'ERS-2'] });

        expect(res.status).toBe(202);
        expect(res.body.data.projectId).toBe('PROJ-1');
        expect(res.body.data.statusExecucao).toBe('queued');
    });
});

describe('DELETE /api/erosions/:id', () => {
    it('retorna 204 sem body', async () => {
        mockState.erosions.set('ERS-DEL', { id: 'ERS-DEL', projetoId: 'P-1' });

        const res = await request(app)
            .delete('/api/erosions/ERS-DEL')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(204);
        expect(res.text === '' || res.text === undefined).toBe(true);
    });
});
