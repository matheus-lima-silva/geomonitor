// Integration: GET /api/rules/feriados/importar (proxy BrasilAPI).

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

jest.mock('../../repositories', () => {
    const mockStubRepo = {
        list: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 })),
        getById: jest.fn(async () => null),
        create: jest.fn(async (x) => x),
        update: jest.fn(async (_id, x) => x),
        delete: jest.fn(async () => true),
        save: jest.fn(async (p) => p),
        get: jest.fn(async () => null),
    };
    return {
        rulesConfigRepository: {
            get: jest.fn(async () => null),
            save: jest.fn(async (p) => p),
        },
        adminSqlAuditRepository: mockStubRepo,
        userRepository: mockStubRepo,
        reportDefaultsRepository: mockStubRepo,
        reportWorkspaceRepository: mockStubRepo,
        reportPhotoRepository: mockStubRepo,
        projectRepository: mockStubRepo,
        operatingLicenseRepository: mockStubRepo,
        inspectionRepository: mockStubRepo,
        erosionRepository: mockStubRepo,
        reportDeliveryTrackingRepository: mockStubRepo,
        projectPhotoExportRepository: mockStubRepo,
        projectDossierRepository: mockStubRepo,
        reportCompoundRepository: mockStubRepo,
        reportArchiveRepository: mockStubRepo,
        reportJobRepository: mockStubRepo,
        workspaceImportRepository: mockStubRepo,
        workspaceKmzRequestRepository: mockStubRepo,
        mediaAssetRepository: mockStubRepo,
        reportTemplateRepository: mockStubRepo,
        workspaceMemberRepository: mockStubRepo,
        systemAlertsRepository: mockStubRepo,
        profissoesRepository: mockStubRepo,
    };
});

const request = require('supertest');
const app = require('../../server');

const originalFetch = global.fetch;

afterEach(() => {
    global.fetch = originalFetch;
});

describe('GET /api/rules/feriados/importar', () => {
    test('retorna lista mapeada da BrasilAPI com envelope HATEOAS', async () => {
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => [
                { date: '2026-01-01', name: 'Confraternizacao Universal', type: 'national' },
                { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
            ],
        }));

        const res = await request(app).get('/api/rules/feriados/importar?ano=2026');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.ano).toBe(2026);
        expect(res.body.data.feriados).toEqual([
            { data: '2026-01-01', nome: 'Confraternizacao Universal', tipo: 'nacional' },
            { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
        ]);
        expect(res.body.data._links).toHaveProperty('self.href');
        expect(res.body.data._links.self.href).toContain('/rules/feriados/importar');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://brasilapi.com.br/api/feriados/v1/2026',
            expect.objectContaining({ headers: expect.any(Object) }),
        );
    });

    test('rejeita ano invalido', async () => {
        global.fetch = jest.fn();

        const resSemAno = await request(app).get('/api/rules/feriados/importar');
        expect(resSemAno.status).toBe(400);
        expect(resSemAno.body.status).toBe('error');

        const resForaFaixa = await request(app).get('/api/rules/feriados/importar?ano=1800');
        expect(resForaFaixa.status).toBe(400);

        const resNaoNumero = await request(app).get('/api/rules/feriados/importar?ano=abc');
        expect(resNaoNumero.status).toBe(400);

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('propaga erro upstream 5xx como 502', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 503,
            json: async () => ({}),
        }));

        const res = await request(app).get('/api/rules/feriados/importar?ano=2026');

        expect(res.status).toBe(502);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toContain('503');
    });

    test('retorna 504 quando BrasilAPI aborta', async () => {
        global.fetch = jest.fn(async (_url, opts) => {
            return new Promise((_resolve, reject) => {
                opts?.signal?.addEventListener('abort', () => {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            });
        });

        // Nao e preciso esperar 5s - o timeout interno e controlado pelo controller.
        // Forcamos o timeout antecipado spy-ando setTimeout no modulo de rota? Melhor: dispara o abort
        // manualmente via mock que chama abort imediatamente.
        // Refatoramos o fetch para chamar abort sincrono.
        global.fetch = jest.fn(async (_url, opts) => {
            opts?.signal?.dispatchEvent?.(new Event('abort'));
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        });

        const res = await request(app).get('/api/rules/feriados/importar?ano=2026');

        expect(res.status).toBe(504);
        expect(res.body.status).toBe('error');
    });

    test('retorna 502 quando JSON da BrasilAPI e invalido', async () => {
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => {
                throw new Error('unexpected token');
            },
        }));

        const res = await request(app).get('/api/rules/feriados/importar?ano=2026');

        expect(res.status).toBe(502);
        expect(res.body.status).toBe('error');
    });

    test('ignora itens malformados do payload', async () => {
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => [
                { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
                { date: 123, name: 'Broken' },
                null,
                { name: 'Sem data' },
            ],
        }));

        const res = await request(app).get('/api/rules/feriados/importar?ano=2026');

        expect(res.status).toBe(200);
        expect(res.body.data.feriados).toHaveLength(1);
        expect(res.body.data.feriados[0].data).toBe('2026-04-21');
    });
});

describe('GET /api/rules', () => {
    test('expoe link importarFeriados mesmo quando config nao existe', async () => {
        const { rulesConfigRepository } = require('../../repositories');
        rulesConfigRepository.get.mockResolvedValueOnce({ criticalidade: {}, feriados: [] });

        const res = await request(app).get('/api/rules');

        expect(res.status).toBe(200);
        expect(res.body.data._links).toHaveProperty('importarFeriados.href');
        expect(res.body.data._links.importarFeriados.href).toContain('/rules/feriados/importar');
    });
});
