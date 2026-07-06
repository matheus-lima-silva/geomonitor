// Integracao para DELETE /:id (deletar workspace). Foco: como a FK
// report_photos.workspace_id e ON DELETE CASCADE, a rota tem que limpar o storage
// S3 das fotos ANTES de apagar o workspace, senao o cascade do banco deixa orfaos
// no bucket. Espelha o cleanup em lote do esvaziar lixeira.

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
    removedPhotos: [],
    assetsById: new Map(),
    workspaceRemoved: [],
};

const mockReportPhotoRepository = {
    removeAllByWorkspace: jest.fn(async () => mockState.removedPhotos),
};

const mockMediaAssetRepository = {
    listByIds: jest.fn(async (ids) => ids.map((id) => mockState.assetsById.get(id)).filter(Boolean)),
    removeByIds: jest.fn(async () => {}),
    getById: jest.fn(),
    remove: jest.fn(),
};

const mockReportWorkspaceRepository = {
    list: jest.fn(async () => []),
    getById: jest.fn(async () => null),
    save: jest.fn(async (p) => p),
    remove: jest.fn(async (id) => { mockState.workspaceRemoved.push(id); }),
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

function seedPhotosWithAssets(n) {
    mockState.removedPhotos = [];
    mockState.assetsById.clear();
    for (let i = 0; i < n; i += 1) {
        const assetId = `ASSET-${i}`;
        mockState.removedPhotos.push({ id: `PH-${i}`, mediaAssetId: assetId });
        mockState.assetsById.set(assetId, { id: assetId, storageKey: `key/${i}` });
    }
}

let consoleErrorSpy;

beforeEach(() => {
    jest.clearAllMocks();
    // Silencia o console.error esperado do caminho de falha de storage.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockState.removedPhotos = [];
    mockState.assetsById.clear();
    mockState.workspaceRemoved = [];
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('DELETE /:id (deletar workspace)', () => {
    it('limpa storage das fotos em lote antes de remover o workspace', async () => {
        seedPhotosWithAssets(4);

        const response = await request(app).delete('/api/report-workspaces/WS-1').send();

        expect(response.status).toBe(204);
        expect(mockReportPhotoRepository.removeAllByWorkspace).toHaveBeenCalledWith('WS-1');
        expect(mockMediaAssetRepository.listByIds).toHaveBeenCalledTimes(1);
        expect(mockMediaAssetRepository.listByIds).toHaveBeenCalledWith(
            ['ASSET-0', 'ASSET-1', 'ASSET-2', 'ASSET-3'],
        );
        expect(mockRemoveStoredMedia).toHaveBeenCalledTimes(4);
        expect(mockMediaAssetRepository.removeByIds).toHaveBeenCalledWith(
            ['ASSET-0', 'ASSET-1', 'ASSET-2', 'ASSET-3'],
        );
        // workspace removido por ultimo
        expect(mockReportWorkspaceRepository.remove).toHaveBeenCalledWith('WS-1');
    });

    it('remove o workspace mesmo sem fotos (sem chamar cleanup de assets)', async () => {
        const response = await request(app).delete('/api/report-workspaces/WS-EMPTY').send();

        expect(response.status).toBe(204);
        expect(mockReportPhotoRepository.removeAllByWorkspace).toHaveBeenCalledWith('WS-EMPTY');
        expect(mockMediaAssetRepository.listByIds).not.toHaveBeenCalled();
        expect(mockMediaAssetRepository.removeByIds).not.toHaveBeenCalled();
        expect(mockReportWorkspaceRepository.remove).toHaveBeenCalledWith('WS-EMPTY');
    });

    it('falha de storage em uma foto nao impede o delete do workspace', async () => {
        seedPhotosWithAssets(3);
        mockRemoveStoredMedia.mockImplementation(async (asset) => {
            if (asset.id === 'ASSET-1') throw new Error('s3 down');
        });

        const response = await request(app).delete('/api/report-workspaces/WS-1').send();

        expect(response.status).toBe(204);
        expect(mockMediaAssetRepository.removeByIds).toHaveBeenCalledWith(['ASSET-0', 'ASSET-2']);
        expect(mockReportWorkspaceRepository.remove).toHaveBeenCalledWith('WS-1');
        expect(consoleErrorSpy).toHaveBeenCalled(); // a falha de storage foi logada
    });
});
