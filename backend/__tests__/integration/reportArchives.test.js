// Testes de integracao para o fluxo de arquivamento imutavel de entregas
// (report_archives):
//   (1) POST /api/report-compounds/:id/deliver — cria snapshot com version
//       sequencial, copiando generatedMediaId do compound.
//   (2) POST /api/report-archives/:id/attach-delivered — vincula o PDF final
//       apos upload via signed URL, validando sha256.
//   (3) GET /api/report-archives — lista filtrada por compoundId.
//   (4) GET /api/report-archives/:id/download?variant=... — redireciona para
//       /api/media/:id/access-url.

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
    compounds: new Map(),
    archives: new Map(),
    maxVersionByCompound: new Map(),
    media: new Map(),
};

const mockReportCompoundRepository = {
    list: jest.fn(async () => Array.from(mockState.compounds.values())),
    getById: jest.fn(async (id) => mockState.compounds.get(id) || null),
    save: jest.fn(async (payload) => {
        const current = mockState.compounds.get(payload.id);
        const saved = { ...(current || {}), ...payload };
        mockState.compounds.set(saved.id, saved);
        return saved;
    }),
    remove: jest.fn(async (id) => mockState.compounds.delete(id)),
};

const mockReportArchiveRepository = {
    list: jest.fn(async ({ compoundId } = {}) => {
        const all = Array.from(mockState.archives.values());
        return compoundId ? all.filter((a) => a.compoundId === compoundId) : all;
    }),
    getById: jest.fn(async (id) => mockState.archives.get(id) || null),
    getMaxVersionForCompound: jest.fn(async (compoundId) => (
        mockState.maxVersionByCompound.get(compoundId) || 0
    )),
    create: jest.fn(async (payload) => {
        mockState.archives.set(payload.id, { ...payload });
        mockState.maxVersionByCompound.set(payload.compoundId, payload.version);
        return mockState.archives.get(payload.id);
    }),
    attachDeliveredMedia: jest.fn(async (id, { mediaId, sha256, notes }) => {
        const existing = mockState.archives.get(id);
        if (!existing) return null;
        if (existing.deliveredMediaId) return null;
        const updated = {
            ...existing,
            deliveredMediaId: mediaId,
            deliveredSha256: sha256,
            notes: notes !== undefined && notes !== null ? notes : existing.notes,
        };
        mockState.archives.set(id, updated);
        return updated;
    }),
};

const mockMediaAssetRepository = {
    getById: jest.fn(async (id) => mockState.media.get(id) || null),
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
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList, getById: jest.fn() },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: mockReportCompoundRepository,
        reportArchiveRepository: mockReportArchiveRepository,
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

function seedCompound(id, overrides = {}) {
    const compound = {
        id,
        nome: `Composto ${id}`,
        status: 'completed',
        workspaceIds: [],
        orderJson: [],
        sharedTextsJson: {},
        outputDocxMediaId: `MED-${id}`,
        lastJobId: `JOB-${id}`,
        ...overrides,
    };
    mockState.compounds.set(id, compound);
    return compound;
}

function seedMedia(id, overrides = {}) {
    const asset = { id, sha256: '', status_execucao: 'ready', ...overrides };
    mockState.media.set(id, asset);
    return asset;
}

beforeEach(() => {
    mockState.compounds.clear();
    mockState.archives.clear();
    mockState.maxVersionByCompound.clear();
    mockState.media.clear();
    jest.clearAllMocks();
});

describe('report-archives flow', () => {
    it('POST /deliver cria archive v1 com generatedMediaId copiado do compound', async () => {
        seedCompound('RC-1');
        seedMedia('MED-RC-1', { sha256: 'abc123def456' });

        const response = await request(app)
            .post('/api/report-compounds/RC-1/deliver')
            .send({ data: { notes: 'primeira entrega' }, meta: { updatedBy: 'admin' } });

        expect(response.status).toBe(201);
        expect(response.body.data.version).toBe(1);
        expect(response.body.data.compoundId).toBe('RC-1');
        expect(response.body.data.generatedMediaId).toBe('MED-RC-1');
        expect(response.body.data.generatedSha256).toBe('abc123def456');
        expect(response.body.data.deliveredMediaId).toBeNull();
        expect(response.body.data._links?.attachDelivered).toBeTruthy();
    });

    it('POST /deliver em compound sem outputDocxMediaId retorna 400', async () => {
        seedCompound('RC-2', { outputDocxMediaId: '' });

        const response = await request(app)
            .post('/api/report-compounds/RC-2/deliver')
            .send({ data: {}, meta: {} });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('MISSING_GENERATED_DOCX');
    });

    it('POST /deliver subsequente incrementa a versao', async () => {
        seedCompound('RC-3');
        seedMedia('MED-RC-3');

        const first = await request(app)
            .post('/api/report-compounds/RC-3/deliver')
            .send({ data: {}, meta: {} });
        expect(first.body.data.version).toBe(1);

        const second = await request(app)
            .post('/api/report-compounds/RC-3/deliver')
            .send({ data: {}, meta: {} });
        expect(second.body.data.version).toBe(2);
    });

    it('POST /attach-delivered vincula o mediaId e grava sha256', async () => {
        seedCompound('RC-4');
        seedMedia('MED-RC-4');
        const deliverResponse = await request(app)
            .post('/api/report-compounds/RC-4/deliver')
            .send({ data: {}, meta: {} });
        const archiveId = deliverResponse.body.data.id;

        seedMedia('MED-FINAL-1', { sha256: 'fedcba987654' });

        const response = await request(app)
            .post(`/api/report-archives/${archiveId}/attach-delivered`)
            .send({ data: { mediaId: 'MED-FINAL-1', sha256: 'fedcba987654' }, meta: {} });

        expect(response.status).toBe(200);
        expect(response.body.data.deliveredMediaId).toBe('MED-FINAL-1');
        expect(response.body.data.deliveredSha256).toBe('fedcba987654');
        expect(response.body.data._links?.downloadDelivered).toBeTruthy();
    });

    it('POST /attach-delivered segundo upload retorna 409 (imutabilidade)', async () => {
        seedCompound('RC-5');
        seedMedia('MED-RC-5');
        const deliverResponse = await request(app)
            .post('/api/report-compounds/RC-5/deliver')
            .send({ data: {}, meta: {} });
        const archiveId = deliverResponse.body.data.id;

        seedMedia('MED-FINAL-2', { sha256: 'aaa111' });
        await request(app)
            .post(`/api/report-archives/${archiveId}/attach-delivered`)
            .send({ data: { mediaId: 'MED-FINAL-2', sha256: 'aaa111' }, meta: {} });

        const response = await request(app)
            .post(`/api/report-archives/${archiveId}/attach-delivered`)
            .send({ data: { mediaId: 'MED-FINAL-2', sha256: 'aaa111' }, meta: {} });

        expect(response.status).toBe(409);
        expect(response.body.code).toBe('DELIVERED_MEDIA_ALREADY_SET');
    });

    it('POST /attach-delivered com sha256 divergente do media_asset retorna 400', async () => {
        seedCompound('RC-6');
        seedMedia('MED-RC-6');
        const deliverResponse = await request(app)
            .post('/api/report-compounds/RC-6/deliver')
            .send({ data: {}, meta: {} });
        const archiveId = deliverResponse.body.data.id;

        seedMedia('MED-FINAL-3', { sha256: 'expected-hash' });

        const response = await request(app)
            .post(`/api/report-archives/${archiveId}/attach-delivered`)
            .send({ data: { mediaId: 'MED-FINAL-3', sha256: 'client-reported-different' }, meta: {} });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('SHA256_MISMATCH');
    });

    it('GET /report-archives?compoundId=X retorna apenas do compound informado', async () => {
        seedCompound('RC-7');
        seedCompound('RC-8');
        seedMedia('MED-RC-7');
        seedMedia('MED-RC-8');
        await request(app).post('/api/report-compounds/RC-7/deliver').send({ data: {}, meta: {} });
        await request(app).post('/api/report-compounds/RC-8/deliver').send({ data: {}, meta: {} });
        await request(app).post('/api/report-compounds/RC-8/deliver').send({ data: {}, meta: {} });

        const response = await request(app).get('/api/report-archives?compoundId=RC-8');
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data.every((a) => a.compoundId === 'RC-8')).toBe(true);
    });

    it('GET /:id/download?variant=generated redireciona para /media/:id/access-url', async () => {
        seedCompound('RC-9');
        seedMedia('MED-RC-9');
        const deliverResponse = await request(app)
            .post('/api/report-compounds/RC-9/deliver')
            .send({ data: {}, meta: {} });
        const archiveId = deliverResponse.body.data.id;

        const response = await request(app).get(`/api/report-archives/${archiveId}/download?variant=generated`);
        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/media/MED-RC-9/access-url');
    });

    it('GET /:id/download?variant=delivered sem upload retorna 404', async () => {
        seedCompound('RC-10');
        seedMedia('MED-RC-10');
        const deliverResponse = await request(app)
            .post('/api/report-compounds/RC-10/deliver')
            .send({ data: {}, meta: {} });
        const archiveId = deliverResponse.body.data.id;

        const response = await request(app).get(`/api/report-archives/${archiveId}/download?variant=delivered`);
        expect(response.status).toBe(404);
    });
});
