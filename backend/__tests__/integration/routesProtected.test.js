// Testes de rotas protegidas: rules, profissoes, users.
// Mocka authMiddleware e repositorios.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'admin-test', email: 'admin@test.local' };
        req.userProfile = { status: 'Ativo', perfil: 'Administrador' };
        next();
    };
    return {
        verifyToken: pass,
        requireActiveUser: pass,
        requireActiveUserOrWorker: pass,
        requireEditor: [pass],
        requireEditorOrWorker: pass,
        requireAdmin: [pass],
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

jest.mock('../../utils/workspaceAccess', () => ({
    isGlobalSuperuser: () => true,
    checkWorkspaceAccess: () => ({ allowed: true }),
    requireWorkspaceRead: (req, res, next) => next(),
    requireWorkspaceWrite: (req, res, next) => next(),
}));

// Estados compartilhados dos mocks.
const mockState = {
    rulesConfig: null,
    users: new Map(),
    profissoes: new Map(),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: {
            get: jest.fn(async () => mockState.rulesConfig),
            save: jest.fn(async (payload) => {
                mockState.rulesConfig = { id: 'default', ...payload };
                return mockState.rulesConfig;
            }),
        },
        userRepository: {
            list: jest.fn(async () => Array.from(mockState.users.values())),
            listPaginated: jest.fn(async ({ page = 1, limit = 50 } = {}) => {
                const items = Array.from(mockState.users.values());
                const p = Number(page) || 1;
                const l = Number(limit) || 50;
                const start = (p - 1) * l;
                return { items: items.slice(start, start + l), total: items.length, page: p, limit: l };
            }),
            getById: jest.fn(async (id) => mockState.users.get(id) || null),
            save: jest.fn(async (data) => {
                mockState.users.set(data.id, data);
                return data;
            }),
            remove: jest.fn(async (id) => { mockState.users.delete(id); }),
        },
        inspectionRepository: { list: noopList, listPaginated: jest.fn(), getById: jest.fn(), save: jest.fn(), remove: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, listPaginated: jest.fn(), getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList },
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
            listWorkspaceIdsByUser: jest.fn(async () => []),
            addMember: jest.fn(),
        },
    };
});

// profissaoRepository e importado diretamente em routes/profissoes.js
jest.mock('../../repositories/profissaoRepository', () => ({
    list: jest.fn(async () => Array.from(mockState.profissoes.values())),
    create: jest.fn(async (data) => {
        mockState.profissoes.set(data.id, data);
        return data;
    }),
    remove: jest.fn(async (id) => { mockState.profissoes.delete(id); }),
}));

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
    getByUserId: jest.fn(async () => null),
}));

jest.mock('../../utils/userProfiles', () => ({
    buildBootstrapProfile: jest.fn(() => ({ id: 'new-user', nome: 'New' })),
    loadUserProfile: jest.fn(async (id) => mockState.users.get(id) || null),
    saveUserProfile: jest.fn(async () => {}),
    sanitizeUserProfileInput: jest.fn((data) => data),
}));

jest.mock('../../repositories/userSignatoryRepository', () => ({
    listByUser: jest.fn(async () => []),
    create: jest.fn(async (data) => ({ id: 'SIG-1', ...data })),
    update: jest.fn(async (id, data) => ({ id, ...data })),
    remove: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

beforeEach(() => {
    mockState.rulesConfig = null;
    mockState.users.clear();
    mockState.profissoes.clear();
});

describe('PUT /api/rules (mass assignment + Zod strict)', () => {
    it('aceita payload com campos conhecidos', async () => {
        const res = await request(app)
            .put('/api/rules')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    criticalidade: {
                        pontos: { profundidade: { P1: { descricao: '<=1', pontos: 0 } } },
                    },
                },
                meta: { updatedBy: 'admin@test.local' },
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data._links.self).toBeDefined();
    });

    it('rejeita campo desconhecido com 400 VALIDATION_ERROR (.strict)', async () => {
        const res = await request(app)
            .put('/api/rules')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    criticalidade: { pontos: {} },
                    // Campo que nao esta no schema — deve ser rejeitado por .strict()
                    isAdmin: true,
                    maliciousField: 'pwned',
                },
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita body sem data', async () => {
        const res = await request(app)
            .put('/api/rules')
            .set('Authorization', 'Bearer t')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('POST /api/profissoes', () => {
    it('aceita payload valido e retorna 201 com _links', async () => {
        const res = await request(app)
            .post('/api/profissoes')
            .set('Authorization', 'Bearer t')
            .send({ id: 'ENG-CIVIL', nome: 'Engenheiro Civil' });

        expect(res.status).toBe(201);
        expect(res.body.data._links).toBeDefined();
        expect(res.body.data._links.self.href).toContain('profissoes/ENG-CIVIL');
    });

    it('rejeita id vazio com 400', async () => {
        const res = await request(app)
            .post('/api/profissoes')
            .set('Authorization', 'Bearer t')
            .send({ id: '', nome: 'Teste' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita campos desconhecidos com 400 (.strict)', async () => {
        const res = await request(app)
            .post('/api/profissoes')
            .set('Authorization', 'Bearer t')
            .send({
                id: 'ENG',
                nome: 'Engenheiro',
                isAdmin: true, // campo desconhecido
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('DELETE /api/profissoes/:id', () => {
    it('retorna 204 sem body', async () => {
        mockState.profissoes.set('ENG', { id: 'ENG', nome: 'Engenheiro' });

        const res = await request(app)
            .delete('/api/profissoes/ENG')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(204);
        expect(res.text === '' || res.text === undefined).toBe(true);
    });
});

describe('GET /api/users/:id com sanitizeUser', () => {
    it('remove passwordHash e resetToken do response', async () => {
        mockState.users.set('U-1', {
            id: 'U-1',
            nome: 'Alice',
            email: 'alice@test.local',
            perfil: 'Administrador',
            status: 'Ativo',
            passwordHash: 'should-not-leak',
            resetToken: 'token-should-not-leak',
        });

        const res = await request(app)
            .get('/api/users/U-1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('U-1');
        expect(res.body.data.nome).toBe('Alice');
        expect(res.body.data.perfil).toBe('Administrador');
        // Campos sensiveis devem ter sido removidos
        expect(res.body.data.passwordHash).toBeUndefined();
        expect(res.body.data.resetToken).toBeUndefined();
        // _links presentes
        expect(res.body.data._links.self).toBeDefined();
    });
});

describe('GET /api/users (paginado)', () => {
    it('retorna envelope paginado com total correto', async () => {
        mockState.users.set('U-1', { id: 'U-1', nome: 'Alice', passwordHash: 'x' });
        mockState.users.set('U-2', { id: 'U-2', nome: 'Bob', passwordHash: 'y' });
        mockState.users.set('U-3', { id: 'U-3', nome: 'Carol', passwordHash: 'z' });

        const res = await request(app)
            .get('/api/users?page=1&limit=2')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.pagination).toEqual({
            page: 1,
            limit: 2,
            total: 3,
            totalPages: 2,
        });
        expect(res.body._links.next.href).toContain('page=2');

        // Nenhum user no response contem passwordHash
        for (const user of res.body.data) {
            expect(user.passwordHash).toBeUndefined();
        }
    });
});

describe('POST /api/users (schema Zod)', () => {
    it('rejeita payload sem id com 400', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', 'Bearer t')
            .send({ data: { nome: 'Teste', email: 'teste@test.local' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita perfil invalido com 400', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    id: 'U-NEW',
                    nome: 'Teste',
                    email: 'teste@test.local',
                    perfil: 'SuperHacker', // nao esta no enum
                },
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});
