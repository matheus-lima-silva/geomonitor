// Testes de integracao para o fluxo de arquivamento de fotos:
//   - POST /:id/photos/:photoId/archive (individual, so de lixeira)
//   - POST /:id/photos/archive-trash-older-than (bulk por idade)
//   - POST /:id/photos/archive-all-trash (bulk imediato, sem filtro de idade)
//   - POST /:id/photos/:photoId/unarchive-to-trash (volta pra lixeira)
//
// Integracao com rules_config.retencao.lixeira_para_arquivo_dias: quando o
// body nao traz `days`, o backend le do config (fallback 30).

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

jest.mock('../../utils/workspaceAccess', () => ({
    isGlobalSuperuser: jest.fn(() => true),
    checkWorkspaceAccess: jest.fn(async () => ({ hasAccess: true, role: 'owner' })),
    requireWorkspaceRead: (req, res, next) => next(),
    requireWorkspaceWrite: (req, res, next) => next(),
}));

const mockState = {
    workspaces: new Map([['WS-1', { id: 'WS-1', projectId: 'P1' }]]),
    photos: new Map(),
    rulesConfig: { retencao: { lixeira_para_arquivo_dias: 30 } },
};

const mockReportPhotoRepository = {
    getById: jest.fn(async (id) => mockState.photos.get(id) || null),
    archive: jest.fn(async (id) => {
        const photo = mockState.photos.get(id);
        if (!photo || !photo.deletedAt || photo.archivedAt) return null;
        const next = { ...photo, deletedAt: null, archivedAt: new Date().toISOString() };
        mockState.photos.set(id, next);
        return next;
    }),
    unarchiveToTrash: jest.fn(async (id) => {
        const photo = mockState.photos.get(id);
        if (!photo || !photo.archivedAt) return null;
        const next = { ...photo, archivedAt: null, deletedAt: new Date().toISOString() };
        mockState.photos.set(id, next);
        return next;
    }),
    archiveOlderThanDays: jest.fn(async (workspaceId, days) => {
        const threshold = Date.now() - Number(days) * 86_400_000;
        let count = 0;
        for (const [id, photo] of mockState.photos) {
            if (photo.workspaceId !== workspaceId) continue;
            if (!photo.deletedAt || photo.archivedAt) continue;
            if (new Date(photo.deletedAt).getTime() >= threshold) continue;
            mockState.photos.set(id, { ...photo, deletedAt: null, archivedAt: new Date().toISOString() });
            count += 1;
        }
        return { count };
    }),
    archiveAllTrashed: jest.fn(async (workspaceId) => {
        let count = 0;
        for (const [id, photo] of mockState.photos) {
            if (photo.workspaceId !== workspaceId) continue;
            if (!photo.deletedAt || photo.archivedAt) continue;
            mockState.photos.set(id, { ...photo, deletedAt: null, archivedAt: new Date().toISOString() });
            count += 1;
        }
        return { count };
    }),
};

const mockReportWorkspaceRepository = {
    list: jest.fn(async () => Array.from(mockState.workspaces.values())),
    getById: jest.fn(async (id) => mockState.workspaces.get(id) || null),
    save: jest.fn(async (payload) => payload),
    remove: jest.fn(),
};

const mockRulesConfigRepository = {
    get: jest.fn(async () => mockState.rulesConfig),
    save: jest.fn(),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: mockRulesConfigRepository,
        userRepository: { getById: jest.fn(async () => null) },
        inspectionRepository: { list: noopList, getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: mockReportWorkspaceRepository,
        reportPhotoRepository: mockReportPhotoRepository,
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList, getById: jest.fn() },
        reportArchiveRepository: { list: noopList },
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

function seedPhoto(id, overrides = {}) {
    const photo = {
        id,
        workspaceId: 'WS-1',
        projectId: 'P1',
        towerId: 'T-01',
        caption: 'Foto',
        deletedAt: null,
        archivedAt: null,
        ...overrides,
    };
    mockState.photos.set(id, photo);
    return photo;
}

beforeEach(() => {
    mockState.photos.clear();
    mockState.rulesConfig = { retencao: { lixeira_para_arquivo_dias: 30 } };
    jest.clearAllMocks();
});

describe('report-photos archive flow', () => {
    it('POST /:id/photos/:photoId/archive arquiva foto da lixeira', async () => {
        seedPhoto('PH-1', { deletedAt: new Date().toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/PH-1/archive')
            .send({});

        expect(response.status).toBe(200);
        expect(mockReportPhotoRepository.archive).toHaveBeenCalledWith('PH-1');
    });

    it('POST /archive em foto ativa retorna 400 NOT_IN_TRASH', async () => {
        seedPhoto('PH-2', { deletedAt: null });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/PH-2/archive')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('NOT_IN_TRASH');
    });

    it('POST /archive-trash-older-than usa days do body quando informado', async () => {
        seedPhoto('PH-OLD', { deletedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() });
        seedPhoto('PH-NEW', { deletedAt: new Date(Date.now() - 5 * 86_400_000).toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/archive-trash-older-than')
            .send({ data: { days: 30 } });

        expect(response.status).toBe(200);
        expect(response.body.data.count).toBe(1);
        expect(response.body.data.days).toBe(30);
    });

    it('POST /archive-trash-older-than sem days usa fallback da rules_config', async () => {
        mockState.rulesConfig = { retencao: { lixeira_para_arquivo_dias: 15 } };
        seedPhoto('PH-20', { deletedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() });
        seedPhoto('PH-10', { deletedAt: new Date(Date.now() - 10 * 86_400_000).toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/archive-trash-older-than')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.data.days).toBe(15);
        expect(response.body.data.count).toBe(1);
    });

    it('POST /archive-all-trash arquiva TODAS as fotos da lixeira imediatamente, incluindo recentes', async () => {
        seedPhoto('PH-RECENT', { deletedAt: new Date(Date.now() - 60_000).toISOString() });
        seedPhoto('PH-OLD', { deletedAt: new Date(Date.now() - 60 * 86_400_000).toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/archive-all-trash')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.count).toBe(2);
        expect(mockReportPhotoRepository.archiveAllTrashed).toHaveBeenCalledWith('WS-1');
        expect(mockState.photos.get('PH-RECENT').archivedAt).not.toBeNull();
        expect(mockState.photos.get('PH-OLD').archivedAt).not.toBeNull();
    });

    it('POST /archive-all-trash ignora fotos ativas e ja arquivadas', async () => {
        seedPhoto('PH-ACTIVE', { deletedAt: null, archivedAt: null });
        const preArchived = new Date(Date.now() - 3600_000).toISOString();
        seedPhoto('PH-ARCHIVED', { deletedAt: null, archivedAt: preArchived });
        seedPhoto('PH-TRASH', { deletedAt: new Date().toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/archive-all-trash')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.data.count).toBe(1);
        expect(mockState.photos.get('PH-ACTIVE').archivedAt).toBeNull();
        expect(mockState.photos.get('PH-ARCHIVED').archivedAt).toBe(preArchived);
        expect(mockState.photos.get('PH-TRASH').archivedAt).not.toBeNull();
    });

    it('POST /archive-all-trash em workspace inexistente retorna 404', async () => {
        const response = await request(app)
            .post('/api/report-workspaces/WS-NONE/photos/archive-all-trash')
            .send({});

        expect(response.status).toBe(404);
        expect(mockReportPhotoRepository.archiveAllTrashed).not.toHaveBeenCalled();
    });

    it('POST /:id/photos/:photoId/unarchive-to-trash devolve foto arquivada para lixeira', async () => {
        seedPhoto('PH-A', { archivedAt: new Date().toISOString() });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/PH-A/unarchive-to-trash')
            .send({});

        expect(response.status).toBe(200);
        expect(mockReportPhotoRepository.unarchiveToTrash).toHaveBeenCalledWith('PH-A');
    });

    it('POST /unarchive em foto ativa retorna 400 NOT_ARCHIVED', async () => {
        seedPhoto('PH-LIVE', { deletedAt: null, archivedAt: null });

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/PH-LIVE/unarchive-to-trash')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('NOT_ARCHIVED');
    });
});

describe('rules_config retencao schema', () => {
    it('PUT /api/rules aceita retencao.lixeira_para_arquivo_dias valido', async () => {
        const response = await request(app)
            .put('/api/rules')
            .send({
                data: { retencao: { lixeira_para_arquivo_dias: 60 } },
                meta: { updatedBy: 'admin' },
            });
        expect(response.status).toBe(200);
    });

    it('PUT /api/rules rejeita retencao fora do range [1, 3650]', async () => {
        const response = await request(app)
            .put('/api/rules')
            .send({
                data: { retencao: { lixeira_para_arquivo_dias: 5000 } },
                meta: { updatedBy: 'admin' },
            });
        expect(response.status).toBe(400);
    });

    it('PUT /api/rules rejeita retencao com valor nao-inteiro', async () => {
        const response = await request(app)
            .put('/api/rules')
            .send({
                data: { retencao: { lixeira_para_arquivo_dias: 15.5 } },
                meta: { updatedBy: 'admin' },
            });
        expect(response.status).toBe(400);
    });
});
