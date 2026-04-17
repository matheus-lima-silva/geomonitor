// Testes de integracao para o vinculo workspace <-> inspection (vistoria).
// Valida que o inspection_id persiste via PUT, aparece no GET e gera
// HATEOAS link quando preenchido.

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
        requireAdmin: [attach],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

const mockState = {
    workspaces: new Map(),
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

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(), save: jest.fn() },
        userRepository: { getById: jest.fn(async () => null) },
        inspectionRepository: { list: noopList, getById: jest.fn(), save: jest.fn(), remove: jest.fn() },
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

beforeEach(() => {
    mockState.workspaces.clear();
    jest.clearAllMocks();
});

describe('report-workspaces inspection link', () => {
    it('persiste inspectionId ao criar workspace via POST', async () => {
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

    it('inclui link HATEOAS para a vistoria quando inspectionId est\u00e1 preenchido', async () => {
        seedWorkspace('RW-2', { inspectionId: 'VS-789' });

        const response = await request(app).get('/api/report-workspaces/RW-2');

        expect(response.status).toBe(200);
        const body = response.body.data;
        expect(body._links?.inspection).toBeTruthy();
        expect(body._links.inspection.href).toContain('/inspections/VS-789');
        expect(body._links.inspection.method).toBe('GET');
    });

    it('omite link HATEOAS de vistoria quando inspectionId est\u00e1 ausente', async () => {
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
