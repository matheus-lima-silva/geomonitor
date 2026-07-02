// Testes de integracao para o vinculo workspace <-> inspection (vistoria).
// Cobre dois aspectos:
//   1. Persistencia/HATEOAS: inspection_id persiste via POST/PUT, aparece no
//      GET e gera link HATEOAS quando preenchido.
//   2. Integridade referencial (migration 0009): como `inspections` usa
//      document-store JSONB (sem FK fisica), o route handler valida a
//      existencia da vistoria antes de aceitar um inspection_id nao-null.
//      Referencia inexistente => 400 "Vistoria nao encontrada".

const mockAuthContext = {
    user: { uid: 'user_admin', email: 'admin@test.local' },
    userProfile: { status: 'Ativo', perfil: 'Administrador' },
};

jest.mock('../../utils/authMiddleware', () => {
    const attach = (req, res, next) => {
        req.user = { ...mockAuthContext.user };
        req.userProfile = { ...mockAuthContext.userProfile };
        next();
    };
    return {
        verifyToken: attach,
        requireActiveUser: attach,
        requireActiveUserOrWorker: attach,
        requireEditor: [attach],
        requireEditorOrWorker: attach,
        requireAdminOrWorker: attach,
        requireAdmin: [attach],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

const mockState = {
    workspaces: new Map(),
    inspections: new Map(),
};

const mockReportWorkspaceRepository = {
    list: jest.fn(async () => Array.from(mockState.workspaces.values())),
    getById: jest.fn(async (id) => mockState.workspaces.get(id) || null),
    save: jest.fn(async (payload) => {
        const current = mockState.workspaces.get(payload.id);
        const saved = { ...(current || {}), ...payload };
        mockState.workspaces.set(saved.id, saved);
        return saved;
    }),
    remove: jest.fn(async (id) => mockState.workspaces.delete(id)),
};

const mockInspectionRepository = {
    list: jest.fn(async () => Array.from(mockState.inspections.values())),
    getById: jest.fn(async (id) => mockState.inspections.get(id) || null),
    save: jest.fn(),
    remove: jest.fn(),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(), save: jest.fn() },
        userRepository: { getById: jest.fn(async () => null) },
        inspectionRepository: mockInspectionRepository,
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: mockReportWorkspaceRepository,
        reportPhotoRepository: { listByWorkspace: noopList, getById: jest.fn() },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        mediaAssetRepository: { getById: jest.fn() },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listByWorkspace: jest.fn(async () => []),
            listWorkspaceIdsByUser: jest.fn(async () => []),
            listRolesForUser: jest.fn(async () => new Map()),
            getMember: jest.fn(async () => null),
            addMember: jest.fn(),
            removeMember: jest.fn(),
            countOwners: jest.fn(async () => 1),
        },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
    getByUserId: jest.fn(async () => null),
}));

jest.mock('../../utils/userProfiles', () => ({
    loadUserProfile: jest.fn(async () => null),
    saveUserProfile: jest.fn(async () => {}),
    sanitizeUserProfileInput: jest.fn((data) => data),
    buildBootstrapProfile: jest.fn(() => ({})),
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

function seedWorkspace(id, overrides = {}) {
    const workspace = {
        id,
        projectId: 'P1',
        nome: `WS ${id}`,
        status: 'draft',
        inspectionId: null,
        ...overrides,
    };
    mockState.workspaces.set(id, workspace);
    return workspace;
}

function seedInspection(id, overrides = {}) {
    const inspection = { id, projectId: 'P1', ...overrides };
    mockState.inspections.set(id, inspection);
    return inspection;
}

beforeEach(() => {
    mockState.workspaces.clear();
    mockState.inspections.clear();
    jest.clearAllMocks();
});

describe('report-workspaces inspection link', () => {
    it('persiste inspectionId ao criar workspace via POST', async () => {
        seedInspection('VS-123');

        const response = await request(app)
            .post('/api/report-workspaces')
            .send({
                data: {
                    id: 'RW-new',
                    projectId: 'P1',
                    nome: 'Novo',
                    inspectionId: 'VS-123',
                },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(201);
        expect(mockReportWorkspaceRepository.save).toHaveBeenCalled();
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBe('VS-123');
    });

    it('atualiza inspectionId via PUT em workspace existente', async () => {
        seedWorkspace('RW-1', { inspectionId: null });
        seedInspection('VS-456');

        const response = await request(app)
            .put('/api/report-workspaces/RW-1')
            .send({
                data: { inspectionId: 'VS-456' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(200);
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBe('VS-456');
    });

    it('inclui link HATEOAS para a vistoria quando inspectionId está preenchido', async () => {
        seedWorkspace('RW-2', { inspectionId: 'VS-789' });

        const response = await request(app).get('/api/report-workspaces/RW-2');

        expect(response.status).toBe(200);
        const body = response.body.data;
        expect(body._links?.inspection).toBeTruthy();
        expect(body._links.inspection.href).toContain('/inspections/VS-789');
        expect(body._links.inspection.method).toBe('GET');
    });

    it('omite link HATEOAS de vistoria quando inspectionId está ausente', async () => {
        seedWorkspace('RW-3', { inspectionId: null });

        const response = await request(app).get('/api/report-workspaces/RW-3');

        expect(response.status).toBe(200);
        const body = response.body.data;
        expect(body._links?.inspection).toBeFalsy();
    });

    it('permite desclassificar o workspace passando inspectionId null via PUT', async () => {
        seedWorkspace('RW-4', { inspectionId: 'VS-AAA' });

        const response = await request(app)
            .put('/api/report-workspaces/RW-4')
            .send({
                data: { inspectionId: null },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(200);
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls.slice(-1)[0][0];
        expect(savedPayload.inspectionId).toBeNull();
    });
});

describe('report-workspaces inspection referential integrity', () => {
    it('POST com inspectionId inexistente retorna 400 e nao persiste', async () => {
        const response = await request(app)
            .post('/api/report-workspaces')
            .send({
                data: {
                    id: 'RW-bad',
                    projectId: 'P1',
                    nome: 'Sem vistoria valida',
                    inspectionId: 'VS-DOES-NOT-EXIST',
                },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Vistoria nao encontrada');
        expect(mockReportWorkspaceRepository.save).not.toHaveBeenCalled();
    });

    it('POST com inspectionId valido persiste e retorna 201', async () => {
        seedInspection('VS-OK');

        const response = await request(app)
            .post('/api/report-workspaces')
            .send({
                data: {
                    id: 'RW-ok',
                    projectId: 'P1',
                    nome: 'Vistoria valida',
                    inspectionId: 'VS-OK',
                },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(201);
        expect(mockInspectionRepository.getById).toHaveBeenCalledWith('VS-OK');
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBe('VS-OK');
    });

    it('POST com inspectionId null persiste sem validar vistoria (201)', async () => {
        const response = await request(app)
            .post('/api/report-workspaces')
            .send({
                data: {
                    id: 'RW-null',
                    projectId: 'P1',
                    nome: 'Sem vinculo',
                    inspectionId: null,
                },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(201);
        expect(mockInspectionRepository.getById).not.toHaveBeenCalled();
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBeNull();
    });

    it('POST sem inspectionId no payload persiste sem validar vistoria (201)', async () => {
        const response = await request(app)
            .post('/api/report-workspaces')
            .send({
                data: { id: 'RW-omit', projectId: 'P1', nome: 'Sem campo' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(201);
        expect(mockInspectionRepository.getById).not.toHaveBeenCalled();
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBeNull();
    });

    it('PUT com inspectionId inexistente retorna 400 e nao persiste', async () => {
        seedWorkspace('RW-5', { inspectionId: null });

        const response = await request(app)
            .put('/api/report-workspaces/RW-5')
            .send({
                data: { inspectionId: 'VS-GHOST' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Vistoria nao encontrada');
        expect(mockReportWorkspaceRepository.save).not.toHaveBeenCalled();
    });

    it('PUT de outro campo nao revalida vinculo preexistente (sem consulta a vistoria)', async () => {
        // RW-6 ja tem vinculo VS-OLD que nao seedamos em inspections — um
        // update de `nome` (sem inspectionId no payload) nao pode falhar nem
        // consultar a vistoria, ja que o vinculo nao esta sendo alterado.
        seedWorkspace('RW-6', { inspectionId: 'VS-OLD' });

        const response = await request(app)
            .put('/api/report-workspaces/RW-6')
            .send({
                data: { nome: 'Nome novo' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(200);
        expect(mockInspectionRepository.getById).not.toHaveBeenCalled();
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls.slice(-1)[0][0];
        expect(savedPayload.inspectionId).toBe('VS-OLD');
        expect(savedPayload.nome).toBe('Nome novo');
    });

    it('POST /:id/import com inspectionId inexistente retorna 400 e nao persiste', async () => {
        seedWorkspace('RW-7', { inspectionId: null });

        const response = await request(app)
            .post('/api/report-workspaces/RW-7/import')
            .send({
                data: { sourceType: 'manual', inspectionId: 'VS-GHOST' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Vistoria nao encontrada');
        expect(mockReportWorkspaceRepository.save).not.toHaveBeenCalled();
    });

    it('POST /:id/import com inspectionId valido persiste e retorna 200', async () => {
        seedWorkspace('RW-8', { inspectionId: null });
        seedInspection('VS-IMP');

        const response = await request(app)
            .post('/api/report-workspaces/RW-8/import')
            .send({
                data: { sourceType: 'manual', inspectionId: 'VS-IMP' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(200);
        expect(mockInspectionRepository.getById).toHaveBeenCalledWith('VS-IMP');
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls[0][0];
        expect(savedPayload.inspectionId).toBe('VS-IMP');
    });

    it('POST /:id/import sem inspectionId nao revalida vinculo preexistente', async () => {
        // RW-9 tem vinculo VS-OLD2 que nao seedamos em inspections; um import
        // sem inspectionId no payload nao pode falhar nem consultar a vistoria.
        seedWorkspace('RW-9', { inspectionId: 'VS-OLD2' });

        const response = await request(app)
            .post('/api/report-workspaces/RW-9/import')
            .send({
                data: { sourceType: 'manual' },
                meta: { updatedBy: 'admin' },
            });

        expect(response.status).toBe(200);
        expect(mockInspectionRepository.getById).not.toHaveBeenCalled();
        const savedPayload = mockReportWorkspaceRepository.save.mock.calls.slice(-1)[0][0];
        expect(savedPayload.inspectionId).toBe('VS-OLD2');
    });
});
