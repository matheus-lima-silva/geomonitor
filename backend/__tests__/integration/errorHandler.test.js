// Valida o fluxo completo de tratamento de erros:
// asyncHandler -> next(error) -> global error handler em server.js -> 500 + logError
//
// Cenarios: repo lanca em GET/POST, erro com .status customizado, ZodError manual,
// producao nao vaza err.message.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'test', email: 'test@test.local' };
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

// Mocks programaveis dos repositorios.
const mocks = {
    inspectionList: jest.fn(async () => []),
    inspectionSave: jest.fn(async (data) => data),
    inspectionGetById: jest.fn(async () => null),
    inspectionRemove: jest.fn(async () => {}),
    inspectionListPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })),
};

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    return {
        inspectionRepository: {
            list: (...args) => mocks.inspectionList(...args),
            listPaginated: (...args) => mocks.inspectionListPaginated(...args),
            getById: (...args) => mocks.inspectionGetById(...args),
            save: (...args) => mocks.inspectionSave(...args),
            remove: (...args) => mocks.inspectionRemove(...args),
        },
        userRepository: { list: noopList, getById: jest.fn(), save: jest.fn(), listPaginated: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })) },
        erosionRepository: { list: noopList, listPaginated: jest.fn(), getById: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList },
        reportJobRepository: { list: noopList, getById: jest.fn(async () => null), save: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn() },
        mediaAssetRepository: { getById: jest.fn() },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listWorkspaceIdsByUser: jest.fn(async () => []),
            addMember: jest.fn(),
        },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({
    getByEmail: jest.fn(async () => null),
}));

jest.mock('../../utils/mailer', () => ({
    getMailTransport: () => null,
    sendResetEmail: jest.fn(async () => {}),
}));

const request = require('supertest');
const app = require('../../server');

const validInspection = {
    data: {
        id: 'VS-ERR-1',
        projetoId: 'PROJ-1',
        dataInicio: '2026-01-15',
        dataFim: '2026-01-20',
        status: 'aberta',
        detalhesDias: [],
    },
    meta: { updatedBy: 'test@test.local' },
};

let consoleErrorSpy;
const originalEnv = process.env.NODE_ENV;

beforeEach(() => {
    // Silencia console.error dos testes (o global handler loga via logError)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Reset mocks
    Object.values(mocks).forEach((m) => m.mockReset().mockImplementation(async () => null));
    mocks.inspectionList.mockImplementation(async () => []);
    mocks.inspectionSave.mockImplementation(async (data) => data);
    mocks.inspectionListPaginated.mockImplementation(async () => ({ items: [], total: 0, page: 1, limit: 50 }));
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
});

describe('asyncHandler -> next(error) -> global handler', () => {
    it('GET lancando em repo.list() retorna 500 com message do erro (dev mode)', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionList.mockImplementation(async () => {
            throw new Error('DB connection lost');
        });

        const res = await request(app)
            .get('/api/inspections')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(500);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toBe('DB connection lost');
        // Confirma que logError foi chamado
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('POST lancando em repo.save() retorna 500 e invoca logError', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionSave.mockImplementation(async () => {
            throw new Error('UNIQUE constraint violated');
        });

        const res = await request(app)
            .post('/api/inspections')
            .set('Authorization', 'Bearer t')
            .send(validInspection);

        expect(res.status).toBe(500);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toBe('UNIQUE constraint violated');

        // Verifica que logError enriqueceu o log
        expect(consoleErrorSpy).toHaveBeenCalled();
        const [label, payload] = consoleErrorSpy.mock.calls[0];
        expect(label).toContain('Geomonitor API Global');
        expect(payload.message).toBe('UNIQUE constraint violated');
    });

    it('erro com .status customizado respeita o status no response', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionList.mockImplementation(async () => {
            const err = new Error('Forbidden scope');
            err.status = 403;
            throw err;
        });

        const res = await request(app)
            .get('/api/inspections')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Forbidden scope');
    });

    it('production mode substitui err.message por mensagem generica', async () => {
        process.env.NODE_ENV = 'production';
        mocks.inspectionList.mockImplementation(async () => {
            throw new Error('Password incorrect for alice@corp.local');
        });

        const res = await request(app)
            .get('/api/inspections')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Ocorreu um erro interno no servidor.');
        // A mensagem com o email NAO pode aparecer no response
        expect(res.body.message).not.toContain('alice');
        expect(res.body.message).not.toContain('Password');
    });

    it('production mode: logError nao inclui stack no payload', async () => {
        process.env.NODE_ENV = 'production';
        mocks.inspectionList.mockImplementation(async () => {
            throw new Error('leak me if you can');
        });

        await request(app).get('/api/inspections').set('Authorization', 'Bearer t');

        expect(consoleErrorSpy).toHaveBeenCalled();
        // O payload logado (segundo argumento) nao deve conter stack em producao
        const payload = consoleErrorSpy.mock.calls[0][1];
        expect(payload.stack).toBeUndefined();
        expect(payload.message).toBe('leak me if you can');
    });

    it('logError redata authorization header no log', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionList.mockImplementation(async () => {
            throw new Error('boom');
        });

        await request(app)
            .get('/api/inspections')
            .set('Authorization', 'Bearer super-secret-token-do-not-leak')
            .set('Cookie', 'sid=abcdef');

        expect(consoleErrorSpy).toHaveBeenCalled();
        const payload = consoleErrorSpy.mock.calls[0][1];
        expect(payload.headers).toBeDefined();
        expect(payload.headers.authorization).toBe('[REDACTED]');
        expect(payload.headers.cookie).toBe('[REDACTED]');
        // Headers seguros sao preservados
        expect(payload.headers.host).toBeDefined();
    });

    it('logError redata password do body no log', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionSave.mockImplementation(async () => {
            throw new Error('save failed');
        });

        // O campo password e embutido dentro de data (que usa .passthrough() no
        // schema), entao sobrevive ao validateBody. O objetivo do teste e garantir
        // que redactObject pega o campo mesmo quando chega como payload valido.
        await request(app)
            .post('/api/inspections')
            .set('Authorization', 'Bearer t')
            .send({
                ...validInspection,
                data: {
                    ...validInspection.data,
                    password: 'should-not-leak',
                    token: 'also-secret',
                },
            });

        expect(consoleErrorSpy).toHaveBeenCalled();
        const payload = consoleErrorSpy.mock.calls[0][1];
        expect(payload.body).toBeDefined();
        // redactObject recursa em objetos — data.password deve estar redatado
        expect(payload.body.data.password).toBe('[REDACTED]');
        expect(payload.body.data.token).toBe('[REDACTED]');
        // Campos nao-sensiveis preservados
        expect(payload.body.data.projetoId).toBe('PROJ-1');
    });
});

describe('ZodError fluindo para global handler', () => {
    // Caso quando um ZodError escapa do middleware validateBody.
    // Cenario realista: um handler manual chama schema.parse() e lança.
    // Usamos o fluxo natural: payload invalido no POST /api/inspections
    // que cai no validateBody e retorna 400 (testado em outros arquivos).
    //
    // Aqui validamos o caminho DIFERENTE: um erro com name='ZodError'
    // sendo lançado depois que o validateBody ja passou.
    it('erro com name=ZodError retorna 400 VALIDATION_ERROR mesmo fora do middleware', async () => {
        process.env.NODE_ENV = 'test';
        mocks.inspectionSave.mockImplementation(async () => {
            const err = new Error('zod issue');
            err.name = 'ZodError';
            err.issues = [{ path: ['x'], message: 'invalid', code: 'custom' }];
            throw err;
        });

        const res = await request(app)
            .post('/api/inspections')
            .set('Authorization', 'Bearer t')
            .send(validInspection);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});
