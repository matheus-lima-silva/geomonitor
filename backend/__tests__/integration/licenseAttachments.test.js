// Testes de integracao dos anexos de LO (2 slots fixos: documentoLO, planoGerenciamento).
// Exercita POST/GET/DELETE /api/licenses/:id/attachments com mediaAssetRepository
// e operatingLicenseRepository mockados em memoria. Valida rejeicao de slot
// invalido, nao-PDF (415), asset inexistente (404) e substituicao com cleanup
// do asset anterior.

const mockAuthContext = {
    user: { uid: 'user_editor', email: 'editor@test.local' },
    userProfile: { status: 'Ativo', perfil: 'Editor' },
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
    licenses: new Map(),
    assets: new Map(),
    removedStorageKeys: [],
};

jest.mock('../../utils/mediaStorage', () => {
    const actual = {
        createSignedAccessUrl: jest.fn(async ({ storageKey }) => ({
            href: `https://signed.example/${storageKey}`,
            method: 'GET',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
        })),
        isTigrisAsset: jest.fn((asset) => String(asset?.sourceKind || '').toLowerCase() === 'tigris'),
        removeStoredMedia: jest.fn(async (asset) => {
            if (asset?.storageKey) mockState.removedStorageKeys.push(asset.storageKey);
        }),
    };
    return actual;
});

const mockOperatingLicenseRepository = {
    list: jest.fn(async () => Array.from(mockState.licenses.values())),
    getById: jest.fn(async (id) => mockState.licenses.get(id) || null),
    save: jest.fn(async (lic) => {
        mockState.licenses.set(lic.id, { ...lic });
        return { ...lic };
    }),
    remove: jest.fn(async (id) => mockState.licenses.delete(id)),
};

const mockMediaAssetRepository = {
    getById: jest.fn(async (id) => mockState.assets.get(id) || null),
    save: jest.fn(async (asset) => {
        mockState.assets.set(asset.id, { ...asset });
        return { ...asset };
    }),
    remove: jest.fn(async (id) => mockState.assets.delete(id)),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(), save: jest.fn() },
        userRepository: { getById: jest.fn() },
        inspectionRepository: { list: noopList, getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: mockOperatingLicenseRepository,
        licenseConditionRepository: {
            listByLicense: noopList,
            getById: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            bulkReplace: jest.fn(),
            countByLicense: jest.fn(async () => 0),
            removeByLicense: jest.fn(),
        },
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList, getById: jest.fn() },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        reportArchiveRepository: { list: noopList, getById: jest.fn() },
        mediaAssetRepository: mockMediaAssetRepository,
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listByWorkspace: noopList,
            listWorkspaceIdsByUser: noopList,
            listRolesForUser: jest.fn(async () => new Map()),
            getMember: jest.fn(async () => null),
            addMember: jest.fn(),
            removeMember: jest.fn(),
            countOwners: jest.fn(async () => 0),
        },
        adminSqlAuditRepository: { list: noopList, save: jest.fn() },
        adminSqlSnippetsRepository: { list: noopList, save: jest.fn() },
        systemAlertsRepository: { list: noopList, save: jest.fn() },
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

function seedLicense(id, extras = {}) {
    const lic = { id, numero: id.replace(/^LO-/, ''), orgaoAmbiental: 'IBAMA', ...extras };
    mockState.licenses.set(id, lic);
    return lic;
}

function seedAsset(id, extras = {}) {
    const asset = {
        id,
        fileName: 'lo.pdf',
        contentType: 'application/pdf',
        storedSizeBytes: 12345,
        sha256: 'abc123',
        storageKey: `license_document/${id}/lo.pdf`,
        sourceKind: 'tigris',
        ...extras,
    };
    mockState.assets.set(id, asset);
    return asset;
}

beforeEach(() => {
    mockState.licenses.clear();
    mockState.assets.clear();
    mockState.removedStorageKeys.length = 0;
    jest.clearAllMocks();
    mockAuthContext.user = { uid: 'u1', email: 'editor@test.local' };
    mockAuthContext.userProfile = { status: 'Ativo', perfil: 'Editor' };
});

describe('POST /api/licenses/:id/attachments', () => {
    it('anexa mediaAssetId a slot valido (documentoLO)', async () => {
        seedLicense('LO-X');
        seedAsset('MED-1');
        const res = await request(app)
            .post('/api/licenses/LO-X/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'documentoLO', mediaAssetId: 'MED-1' } });
        expect(res.status).toBe(201);
        expect(res.body.data.slot).toBe('documentoLO');
        expect(res.body.data.mediaAssetId).toBe('MED-1');
        expect(res.body.data._links.download.href).toContain('/attachments/documentoLO/download');
        const saved = mockState.licenses.get('LO-X');
        expect(saved.arquivos.documentoLO.mediaAssetId).toBe('MED-1');
        expect(saved.arquivos.documentoLO.attachedBy).toBe('editor@test.local');
    });

    it('rejeita slot invalido via Zod (400)', async () => {
        seedLicense('LO-X');
        seedAsset('MED-1');
        const res = await request(app)
            .post('/api/licenses/LO-X/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'outroSlot', mediaAssetId: 'MED-1' } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita asset nao-PDF com 415', async () => {
        seedLicense('LO-X');
        seedAsset('MED-IMG', { contentType: 'image/png' });
        const res = await request(app)
            .post('/api/licenses/LO-X/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'documentoLO', mediaAssetId: 'MED-IMG' } });
        expect(res.status).toBe(415);
    });

    it('retorna 404 quando asset nao existe', async () => {
        seedLicense('LO-X');
        const res = await request(app)
            .post('/api/licenses/LO-X/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'documentoLO', mediaAssetId: 'MED-NOPE' } });
        expect(res.status).toBe(404);
    });

    it('retorna 404 quando licenca nao existe', async () => {
        seedAsset('MED-1');
        const res = await request(app)
            .post('/api/licenses/LO-NOPE/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'documentoLO', mediaAssetId: 'MED-1' } });
        expect(res.status).toBe(404);
    });

    it('remove asset anterior ao substituir o slot', async () => {
        seedLicense('LO-X', {
            arquivos: { documentoLO: { mediaAssetId: 'MED-OLD', fileName: 'old.pdf' } },
        });
        seedAsset('MED-OLD');
        seedAsset('MED-NEW');
        const res = await request(app)
            .post('/api/licenses/LO-X/attachments')
            .set('Authorization', 'Bearer t')
            .send({ data: { slot: 'documentoLO', mediaAssetId: 'MED-NEW' } });
        expect(res.status).toBe(201);
        expect(mockState.assets.has('MED-OLD')).toBe(false);
        expect(mockState.removedStorageKeys).toContain('license_document/MED-OLD/lo.pdf');
    });
});

describe('GET /api/licenses/:id/attachments', () => {
    it('lista slots preenchidos com _links', async () => {
        seedAsset('MED-1');
        seedAsset('MED-2', { fileName: 'pga.pdf' });
        seedLicense('LO-Y', {
            arquivos: {
                documentoLO: { mediaAssetId: 'MED-1', fileName: 'lo.pdf', contentType: 'application/pdf', sizeBytes: 10, sha256: 'a', attachedAt: 'x', attachedBy: 'x' },
                planoGerenciamento: { mediaAssetId: 'MED-2', fileName: 'pga.pdf', contentType: 'application/pdf', sizeBytes: 20, sha256: 'b', attachedAt: 'x', attachedBy: 'x' },
            },
        });
        const res = await request(app)
            .get('/api/licenses/LO-Y/attachments')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data.map((d) => d.slot).sort()).toEqual(['documentoLO', 'planoGerenciamento']);
    });

    it('lista vazia quando nada anexado', async () => {
        seedLicense('LO-Z');
        const res = await request(app)
            .get('/api/licenses/LO-Z/attachments')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body._links.attach.href).toContain('/licenses/LO-Z/attachments');
    });
});

describe('GET /api/licenses/:id/attachments/:slot/download', () => {
    it('redireciona 302 para signed URL quando Tigris', async () => {
        seedAsset('MED-1');
        seedLicense('LO-D', {
            arquivos: { documentoLO: { mediaAssetId: 'MED-1' } },
        });
        const res = await request(app)
            .get('/api/licenses/LO-D/attachments/documentoLO/download')
            .set('Authorization', 'Bearer t')
            .redirects(0);
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('signed.example');
    });

    it('retorna 404 para slot vazio', async () => {
        seedLicense('LO-E');
        const res = await request(app)
            .get('/api/licenses/LO-E/attachments/documentoLO/download')
            .set('Authorization', 'Bearer t')
            .redirects(0);
        expect(res.status).toBe(404);
    });

    it('rejeita slot invalido (400)', async () => {
        seedLicense('LO-F');
        const res = await request(app)
            .get('/api/licenses/LO-F/attachments/xyz/download')
            .set('Authorization', 'Bearer t')
            .redirects(0);
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/licenses/:id/attachments/:slot', () => {
    it('apaga slot e remove asset subjacente', async () => {
        seedAsset('MED-DEL');
        seedLicense('LO-G', { arquivos: { planoGerenciamento: { mediaAssetId: 'MED-DEL' } } });
        const res = await request(app)
            .delete('/api/licenses/LO-G/attachments/planoGerenciamento')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(204);
        expect(mockState.licenses.get('LO-G').arquivos.planoGerenciamento).toBeUndefined();
        expect(mockState.assets.has('MED-DEL')).toBe(false);
        expect(mockState.removedStorageKeys).toContain('license_document/MED-DEL/lo.pdf');
    });

    it('retorna 404 quando slot esta vazio', async () => {
        seedLicense('LO-H');
        const res = await request(app)
            .delete('/api/licenses/LO-H/attachments/documentoLO')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });
});
