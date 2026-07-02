// Integracao para DELETE /:id/photos/trash (esvaziar lixeira). Foco no fix de
// N+1: o cleanup de media assets deve usar 1 listByIds + 1 removeByIds em lote,
// nao um getById/remove por item.

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

const mockRemoveStoredMedia = jest.fn(async () => {});
jest.mock('../../utils/mediaStorage', () => ({
    removeStoredMedia: mockRemoveStoredMedia,
}));

const mockState = {
    workspaces: new Map([['WS-1', { id: 'WS-1', projectId: 'P1' }]]),
    trashed: [],
    assetsById: new Map(),
};

const mockReportPhotoRepository = {
    removeAllTrashed: jest.fn(async () => mockState.trashed),
};

const mockMediaAssetRepository = {
    listByIds: jest.fn(async (ids) => ids
        .map((id) => mockState.assetsById.get(id))
        .filter(Boolean)),
    removeByIds: jest.fn(async () => {}),
    getById: jest.fn(),
    remove: jest.fn(),
};

const mockReportWorkspaceRepository = {
    list: jest.fn(async () => Array.from(mockState.workspaces.values())),
    getById: jest.fn(async (id) => mockState.workspaces.get(id) || null),
    save: jest.fn(async (payload) => payload),
    remove: jest.fn(),
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
        reportWorkspaceRepository: mockReportWorkspaceRepository,
        reportPhotoRepository: mockReportPhotoRepository,
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList, getById: jest.fn() },
        reportArchiveRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        mediaAssetRepository: mockMediaAssetRepository,
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listByWorkspace: jest.fn(async () => []),
            listWorkspaceIdsByUser: jest.fn(async () => []),
            listRolesForUser: jest.fn(async () => new Map()),
            getMember: jest.fn(async () => null),
            addMember: jest.fn(),
            removeMemberGuardingLastOwner: jest.fn(),
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

function seedTrashedWithAssets(n) {
    mockState.trashed = [];
    mockState.assetsById.clear();
    for (let i = 0; i < n; i += 1) {
        const assetId = `ASSET-${i}`;
        mockState.trashed.push({ id: `PH-${i}`, mediaAssetId: assetId });
        mockState.assetsById.set(assetId, { id: assetId, storageKey: `key/${i}` });
    }
}

beforeEach(() => {
    jest.clearAllMocks();
    mockState.trashed = [];
    mockState.assetsById.clear();
});

describe('DELETE /:id/photos/trash (esvaziar lixeira)', () => {
    it('limpa media assets em lote: 1 listByIds + 1 removeByIds para N fotos', async () => {
        seedTrashedWithAssets(5);

        const response = await request(app)
            .delete('/api/report-workspaces/WS-1/photos/trash')
            .send({});

        expect(response.status).toBe(200);
        // batch, nao N+1
        expect(mockMediaAssetRepository.listByIds).toHaveBeenCalledTimes(1);
        expect(mockMediaAssetRepository.listByIds).toHaveBeenCalledWith(
            ['ASSET-0', 'ASSET-1', 'ASSET-2', 'ASSET-3', 'ASSET-4'],
        );
        expect(mockMediaAssetRepository.removeByIds).toHaveBeenCalledTimes(1);
        expect(mockMediaAssetRepository.removeByIds).toHaveBeenCalledWith(
            ['ASSET-0', 'ASSET-1', 'ASSET-2', 'ASSET-3', 'ASSET-4'],
        );
        // I/O de storage continua por item
        expect(mockRemoveStoredMedia).toHaveBeenCalledTimes(5);
        // o getById por item nao deve mais ser usado
        expect(mockMediaAssetRepository.getById).not.toHaveBeenCalled();
    });

    it('nao chama listByIds/removeByIds quando nao ha assets na lixeira', async () => {
        mockState.trashed = [{ id: 'PH-0', mediaAssetId: null }];

        const response = await request(app)
            .delete('/api/report-workspaces/WS-1/photos/trash')
            .send({});

        expect(response.status).toBe(200);
        expect(mockMediaAssetRepository.listByIds).not.toHaveBeenCalled();
        expect(mockMediaAssetRepository.removeByIds).not.toHaveBeenCalled();
    });

    it('falha de storage em um item nao remove a row dele do banco', async () => {
        seedTrashedWithAssets(3);
        mockRemoveStoredMedia.mockImplementation(async (asset) => {
            if (asset.id === 'ASSET-1') throw new Error('s3 down');
        });

        const response = await request(app)
            .delete('/api/report-workspaces/WS-1/photos/trash')
            .send({});

        expect(response.status).toBe(200);
        // ASSET-1 falhou no storage -> nao entra no removeByIds
        expect(mockMediaAssetRepository.removeByIds).toHaveBeenCalledWith(['ASSET-0', 'ASSET-2']);
    });

    it('retorna 404 quando o workspace nao existe', async () => {
        const response = await request(app)
            .delete('/api/report-workspaces/WS-NONE/photos/trash')
            .send({});

        expect(response.status).toBe(404);
        expect(mockReportPhotoRepository.removeAllTrashed).not.toHaveBeenCalled();
    });
});
