// Testes de integracao das rotas de corte do rodape da marca d'agua:
//   - POST /:id/photos/:photoId/crop-footer
//   - POST /:id/photos/:photoId/crop-footer/undo
// Storage e corte sao mockados (o corte real e coberto em photoFooterCrop.test.js).

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
};

const mockReportPhotoRepository = {
    getById: jest.fn(async (id) => mockState.photos.get(id) || null),
    save: jest.fn(async (payload) => {
        const next = { ...(mockState.photos.get(payload.id) || {}), ...payload };
        mockState.photos.set(payload.id, next);
        return next;
    }),
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

function seedPhoto(overrides = {}) {
    const asset = { id: 'MA-1', storageKey: 'ws/WS-1/MA-1.jpg', fileName: 'TimePhoto.jpg', contentType: 'image/jpeg', sourceKind: 'tigris', sha256: 'sha-orig', sizeBytes: 8 };
    const photo = { id: 'RPH-1', workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: 'MA-1', caption: 'Torre 126', ...overrides };
    mockState.assets.set(asset.id, asset);
    mockState.photos.set(photo.id, photo);
    mockState.store.set(asset.storageKey, Buffer.from('original'));
    return { asset, photo };
}

beforeEach(() => {
    mockState.photos.clear();
    mockState.assets.clear();
    mockState.store.clear();
    jest.clearAllMocks();
});

describe('POST /:id/photos/:photoId/crop-footer', () => {
    it('corta, devolve a foto com cropHistory e links HATEOAS de desfazer', async () => {
        seedPhoto();
        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer')
            .send({ data: { pixels: 45 }, meta: { updatedBy: 'curador@test.local' } });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.cropHistory).toHaveLength(1);
        expect(response.body.data.cropHistory[0]).toMatchObject({ pixels: 45, by: 'curador@test.local', prevSha256: 'sha-orig' });
        expect(response.body.data.caption).toBe('Torre 126');
        expect(response.body.data._links.self.href).toContain('/report-workspaces/WS-1/photos/RPH-1');
        expect(response.body.data._links.cropFooter.method).toBe('POST');
        expect(response.body.data._links.cropFooterUndo.href).toContain('/crop-footer/undo');
        expect(mockState.store.get('ws/WS-1/MA-1.jpg').toString()).toBe('cropped-45');
        expect(mockMediaAssetRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'MA-1', sha256: 'sha-10' }), { merge: true });
    });

    it('usa o email do usuario como autor quando meta nao traz updatedBy', async () => {
        seedPhoto();
        const response = await request(app)
            .post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer')
            .send({ data: { percent: 0.2 } });
        expect(response.status).toBe(200);
        expect(response.body.data.cropHistory[0]).toMatchObject({ by: 'admin@test.local', percent: 0.2, pixels: null });
    });

    it('400 quando o payload nao traz pixels nem percent, ou fora da faixa', async () => {
        seedPhoto();
        const empty = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer').send({ data: {} });
        expect(empty.status).toBe(400);
        expect(empty.body.code).toBe('VALIDATION_ERROR');

        const tooBig = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer').send({ data: { pixels: 401 } });
        expect(tooBig.status).toBe(400);
        expect(mockState.store.get('ws/WS-1/MA-1.jpg').toString()).toBe('original');
    });

    it('422 quando a faixa cobre a imagem inteira', async () => {
        seedPhoto();
        const response = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer').send({ data: { pixels: 100 } });
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('CROP_FAILED');
    });

    it('404 para workspace ou foto inexistente, 400 para foto sem midia', async () => {
        seedPhoto();
        expect((await request(app).post('/api/report-workspaces/WS-9/photos/RPH-1/crop-footer').send({ data: { pixels: 45 } })).status).toBe(404);
        expect((await request(app).post('/api/report-workspaces/WS-1/photos/RPH-9/crop-footer').send({ data: { pixels: 45 } })).status).toBe(404);

        mockState.photos.set('RPH-2', { id: 'RPH-2', workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: '' });
        const noMedia = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-2/crop-footer').send({ data: { pixels: 45 } });
        expect(noMedia.status).toBe(400);
        expect(noMedia.body.code).toBe('PHOTO_WITHOUT_MEDIA');
    });
});

describe('POST /:id/photos/:photoId/crop-footer/undo', () => {
    it('restaura o original e esvazia o historico', async () => {
        seedPhoto();
        await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer').send({ data: { pixels: 45 } });

        const response = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer/undo').send({});
        expect(response.status).toBe(200);
        expect(response.body.data.cropHistory).toEqual([]);
        expect(response.body.data._links.cropFooterUndo).toBeUndefined();
        expect(mockState.store.get('ws/WS-1/MA-1.jpg').toString()).toBe('original');
    });

    it('409 quando nao ha corte para desfazer', async () => {
        seedPhoto();
        const response = await request(app).post('/api/report-workspaces/WS-1/photos/RPH-1/crop-footer/undo').send({});
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('NO_CROP_HISTORY');
    });
});
