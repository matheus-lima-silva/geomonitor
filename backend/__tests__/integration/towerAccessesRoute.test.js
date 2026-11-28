// Rotas de acessos por torre (Fase 1b): previa, gravacao, edicao e remocao.

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
        requireAdminOrWorker: pass,
        requireAdmin: [pass],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

const mockAccesses = new Map();

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        projectRepository: {
            list: noopList,
            getById: jest.fn(async (id) => (id === 'ARAPCA'
                ? { id: 'ARAPCA', torresCoordenadas: [{ numero: '104', latitude: '-20.991', longitude: '-47.0002' }] }
                : null)),
        },
        osmRoadRepository: {
            hasCoverage: jest.fn(async () => true),
            classifyPoints: jest.fn(async (points) => points.map(([, lat]) => (lat < -20.9946 ? { surfaceClass: 'terra', inferred: true } : null))),
        },
        towerAccessRepository: {
            listByProject: jest.fn(async () => Array.from(mockAccesses.values())),
            getById: jest.fn(async (projectId, id) => mockAccesses.get(id) || null),
            insertMany: jest.fn(async (projectId, items) => items.map((item) => {
                const saved = { ...item, projectId };
                mockAccesses.set(item.id, saved);
                return saved;
            })),
            update: jest.fn(async (projectId, id, patch) => {
                const current = mockAccesses.get(id);
                if (!current) return null;
                const next = { ...current, ...patch };
                mockAccesses.set(id, next);
                return next;
            }),
            remove: jest.fn(async (projectId, id) => mockAccesses.delete(id)),
        },
        erosionRepository: { list: noopList },
        reportJobRepository: { list: noopList },
        userRepository: { list: noopList, listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })) },
        inspectionRepository: { list: noopList },
        operatingLicenseRepository: { list: noopList },
        reportWorkspaceRepository: { list: noopList },
        reportPhotoRepository: { listByWorkspace: noopList },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        rulesConfigRepository: { get: jest.fn(async () => null) },
        mediaAssetRepository: { getById: jest.fn() },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: { listWorkspaceIdsByUser: jest.fn(async () => []) },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({ getByEmail: jest.fn(async () => null) }));
jest.mock('../../utils/mailer', () => ({ getMailTransport: () => null, sendResetEmail: jest.fn(async () => {}) }));
jest.mock('../../utils/workerTrigger', () => ({ triggerWorkerRun: jest.fn() }));

const request = require('supertest');
const app = require('../../server');

const LINE = Array.from({ length: 11 }, (_, i) => [-47, -21 + i * 0.0009]);

beforeEach(() => mockAccesses.clear());

describe('POST /api/projects/:id/accesses/preview', () => {
    it('devolve a sugestao de torre e os trechos coloridos sem gravar', async () => {
        const res = await request(app)
            .post('/api/projects/ARAPCA/accesses/preview')
            .set('Authorization', 'Bearer t')
            .send({ data: { features: [{ id: 'f1', name: 'Acesso', geometry: { type: 'LineString', coordinates: LINE } }] } });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body._links.create.method).toBe('POST');
        const [item] = res.body.data.items;
        expect(item).toMatchObject({ featureId: 'f1', action: 'acesso', towerNumber: '104' });
        expect(item.segments.map((s) => s.tipo)).toEqual(['terra', 'acesso']);
        expect(item.flags).toContain('tipo_inferido');
        expect(mockAccesses.size).toBe(0);
    });

    it('404 para empreendimento inexistente e 400 para geometria invalida', async () => {
        const missing = await request(app)
            .post('/api/projects/NAOEXISTE/accesses/preview')
            .set('Authorization', 'Bearer t')
            .send({ data: { features: [{ id: 'f1', geometry: { type: 'LineString', coordinates: LINE } }] } });
        expect(missing.status).toBe(404);

        const invalid = await request(app)
            .post('/api/projects/ARAPCA/accesses/preview')
            .set('Authorization', 'Bearer t')
            .send({ data: { features: [{ id: 'f1', geometry: { type: 'LineString', coordinates: [[-47, -95], [-47, -21]] } }] } });
        expect(invalid.status).toBe(400);
        expect(invalid.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('CRUD /api/projects/:id/accesses', () => {
    const segment = (tipo, coords) => ({ tipo, comprimentoM: 100, coordinates: coords });

    it('grava, lista, edita e remove', async () => {
        const created = await request(app)
            .post('/api/projects/ARAPCA/accesses')
            .set('Authorization', 'Bearer t')
            .send({ data: { items: [
                { towerNumber: '104', kind: 'acesso', name: 'Acesso T104', geometry: { type: 'LineString', coordinates: LINE }, segments: [segment('acesso', LINE)], source: { arquivo: 'a.kmz', formato: 'kmz' } },
                { kind: 'rota_guia', name: 'Rota', geometry: { type: 'LineString', coordinates: LINE }, segments: [segment('asfalto', LINE)] },
            ] } });
        expect(created.status).toBe(201);
        expect(created.body.data).toHaveLength(2);
        const access = created.body.data[0];
        expect(access.id).toMatch(/^ACC-/);
        expect(access.lengthM).toBeGreaterThan(990);
        expect(access.source).toMatchObject({ arquivo: 'a.kmz' });
        expect(access._links.update.method).toBe('PUT');

        const list = await request(app).get('/api/projects/ARAPCA/accesses').set('Authorization', 'Bearer t');
        expect(list.status).toBe(200);
        expect(list.body.data).toHaveLength(2);
        expect(list.body._links.preview.method).toBe('POST');

        const updated = await request(app)
            .put(`/api/projects/ARAPCA/accesses/${access.id}`)
            .set('Authorization', 'Bearer t')
            .send({ data: { towerNumber: '104', kind: 'acesso', name: 'Acesso T104', segments: [{ ...segment('terra', LINE), manual: true }] } });
        expect(updated.status).toBe(200);
        expect(updated.body.data.segments[0]).toMatchObject({ tipo: 'terra', manual: true });

        const removed = await request(app).delete(`/api/projects/ARAPCA/accesses/${access.id}`).set('Authorization', 'Bearer t');
        expect(removed.status).toBe(204);
        const again = await request(app).delete(`/api/projects/ARAPCA/accesses/${access.id}`).set('Authorization', 'Bearer t');
        expect(again.status).toBe(404);
    });

    it('rejeita acesso sem torre', async () => {
        const res = await request(app)
            .post('/api/projects/ARAPCA/accesses')
            .set('Authorization', 'Bearer t')
            .send({ data: { items: [{ kind: 'acesso', geometry: { type: 'LineString', coordinates: LINE }, segments: [] }] } });
        expect(res.status).toBe(400);
    });
});
