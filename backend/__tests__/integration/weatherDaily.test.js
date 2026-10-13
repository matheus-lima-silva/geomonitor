// Integration: GET /api/weather/daily (proxy Open-Meteo com cache em memoria).

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'user-1', email: 'user@test.local' };
        req.userProfile = { status: 'Ativo', perfil: 'Editor' };
        next();
    };
    return {
        verifyToken: pass,
        requireActiveUser: pass,
        requireActiveUserOrWorker: pass,
        requireEditor: [pass],
        requireEditorOrWorker: pass,
        requireAdminOrWorker: pass,
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
        rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn(async (p) => p) },
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
const { resetWeatherCache } = require('../../utils/openMeteo');

const originalFetch = global.fetch;

const ARCHIVE_PAYLOAD = {
    latitude: -20.0703,
    longitude: -44.86487,
    timezone: 'America/Sao_Paulo',
    daily: {
        time: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'],
        weather_code: [3, 55, 55, 51],
        precipitation_sum: [0, 2, 3.4, 1],
        precipitation_hours: [0, 6, 11, 6],
        temperature_2m_max: [27.4, 30.6, 25.1, 28.3],
        temperature_2m_min: [17.3, 19, 18.2, 16.1],
    },
};

const QUERY = 'lat=-20.074&lon=-44.826&start=2026-09-21&end=2026-09-24';

beforeEach(() => {
    resetWeatherCache();
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe('GET /api/weather/daily', () => {
    test('devolve os dias classificados com envelope HATEOAS (caso BMDOPR)', async () => {
        global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ARCHIVE_PAYLOAD }));
        const response = await request(app).get(`/api/weather/daily?${QUERY}`);
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('_links.self.href');
        expect(response.body.data.source).toBe('archive');
        expect(response.body.data.days.map((d) => d.clima)).toEqual(['Nublado', 'Chuva', 'Chuva', 'Chuva']);
        expect(response.body.data.days[1]).toMatchObject({ date: '2026-09-22', weatherCode: 55, precipitationSum: 2, reason: 'chuvisco 6 h, 2 mm' });
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('archive-api.open-meteo.com/v1/archive?');
        expect(global.fetch.mock.calls[0][0]).toContain('start_date=2026-09-21');
    });

    test('segunda consulta igual sai do cache sem novo fetch', async () => {
        global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ARCHIVE_PAYLOAD }));
        const first = await request(app).get(`/api/weather/daily?${QUERY}`);
        const second = await request(app).get(`/api/weather/daily?${QUERY}`);
        expect(first.body.data.cached).toBe(false);
        expect(second.body.data.cached).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('400 em query invalida sem tocar o upstream', async () => {
        global.fetch = jest.fn();
        const bad = [
            'lat=100&lon=-44&start=2026-09-21&end=2026-09-24',
            'lat=-20&lon=-44&start=2026-09-24&end=2026-09-21',
            'lat=-20&lon=-44&start=2026-01-01&end=2026-06-30',
            'lat=-20&lon=-44&start=21/09/2026&end=2026-09-24',
        ];
        for (const query of bad) {
            const response = await request(app).get(`/api/weather/daily?${query}`);
            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        }
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('datas recentes usam a forecast API com past_days', async () => {
        const today = new Date();
        const iso = (daysAgo) => new Date(today.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
        const start = iso(3);
        const end = iso(1);
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ daily: { time: [iso(4), start, iso(2), end, iso(0)], weather_code: [0, 0, 2, 3, 0], precipitation_sum: [0, 0, 0, 0, 0], precipitation_hours: [0, 0, 0, 0, 0], temperature_2m_max: [1, 1, 1, 1, 1], temperature_2m_min: [0, 0, 0, 0, 0] } }),
        }));
        const response = await request(app).get(`/api/weather/daily?lat=-20&lon=-44&start=${start}&end=${end}`);
        expect(response.status).toBe(200);
        expect(response.body.data.source).toBe('forecast');
        expect(global.fetch.mock.calls[0][0]).toContain('api.open-meteo.com/v1/forecast?');
        expect(global.fetch.mock.calls[0][0]).toContain('past_days=');
        expect(response.body.data.days.map((d) => d.date)).toEqual([start, iso(2), end]);
    });

    test('504 em timeout e 502 em erro/upstream nao-ok', async () => {
        global.fetch = jest.fn(async (_url, opts) => new Promise((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
            // Forca o abort sem esperar os 5 s reais.
            setTimeout(() => opts.signal.dispatchEvent(new Event('abort')), 0);
        }));
        const timeout = await request(app).get(`/api/weather/daily?${QUERY}`);
        expect(timeout.status).toBe(504);
        expect(timeout.body.code).toBe('WEATHER_TIMEOUT');

        resetWeatherCache();
        global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        const upstream = await request(app).get(`/api/weather/daily?${QUERY}`);
        expect(upstream.status).toBe(502);
        expect(upstream.body.code).toBe('WEATHER_UPSTREAM');

        resetWeatherCache();
        global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
        const network = await request(app).get(`/api/weather/daily?${QUERY}`);
        expect(network.status).toBe(502);
    });
});
