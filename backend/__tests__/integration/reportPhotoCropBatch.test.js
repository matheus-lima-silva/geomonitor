// Integracao do corte em lote e da retencao dos backups de corte:
//   - POST /:id/photos/crop-footer-batch
//   - POST /:id/photos/purge-crop-backups
// Storage e corte mockados (o corte real e coberto em photoFooterCrop.test.js).

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
    assets: new Map(),
    store: new Map(),
    rulesConfig: { retencao: { backup_corte_dias: 30 } },
};

const mockReportPhotoRepository = {
    getById: jest.fn(async (id) => mockState.photos.get(id) || null),
    save: jest.fn(async (payload) => {
        const next = { ...(mockState.photos.get(payload.id) || {}), ...payload };
        mockState.photos.set(payload.id, next);
        return next;
    }),
    listWithCropHistoryByWorkspace: jest.fn(async (workspaceId) => [...mockState.photos.values()]
        .filter((photo) => photo.workspaceId === workspaceId && Array.isArray(photo.cropHistory) && photo.cropHistory.length > 0)),
};

const mockMediaAssetRepository = {
    getById: jest.fn(async (id) => mockState.assets.get(id) || null),
    save: jest.fn(async (payload) => {
        const next = { ...(mockState.assets.get(payload.id) || {}), ...payload };
        mockState.assets.set(payload.id, next);
        return next;
    }),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(async () => mockState.rulesConfig), save: jest.fn() },
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
        mediaAssetRepository: mockMediaAssetRepository,
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

jest.mock('../../utils/mediaStorage', () => ({
    readStoredMediaContent: jest.fn(async (asset) => {
        const key = String(asset.storageKey || asset.id);
        if (!mockState.store.has(key)) throw new Error(`objeto ausente: ${key}`);
        return { buffer: mockState.store.get(key), contentType: 'image/jpeg', fileName: 'foto.jpg' };
    }),
    writeStoredContent: jest.fn(async (asset, buffer) => {
        mockState.store.set(String(asset.storageKey || asset.id), Buffer.from(buffer));
        return { storedAt: '2026-10-12T20:00:00.000Z', storedSizeBytes: buffer.byteLength, sha256: `sha-${buffer.byteLength}`, etag: '', filePath: '' };
    }),
    removeStoredMedia: jest.fn(async (asset) => { mockState.store.delete(String(asset.storageKey || asset.id)); }),
    createSignedAccessUrl: jest.fn(),
    createSignedUploadUrl: jest.fn(),
}));

jest.mock('../../utils/imageCrop', () => ({
    cropBottomBand: jest.fn(async (buffer, { pixels, percent }) => {
        const band = pixels || Math.round(100 * percent);
        if (band >= 100) throw new Error(`Faixa de corte (${band}px) >= altura da imagem (100px).`);
        return Buffer.from(`cropped-${band}`);
    }),
}));

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
    const asset = { id: `MA-${id}`, storageKey: `ws/WS-1/MA-${id}.jpg`, fileName: `TimePhoto_${id}.jpg`, contentType: 'image/jpeg', sourceKind: 'tigris', sha256: `sha-orig-${id}`, sizeBytes: 8 };
    const photo = { id: `RPH-${id}`, workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: asset.id, caption: `Torre ${id}`, towerId: '126', ...overrides };
    mockState.assets.set(asset.id, asset);
    mockState.photos.set(photo.id, photo);
    mockState.store.set(asset.storageKey, Buffer.from('original'));
    return { asset, photo };
}

function flushImmediates() {
    return new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
}

beforeEach(() => {
    mockState.photos.clear();
    mockState.assets.clear();
    mockState.store.clear();
    mockState.rulesConfig = { retencao: { backup_corte_dias: 30 } };
    jest.clearAllMocks();
});

describe('POST /:id/photos/crop-footer-batch', () => {
    it('corta as fotos do lote, pula as ja cortadas e as inexistentes, devolve envelope', async () => {
        seedPhoto('a');
        seedPhoto('b', { cropHistory: [{ at: '2026-10-12T20:00:00.000Z', pixels: 45, backup: { storageKey: 'ws/WS-1/MA-b.jpg.orig-1' } }] });
        mockState.store.set('ws/WS-1/MA-b.jpg.orig-1', Buffer.from('orig-b'));

        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/crop-footer-batch')
            .send({ data: { photoIds: ['RPH-a', 'RPH-b', 'RPH-zz'], pixels: 45 }, meta: { updatedBy: 'curador@test.local' } });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('_links.self.href');
        expect(response.body.data.cropped).toBe(1);
        expect(response.body.data.skipped).toEqual([
            { photoId: 'RPH-zz', code: 'PHOTO_NOT_FOUND', message: 'Foto nao encontrada neste workspace.' },
            { photoId: 'RPH-b', code: 'ALREADY_CROPPED', message: 'Foto ja cortada; pulada.' },
        ]);
        expect(response.body.data.photos).toHaveLength(1);
        expect(response.body.data.photos[0]).toMatchObject({ id: 'RPH-a', caption: 'Torre a' });
        expect(response.body.data.photos[0].cropHistory[0]).toMatchObject({ pixels: 45, by: 'curador@test.local' });
        expect(response.body.data.photos[0]._links.cropFooterUndo.href).toContain('/crop-footer/undo');
        expect(mockState.store.get('ws/WS-1/MA-a.jpg').toString()).toBe('cropped-45');
        await flushImmediates();
        // Retencao automatica rodou (nada vencido): backups recentes continuam.
        expect(mockReportPhotoRepository.listWithCropHistoryByWorkspace).toHaveBeenCalledWith('WS-1');
        expect(mockState.store.has('ws/WS-1/MA-b.jpg.orig-1')).toBe(true);
    });

    it('skipCropped=false corta de novo; 400 em payload invalido; 404 em workspace inexistente', async () => {
        seedPhoto('b', { cropHistory: [{ at: '2026-10-12T20:00:00.000Z', pixels: 45, backup: { storageKey: 'ws/WS-1/MA-b.jpg.orig-1' } }] });
        const again = await request(app)
            .post('/api/report-workspaces/WS-1/photos/crop-footer-batch')
            .send({ data: { photoIds: ['RPH-b'], pixels: 45, skipCropped: false } });
        expect(again.status).toBe(200);
        expect(again.body.data.cropped).toBe(1);
        expect(mockState.photos.get('RPH-b').cropHistory).toHaveLength(2);

        const noIds = await request(app).post('/api/report-workspaces/WS-1/photos/crop-footer-batch').send({ data: { photoIds: [], pixels: 45 } });
        expect(noIds.status).toBe(400);
        const noBand = await request(app).post('/api/report-workspaces/WS-1/photos/crop-footer-batch').send({ data: { photoIds: ['RPH-b'] } });
        expect(noBand.status).toBe(400);
        const missing = await request(app).post('/api/report-workspaces/WS-9/photos/crop-footer-batch').send({ data: { photoIds: ['RPH-b'], pixels: 45 } });
        expect(missing.status).toBe(404);
    });
});

describe('POST /:id/photos/purge-crop-backups', () => {
    it('apaga backups vencidos pelo prazo do rules_config (ou do body) e marca o historico', async () => {
        const oldAt = new Date(Date.now() - 45 * 86_400_000).toISOString();
        const recentAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
        seedPhoto('old', { cropHistory: [{ at: oldAt, pixels: 45, backup: { storageKey: 'ws/WS-1/MA-old.jpg.orig-1' } }] });
        seedPhoto('new', { cropHistory: [{ at: recentAt, pixels: 45, backup: { storageKey: 'ws/WS-1/MA-new.jpg.orig-1' } }] });
        mockState.store.set('ws/WS-1/MA-old.jpg.orig-1', Buffer.from('o'));
        mockState.store.set('ws/WS-1/MA-new.jpg.orig-1', Buffer.from('n'));

        const response = await request(app).post('/api/report-workspaces/WS-1/photos/purge-crop-backups').send({});
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ purged: 1, failed: 0, photosTouched: 1, days: 30 });
        expect(response.body.data).toHaveProperty('_links.self.href');
        expect(mockState.store.has('ws/WS-1/MA-old.jpg.orig-1')).toBe(false);
        expect(mockState.store.has('ws/WS-1/MA-new.jpg.orig-1')).toBe(true);
        expect(mockState.photos.get('RPH-old').cropHistory[0]).toMatchObject({ backup: null, purgedBy: 'admin@test.local' });

        // days=0 no body apaga tambem o recente.
        const all = await request(app).post('/api/report-workspaces/WS-1/photos/purge-crop-backups').send({ data: { days: 0 } });
        expect(all.status).toBe(200);
        expect(all.body.data.purged).toBe(1);
        expect(mockState.store.has('ws/WS-1/MA-new.jpg.orig-1')).toBe(false);

        // Undo da foto purgada responde 409.
        const undo = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-old/crop-footer/undo').send({});
        expect(undo.status).toBe(409);
        expect(undo.body.code).toBe('BACKUP_UNAVAILABLE');
    });

    it('404 em workspace inexistente', async () => {
        const response = await request(app).post('/api/report-workspaces/WS-9/photos/purge-crop-backups').send({});
        expect(response.status).toBe(404);
    });
});
