// Testes de integracao dos endpoints de membros de workspace e da filtragem
// por membership. Diferente de routesProtected.test.js, este suite NAO mocka
// workspaceAccess — exercita a implementacao real contra um mock controlado
// do repositorio, para validar a logica de superuser/membership/write.

// Contexto mutavel que permite cada test configurar o usuario autenticado.
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

// Estado dos repositorios, controlado por test. Prefixo `mock` exigido pelo
// Jest hoisting para ser acessivel dentro das factories de jest.mock().
const mockState = {
    workspaces: new Map(),
    members: new Map(), // key: `${workspaceId}:${userId}` -> { workspaceId, userId, role }
    users: new Map(),
};

function memberKey(workspaceId, userId) {
    return `${workspaceId}:${userId}`;
}

const mockWorkspaceMemberRepository = {
    listByWorkspace: jest.fn(async (workspaceId) => {
        return Array.from(mockState.members.values()).filter((m) => m.workspaceId === workspaceId);
    }),
    listWorkspaceIdsByUser: jest.fn(async (userId) => {
        return Array.from(mockState.members.values())
            .filter((m) => m.userId === userId)
            .map((m) => m.workspaceId);
    }),
    listRolesForUser: jest.fn(async (userId, workspaceIds = []) => {
        const map = new Map();
        for (const id of workspaceIds) {
            const entry = mockState.members.get(memberKey(id, userId));
            if (entry) map.set(id, entry.role);
        }
        return map;
    }),
    getMember: jest.fn(async (workspaceId, userId) => {
        return mockState.members.get(memberKey(workspaceId, userId)) || null;
    }),
    addMember: jest.fn(async (workspaceId, userId, role, createdBy) => {
        const entry = { workspaceId, userId, role, createdBy, createdAt: new Date().toISOString() };
        mockState.members.set(memberKey(workspaceId, userId), entry);
        return entry;
    }),
    removeMember: jest.fn(async (workspaceId, userId) => {
        mockState.members.delete(memberKey(workspaceId, userId));
    }),
    countOwners: jest.fn(async (workspaceId) => {
        return Array.from(mockState.members.values()).filter(
            (m) => m.workspaceId === workspaceId && m.role === 'owner',
        ).length;
    }),
};

const mockReportWorkspaceRepository = {
    list: jest.fn(async () => Array.from(mockState.workspaces.values())),
    getById: jest.fn(async (id) => mockState.workspaces.get(id) || null),
    save: jest.fn(async (payload) => {
        const saved = { ...payload };
        mockState.workspaces.set(saved.id, saved);
        return saved;
    }),
    remove: jest.fn(async (id) => mockState.workspaces.delete(id)),
};

const mockUserRepository = {
    getById: jest.fn(async (id) => mockState.users.get(id) || null),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        rulesConfigRepository: { get: jest.fn(), save: jest.fn() },
        userRepository: mockUserRepository,
        inspectionRepository: { list: noopList, getById: jest.fn(), save: jest.fn(), remove: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        erosionRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportWorkspaceRepository: mockReportWorkspaceRepository,
        reportPhotoRepository: { listByWorkspace: noopList, getById: jest.fn() },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        mediaAssetRepository: { getById: jest.fn() },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: mockWorkspaceMemberRepository,
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

function setAuth({ uid, email, perfil }) {
    mockAuthContext.user = { uid, email };
    mockAuthContext.userProfile = { status: 'Ativo', perfil };
}

function seedWorkspace(id, overrides = {}) {
    const workspace = {
        id,
        projectId: 'P1',
        nome: `WS ${id}`,
        status: 'draft',
        ...overrides,
    };
    mockState.workspaces.set(id, workspace);
    return workspace;
}

function seedMember(workspaceId, userId, role) {
    const entry = { workspaceId, userId, role, createdBy: 'seed', createdAt: new Date().toISOString() };
    mockState.members.set(memberKey(workspaceId, userId), entry);
    return entry;
}

function seedUser(id, extras = {}) {
    const user = { id, nome: `User ${id}`, ...extras };
    mockState.users.set(id, user);
    return user;
}

beforeEach(() => {
    mockState.workspaces.clear();
    mockState.members.clear();
    mockState.users.clear();
    jest.clearAllMocks();
    // default: editor comum, nao superuser
    setAuth({ uid: 'user_editor', email: 'editor@test.local', perfil: 'Editor' });
});

describe('GET /api/report-workspaces', () => {
    it('retorna todos os workspaces para superuser global', async () => {
        seedWorkspace('RW-A');
        seedWorkspace('RW-B');
        setAuth({ uid: 'admin_1', email: 'admin@test.local', perfil: 'Administrador' });

        const res = await request(app).get('/api/report-workspaces').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveLength(2);
        // superuser nao precisa consultar membership
        expect(mockWorkspaceMemberRepository.listWorkspaceIdsByUser).not.toHaveBeenCalled();
    });

    it('filtra workspaces por membership para usuario comum', async () => {
        seedWorkspace('RW-A');
        seedWorkspace('RW-B');
        seedWorkspace('RW-C');
        seedMember('RW-B', 'user_editor', 'editor');

        const res = await request(app).get('/api/report-workspaces').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe('RW-B');
        expect(mockWorkspaceMemberRepository.listWorkspaceIdsByUser).toHaveBeenCalledWith('user_editor');
    });

    it('retorna lista vazia quando usuario comum nao tem membership', async () => {
        seedWorkspace('RW-A');
        seedWorkspace('RW-B');

        const res = await request(app).get('/api/report-workspaces').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });

    it('anota currentUserRole em cada workspace para membro comum', async () => {
        seedWorkspace('RW-A');
        seedWorkspace('RW-B');
        seedMember('RW-A', 'user_editor', 'editor');
        seedMember('RW-B', 'user_editor', 'viewer');

        const res = await request(app).get('/api/report-workspaces').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        const byId = Object.fromEntries(res.body.data.map((w) => [w.id, w.currentUserRole]));
        expect(byId['RW-A']).toBe('editor');
        expect(byId['RW-B']).toBe('viewer');
    });

    it('superuser recebe currentUserRole = owner mesmo sem membership', async () => {
        seedWorkspace('RW-A');
        setAuth({ uid: 'admin_1', email: 'admin@test.local', perfil: 'Administrador' });

        const res = await request(app).get('/api/report-workspaces').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data[0].currentUserRole).toBe('owner');
        // nao chama listRolesForUser porque e superuser
        expect(mockWorkspaceMemberRepository.listRolesForUser).not.toHaveBeenCalled();
    });
});

describe('GET /api/report-workspaces/:id (com currentUserRole)', () => {
    it('inclui currentUserRole = role local para membro', async () => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'user_editor', 'editor');

        const res = await request(app)
            .get('/api/report-workspaces/RW-1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data.currentUserRole).toBe('editor');
    });

    it('inclui currentUserRole = owner para superuser global', async () => {
        seedWorkspace('RW-1');
        setAuth({ uid: 'admin_1', email: 'admin@test.local', perfil: 'Administrador' });

        const res = await request(app)
            .get('/api/report-workspaces/RW-1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data.currentUserRole).toBe('owner');
    });

    it('inclui link HATEOAS para a sub-resource /members', async () => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'user_editor', 'editor');

        const res = await request(app)
            .get('/api/report-workspaces/RW-1')
            .set('Authorization', 'Bearer t');

        expect(res.body.data._links).toBeDefined();
        expect(res.body.data._links.self.href).toMatch(/\/report-workspaces\/RW-1$/);
        expect(res.body.data._links.members.href).toMatch(/\/report-workspaces\/RW-1\/members$/);
        expect(res.body.data._links.members.method).toBe('GET');
    });
});

describe('HATEOAS dos endpoints de membros', () => {
    beforeEach(() => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'user_editor', 'owner');
        seedUser('target_user');
    });

    it('GET /:id/members retorna _links por item e no envelope', async () => {
        seedMember('RW-1', 'other', 'viewer');

        const res = await request(app)
            .get('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body._links.self.href).toMatch(/\/report-workspaces\/RW-1\/members$/);
        expect(res.body._links.workspace.href).toMatch(/\/report-workspaces\/RW-1$/);
        // owner local -> pode adicionar -> link `add` presente
        expect(res.body._links.add).toBeDefined();
        // cada membro tem self + delete (requester e owner)
        res.body.data.forEach((member) => {
            expect(member._links.self.href).toMatch(/\/members\/.+$/);
            expect(member._links.delete).toBeDefined();
            expect(member._links.workspace).toBeDefined();
        });
    });

    it('GET /:id/members omite link add quando requester nao tem write', async () => {
        // troca o default: user_editor vira viewer
        mockState.members.clear();
        seedMember('RW-1', 'user_editor', 'viewer');

        const res = await request(app)
            .get('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body._links.add).toBeUndefined();
        res.body.data.forEach((member) => {
            expect(member._links.delete).toBeUndefined();
        });
    });

    it('POST /:id/members retorna membro com _links.self', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'target_user', role: 'editor' });

        expect(res.status).toBe(201);
        expect(res.body.data._links.self.href).toMatch(/\/members\/target_user$/);
        expect(res.body.data._links.workspace).toBeDefined();
    });
});

describe('POST /api/report-workspaces (cria owner automatico)', () => {
    it('registra criador como owner apos salvar', async () => {
        const res = await request(app)
            .post('/api/report-workspaces')
            .set('Authorization', 'Bearer t')
            .send({
                data: { id: 'RW-NEW', nome: 'Novo WS', projectId: 'P1' },
                meta: { updatedBy: 'editor@test.local' },
            });

        expect(res.status).toBe(201);
        expect(mockWorkspaceMemberRepository.addMember).toHaveBeenCalledWith(
            'RW-NEW',
            'user_editor',
            'owner',
            'editor@test.local',
        );
        expect(mockState.members.get('RW-NEW:user_editor')?.role).toBe('owner');
    });

    it('nao registra worker interno como owner', async () => {
        setAuth({ uid: 'internal-worker', email: 'geomonitor-worker@internal', perfil: 'Administrador' });

        const res = await request(app)
            .post('/api/report-workspaces')
            .set('Authorization', 'Bearer t')
            .send({
                data: { id: 'RW-WORKER', nome: 'WS do Worker', projectId: 'P1' },
                meta: { updatedBy: 'worker' },
            });

        expect(res.status).toBe(201);
        expect(mockWorkspaceMemberRepository.addMember).not.toHaveBeenCalled();
    });
});

describe('GET /api/report-workspaces/:id/members', () => {
    beforeEach(() => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'owner_1', 'owner');
        seedMember('RW-1', 'editor_1', 'editor');
    });

    it('retorna lista para membro autenticado', async () => {
        setAuth({ uid: 'editor_1', email: 'editor1@test.local', perfil: 'Editor' });

        const res = await request(app)
            .get('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it('retorna 403 para nao-membro comum', async () => {
        setAuth({ uid: 'stranger', email: 'stranger@test.local', perfil: 'Editor' });

        const res = await request(app)
            .get('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(403);
    });

    it('retorna lista para superuser global mesmo sem membership', async () => {
        setAuth({ uid: 'admin_x', email: 'admin@test.local', perfil: 'Administrador' });

        const res = await request(app)
            .get('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });
});

describe('POST /api/report-workspaces/:id/members', () => {
    beforeEach(() => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'user_editor', 'owner'); // default auth user e owner
        seedUser('target_user', { email: 'target@test.local' });
    });

    it('adiciona membro com role valida', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'target_user', role: 'viewer' });

        expect(res.status).toBe(201);
        expect(res.body.data.role).toBe('viewer');
        expect(mockWorkspaceMemberRepository.addMember).toHaveBeenCalledWith(
            'RW-1',
            'target_user',
            'viewer',
            'editor@test.local',
        );
    });

    it('aceita payload envelopado em data', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ data: { userId: 'target_user', role: 'editor' } });

        expect(res.status).toBe(201);
        expect(res.body.data.role).toBe('editor');
    });

    it('rejeita userId vazio com 400', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ role: 'viewer' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/userId/i);
    });

    it('rejeita role invalida com 400', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'target_user', role: 'god' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/role invalida/i);
    });

    it('retorna 404 quando userId nao existe em users', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'ghost', role: 'viewer' });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/usuario/i);
    });

    it('retorna 404 quando workspace nao existe', async () => {
        const res = await request(app)
            .post('/api/report-workspaces/RW-X/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'target_user', role: 'viewer' });

        expect(res.status).toBe(403); // bloqueado antes pelo requireWorkspaceWrite
    });

    it('retorna 403 quando nao-membro tenta adicionar', async () => {
        setAuth({ uid: 'stranger', email: 'stranger@test.local', perfil: 'Editor' });

        const res = await request(app)
            .post('/api/report-workspaces/RW-1/members')
            .set('Authorization', 'Bearer t')
            .send({ userId: 'target_user', role: 'viewer' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/report-workspaces/:id/members/:userId', () => {
    beforeEach(() => {
        seedWorkspace('RW-1');
        seedMember('RW-1', 'user_editor', 'owner');
    });

    it('remove membro nao-owner com sucesso', async () => {
        seedMember('RW-1', 'user_editor_2', 'owner');
        seedMember('RW-1', 'viewer_1', 'viewer');

        const res = await request(app)
            .delete('/api/report-workspaces/RW-1/members/viewer_1')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(204);
        expect(mockState.members.has('RW-1:viewer_1')).toBe(false);
    });

    it('permite remover owner quando ha outro owner', async () => {
        seedMember('RW-1', 'owner_2', 'owner');

        const res = await request(app)
            .delete('/api/report-workspaces/RW-1/members/owner_2')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(204);
        expect(mockState.members.has('RW-1:owner_2')).toBe(false);
    });

    it('bloqueia remocao do ultimo owner com 400', async () => {
        // ha apenas user_editor como owner
        const res = await request(app)
            .delete('/api/report-workspaces/RW-1/members/user_editor')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/ultimo owner/i);
        expect(mockState.members.has('RW-1:user_editor')).toBe(true);
    });

    it('retorna 404 para membro inexistente', async () => {
        const res = await request(app)
            .delete('/api/report-workspaces/RW-1/members/ghost')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(404);
    });

    it('retorna 403 para nao-membro tentando remover', async () => {
        setAuth({ uid: 'stranger', email: 'stranger@test.local', perfil: 'Editor' });

        const res = await request(app)
            .delete('/api/report-workspaces/RW-1/members/user_editor')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(403);
    });
});
