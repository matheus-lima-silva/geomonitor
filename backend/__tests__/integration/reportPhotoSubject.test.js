// Testes de integracao do assunto da foto (`subject`: torre | acesso | contexto)
// no PUT /:id/photos/:photoId. O campo e whitelisted em normalizePhoto; valor
// desconhecido cai em 'torre' e chaves extras do payload (ex.: cropHistory)
// sobrevivem ao merge.

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

jest.mock('../../utils/workspaceAccess', () => ({
    isGlobalSuperuser: jest.fn(() => true),
    checkWorkspaceAccess: jest.fn(async () => ({ hasAccess: true, role: 'owner' })),
    requireWorkspaceRead: (req, res, next) => next(),
    requireWorkspaceWrite: (req, res, next) => next(),
}));

const mockState = {
    workspaces: new Map([['WS-1', { id: 'WS-1', projectId: 'P1' }]]),
    photos: new Map(),
};

const mockReportPhotoRepository = {
    getById: jest.fn(async (id) => mockState.photos.get(id) || null),
    save: jest.fn(async (payload) => {
        const next = { ...(mockState.photos.get(payload.id) || {}), ...payload };
        mockState.photos.set(payload.id, next);
        return next;
    }),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(async () => ({})), save: jest.fn() },
        userRepository: { getById: jest.fn(async () => null) },
        inspectionRepository: { list: noopList, getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: {
            list: jest.fn(async () => Array.from(mockState.workspaces.values())),
            getById: jest.fn(async (id) => mockState.workspaces.get(id) || null),
            save: jest.fn(async (payload) => payload),
            remove: jest.fn(),
        },
        reportPhotoRepository: mockReportPhotoRepository,
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList, getById: jest.fn() },
        reportArchiveRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        mediaAssetRepository: { getById: jest.fn(async () => null), save: jest.fn() },
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

beforeEach(() => {
    mockState.photos.clear();
    mockState.photos.set('RPH-1', {
        id: 'RPH-1', workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: 'MA-1', caption: 'Torre 126', towerId: '126',
        cropHistory: [{ at: '2026-10-12T20:00:00.000Z', pixels: 45 }],
    });
    jest.clearAllMocks();
});

describe('PUT /:id/photos/:photoId - subject', () => {
    it('persiste subject acesso e mantem o cropHistory do payload', async () => {
        const response = await request(app)
            .put('/api/report-workspaces/WS-1/photos/RPH-1')
            .send({ data: { subject: 'acesso', caption: 'Acesso a torre 126' }, meta: { updatedBy: 'curador@test.local' } });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: 'RPH-1', subject: 'acesso', caption: 'Acesso a torre 126', towerId: '126' });
        expect(mockReportPhotoRepository.save).toHaveBeenCalledWith(expect.objectContaining({ subject: 'acesso' }), { merge: true });
        // O repositorio faz merge com o registro atual: chaves extras do payload sobrevivem.
        expect(mockState.photos.get('RPH-1').cropHistory).toHaveLength(1);
    });

    it('valor desconhecido ou ausente vira torre', async () => {
        const invalid = await request(app)
            .put('/api/report-workspaces/WS-1/photos/RPH-1')
            .send({ data: { subject: 'paisagem' } });
        expect(invalid.status).toBe(200);
        expect(invalid.body.data.subject).toBe('torre');

        const missing = await request(app)
            .put('/api/report-workspaces/WS-1/photos/RPH-1')
            .send({ data: { caption: 'Nova legenda' } });
        expect(missing.status).toBe(200);
        expect(missing.body.data.subject).toBe('torre');
        expect(missing.body.data.caption).toBe('Nova legenda');
    });

    it('subject ja salvo sobrevive a um PUT que nao o envia', async () => {
        await request(app).put('/api/report-workspaces/WS-1/photos/RPH-1').send({ data: { subject: 'contexto' } });
        const response = await request(app).put('/api/report-workspaces/WS-1/photos/RPH-1').send({ data: { includeInReport: true } });
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ subject: 'contexto', includeInReport: true });
    });
});
