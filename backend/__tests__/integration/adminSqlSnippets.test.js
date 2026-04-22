// Testa CRUD de snippets SQL admin em /api/admin/sql/snippets.
// Reusa o padrao de mock do adminSqlExecutor.test.js.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'admin-1', email: 'admin@test.local' };
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

jest.mock('../../data/postgresStore', () => ({
    __getPool: () => ({ connect: jest.fn() }),
    query: jest.fn(async () => ({ rows: [] })),
}));

const mockSnippetState = {
    store: new Map(),
    nextId: 1,
};

function mockCloneSnippet(s) {
    return s ? JSON.parse(JSON.stringify(s)) : null;
}

jest.mock('../../repositories', () => ({
    adminSqlAuditRepository: {
        insert: jest.fn(async () => ({})),
        list: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
    },
    adminSqlSnippetsRepository: {
        list: jest.fn(async () => {
            const arr = Array.from(mockSnippetState.store.values()).map(mockCloneSnippet);
            arr.sort((a, b) => a.name.localeCompare(b.name));
            return arr;
        }),
        getById: jest.fn(async (id) => mockCloneSnippet(mockSnippetState.store.get(String(id)) || null)),
        create: jest.fn(async ({ name, sqlText, description, createdBy }) => {
            const existsByName = Array.from(mockSnippetState.store.values()).some(
                (s) => s.name.toLowerCase() === String(name).trim().toLowerCase(),
            );
            if (existsByName) {
                const err = new Error('Ja existe snippet com esse nome.');
                err.code = 'SNIPPET_NAME_CONFLICT';
                err.status = 409;
                throw err;
            }
            const id = String(mockSnippetState.nextId++);
            const snippet = {
                id,
                name: String(name).trim(),
                sqlText: String(sqlText || ''),
                description: description == null ? null : String(description),
                createdBy,
                updatedBy: createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            mockSnippetState.store.set(id, snippet);
            return mockCloneSnippet(snippet);
        }),
        update: jest.fn(async (id, { name, sqlText, description, updatedBy }) => {
            const snippet = mockSnippetState.store.get(String(id));
            if (!snippet) return null;
            if (name !== undefined) {
                const conflict = Array.from(mockSnippetState.store.values()).some(
                    (s) => s.id !== snippet.id && s.name.toLowerCase() === String(name).trim().toLowerCase(),
                );
                if (conflict) {
                    const err = new Error('Ja existe snippet com esse nome.');
                    err.code = 'SNIPPET_NAME_CONFLICT';
                    err.status = 409;
                    throw err;
                }
                snippet.name = String(name).trim();
            }
            if (sqlText !== undefined) snippet.sqlText = String(sqlText);
            if (description !== undefined) snippet.description = description == null ? null : String(description);
            snippet.updatedBy = updatedBy;
            snippet.updatedAt = new Date().toISOString();
            return mockCloneSnippet(snippet);
        }),
        remove: jest.fn(async (id) => mockSnippetState.store.delete(String(id))),
    },
    userRepository: { list: jest.fn(async () => []) },
    reportDefaultsRepository: {},
    reportWorkspaceRepository: {},
    reportPhotoRepository: {},
    projectRepository: {},
    operatingLicenseRepository: {},
    inspectionRepository: {},
    erosionRepository: {},
    reportDeliveryTrackingRepository: {},
    projectPhotoExportRepository: {},
    projectDossierRepository: {},
    reportCompoundRepository: {},
    reportArchiveRepository: {},
    reportJobRepository: {},
    workspaceImportRepository: {},
    workspaceKmzRequestRepository: {},
    mediaAssetRepository: {},
    reportTemplateRepository: {},
    rulesConfigRepository: {},
    workspaceMemberRepository: {},
}));

const request = require('supertest');
const app = require('../../server');

beforeEach(() => {
    mockSnippetState.store.clear();
    mockSnippetState.nextId = 1;
});

describe('POST /api/admin/sql/snippets', () => {
    it('cria snippet com envelope HATEOAS e created_by preenchido', async () => {
        const res = await request(app)
            .post('/api/admin/sql/snippets')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'Torres por linha', sqlText: 'SELECT 1', description: 'testes' } });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('success');
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.name).toBe('Torres por linha');
        expect(res.body.data.createdBy).toBe('admin@test.local');
        expect(res.body.data._links.self.href).toContain('admin/sql/snippets/');
    });

    it('retorna 409 SNIPPET_NAME_CONFLICT em nome duplicado (case-insensitive)', async () => {
        await request(app)
            .post('/api/admin/sql/snippets')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'Foo', sqlText: 'SELECT 1' } });

        const res = await request(app)
            .post('/api/admin/sql/snippets')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'FOO', sqlText: 'SELECT 2' } });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SNIPPET_NAME_CONFLICT');
    });

    it('rejeita name vazio com VALIDATION_ERROR', async () => {
        const res = await request(app)
            .post('/api/admin/sql/snippets')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: '', sqlText: 'SELECT 1' } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita sqlText > 5000 chars', async () => {
        const res = await request(app)
            .post('/api/admin/sql/snippets')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'Grande', sqlText: 'x'.repeat(5001) } });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('GET /api/admin/sql/snippets', () => {
    it('lista snippets ordenados por nome', async () => {
        await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'Zebra', sqlText: 'SELECT 1' } });
        await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'Alpha', sqlText: 'SELECT 2' } });

        const res = await request(app).get('/api/admin/sql/snippets').set('Authorization', 'Bearer t');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].name).toBe('Alpha');
        expect(res.body.data[1].name).toBe('Zebra');
        expect(res.body.data[0]._links.self.href).toContain('admin/sql/snippets/');
    });
});

describe('PUT /api/admin/sql/snippets/:id', () => {
    it('atualiza campos parciais preservando os nao informados', async () => {
        const create = await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'Original', sqlText: 'SELECT 1', description: 'abc' } });
        const id = create.body.data.id;

        const res = await request(app).put(`/api/admin/sql/snippets/${id}`).set('Authorization', 'Bearer t')
            .send({ data: { description: 'atualizado' } });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Original');
        expect(res.body.data.sqlText).toBe('SELECT 1');
        expect(res.body.data.description).toBe('atualizado');
        expect(res.body.data.updatedBy).toBe('admin@test.local');
    });

    it('retorna 404 para snippet inexistente', async () => {
        const res = await request(app).put('/api/admin/sql/snippets/999').set('Authorization', 'Bearer t')
            .send({ data: { description: 'x' } });
        expect(res.status).toBe(404);
    });

    it('retorna 409 ao renomear para nome que ja existe', async () => {
        await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'A', sqlText: 'SELECT 1' } });
        const create = await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'B', sqlText: 'SELECT 2' } });
        const id = create.body.data.id;

        const res = await request(app).put(`/api/admin/sql/snippets/${id}`).set('Authorization', 'Bearer t')
            .send({ data: { name: 'A' } });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SNIPPET_NAME_CONFLICT');
    });
});

describe('DELETE /api/admin/sql/snippets/:id', () => {
    it('retorna 204 e remove da lista', async () => {
        const create = await request(app).post('/api/admin/sql/snippets').set('Authorization', 'Bearer t')
            .send({ data: { name: 'DelMe', sqlText: 'SELECT 1' } });
        const id = create.body.data.id;

        const res = await request(app).delete(`/api/admin/sql/snippets/${id}`).set('Authorization', 'Bearer t');
        expect(res.status).toBe(204);

        const listRes = await request(app).get('/api/admin/sql/snippets').set('Authorization', 'Bearer t');
        expect(listRes.body.data).toHaveLength(0);
    });

    it('retorna 404 para id inexistente', async () => {
        const res = await request(app).delete('/api/admin/sql/snippets/9999').set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });
});
