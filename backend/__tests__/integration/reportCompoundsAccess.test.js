// Testes de controle de acesso por membership de workspace nas rotas de
// report-compounds. Regra: superuser global ve tudo; caso contrario, LEITURA
// exige membership em >=1 workspace do compound e ESCRITA exige papel de
// escrita (owner/editor) em TODOS os workspaces envolvidos.
//
// Os nomes com prefixo `mock` sao exigidos pelo jest para poderem ser
// referenciados de dentro das factories de jest.mock().

const mockAuth = {
    user: { uid: 'u1', email: 'u1@test.local' },
    profile: { status: 'Ativo', perfil: 'Editor' },
};

const mockMembership = {
    workspaceIdsByUser: [],
    rolesForUser: new Map(),
};

jest.mock('../../utils/authMiddleware', () => {
    const attach = (req, res, next) => {
        req.user = { ...mockAuth.user };
        req.userProfile = { ...mockAuth.profile };
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

const mockState = { compounds: new Map() };

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
        reportArchiveRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        mediaAssetRepository: { getById: jest.fn(async () => null) },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listByWorkspace: jest.fn(async () => []),
            listWorkspaceIdsByUser: jest.fn(async () => mockMembership.workspaceIdsByUser),
            listRolesForUser: jest.fn(async (userId, ids = []) => {
                const map = new Map();
                for (const id of ids) {
                    if (mockMembership.rolesForUser.has(id)) map.set(id, mockMembership.rolesForUser.get(id));
                }
                return map;
            }),
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
        status: 'draft',
        workspaceIds: ['WS-A'],
        orderJson: [],
        sharedTextsJson: {},
        ...overrides,
    };
    mockState.compounds.set(id, compound);
    return compound;
}

beforeEach(() => {
    mockState.compounds.clear();
    mockAuth.user = { uid: 'u1', email: 'u1@test.local' };
    mockAuth.profile = { status: 'Ativo', perfil: 'Editor' };
    mockMembership.workspaceIdsByUser = [];
    mockMembership.rolesForUser = new Map();
    jest.clearAllMocks();
});

describe('report-compounds — controle de acesso por workspace', () => {
    it('nao-membro nao ve o compound na listagem', async () => {
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });
        const res = await request(app).get('/api/report-compounds');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });

    it('nao-membro recebe 403 ao ler /:id', async () => {
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });
        const res = await request(app).get('/api/report-compounds/RC-1');
        expect(res.status).toBe(403);
    });

    it('nao-membro recebe 403 ao escrever (PUT)', async () => {
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });
        const res = await request(app)
            .put('/api/report-compounds/RC-1')
            .send({ data: { nome: 'novo' }, meta: {} });
        expect(res.status).toBe(403);
    });

    it('membro viewer le mas nao escreve', async () => {
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });
        mockMembership.workspaceIdsByUser = ['WS-A'];
        mockMembership.rolesForUser = new Map([['WS-A', 'viewer']]);

        const list = await request(app).get('/api/report-compounds');
        expect(list.body.data).toHaveLength(1);

        const read = await request(app).get('/api/report-compounds/RC-1');
        expect(read.status).toBe(200);

        const write = await request(app)
            .put('/api/report-compounds/RC-1')
            .send({ data: { nome: 'novo' }, meta: {} });
        expect(write.status).toBe(403);
    });

    it('editor de todos os workspaces escreve', async () => {
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });
        mockMembership.workspaceIdsByUser = ['WS-A'];
        mockMembership.rolesForUser = new Map([['WS-A', 'editor']]);

        const res = await request(app)
            .put('/api/report-compounds/RC-1')
            .send({ data: { nome: 'novo' }, meta: {} });
        expect(res.status).toBe(200);
    });

    it('escrita exige acesso a TODOS os workspaces do compound', async () => {
        // Membro de WS-A (editor) mas nao de WS-B → PUT negado.
        seedCompound('RC-1', { workspaceIds: ['WS-A', 'WS-B'] });
        mockMembership.workspaceIdsByUser = ['WS-A'];
        mockMembership.rolesForUser = new Map([['WS-A', 'editor']]);

        const res = await request(app)
            .put('/api/report-compounds/RC-1')
            .send({ data: { nome: 'novo' }, meta: {} });
        expect(res.status).toBe(403);
    });

    it('superuser global ve e escreve mesmo sem membership', async () => {
        mockAuth.profile = { status: 'Ativo', perfil: 'Administrador' };
        seedCompound('RC-1', { workspaceIds: ['WS-A'] });

        const list = await request(app).get('/api/report-compounds');
        expect(list.body.data).toHaveLength(1);

        const read = await request(app).get('/api/report-compounds/RC-1');
        expect(read.status).toBe(200);

        const write = await request(app)
            .put('/api/report-compounds/RC-1')
            .send({ data: { nome: 'novo' }, meta: {} });
        expect(write.status).toBe(200);
    });

    it('POST cria exige escrita nos workspaces informados', async () => {
        // Sem membership em WS-A → 403.
        const denied = await request(app)
            .post('/api/report-compounds')
            .send({ data: { workspaceIds: ['WS-A'] }, meta: {} });
        expect(denied.status).toBe(403);

        // Com editor em WS-A → 201.
        mockMembership.rolesForUser = new Map([['WS-A', 'editor']]);
        const ok = await request(app)
            .post('/api/report-compounds')
            .send({ data: { workspaceIds: ['WS-A'] }, meta: {} });
        expect(ok.status).toBe(201);
    });
});
