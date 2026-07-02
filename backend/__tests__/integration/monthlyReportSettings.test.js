// Rota /api/monthly-report-settings: singleton por usuario (equipe + contrato).
// Verifica envelope HATEOAS, validacao Zod e escopo por owner. Repository mockado.

jest.mock('../../utils/authMiddleware', () => {
    const pass = (req, res, next) => {
        req.user = { uid: 'owner-1', email: 'ana@empresa.com' };
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

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    const noopPaginated = jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 }));
    return {
        monthlyReportSettingsRepository: {
            getByOwner: jest.fn(async () => null),
            saveByOwner: jest.fn(async () => null),
        },
        monthlyReportRepository: {
            listByOwner: jest.fn(async () => []),
            getFull: jest.fn(async () => null),
            getByPeriod: jest.fn(async () => null),
            ensureForPeriod: jest.fn(async () => null),
            create: jest.fn(async () => null),
            saveFull: jest.fn(async () => ({ notFound: true })),
            remove: jest.fn(async () => {}),
        },
        userRepository: { list: noopList, getById: jest.fn(async () => null), save: jest.fn(), remove: jest.fn(), listPaginated: noopPaginated },
        erosionRepository: { list: noopList, listPaginated: noopPaginated, getById: jest.fn() },
        inspectionRepository: { list: noopList, listPaginated: noopPaginated, getById: jest.fn(), save: jest.fn(), remove: jest.fn() },
        projectRepository: { list: noopList, getById: jest.fn() },
        operatingLicenseRepository: { list: noopList, getById: jest.fn() },
        reportJobRepository: { list: noopList, getById: jest.fn(async () => null), save: jest.fn() },
        reportWorkspaceRepository: { list: noopList, getById: jest.fn(), save: jest.fn() },
        reportPhotoRepository: { listByWorkspace: noopList },
        reportDeliveryTrackingRepository: { list: noopList },
        reportTemplateRepository: { list: noopList },
        reportCompoundRepository: { list: noopList },
        projectDossierRepository: { list: noopList },
        projectPhotoExportRepository: { list: noopList },
        reportDefaultsRepository: { getByProjectId: jest.fn(async () => null) },
        rulesConfigRepository: { get: jest.fn(async () => null), save: jest.fn() },
        mediaAssetRepository: { getById: jest.fn(async () => null) },
        workspaceImportRepository: { save: jest.fn() },
        workspaceKmzRequestRepository: {},
        workspaceMemberRepository: {
            listWorkspaceIdsByUser: jest.fn(async () => []),
            addMember: jest.fn(),
        },
    };
});

jest.mock('../../repositories/authCredentialsRepository', () => ({ getByEmail: jest.fn(async () => null) }));
jest.mock('../../utils/mailer', () => ({ getMailTransport: () => null, sendResetEmail: jest.fn(async () => {}) }));
jest.mock('../../utils/workerTrigger', () => ({ triggerWorkerRun: jest.fn() }));

const request = require('supertest');
const app = require('../../server');
const { monthlyReportSettingsRepository } = require('../../repositories');

function sampleSettings(overrides = {}) {
    return {
        ownerUserId: 'owner-1',
        team: [{ id: 'mem-1', name: 'Matheus Lima' }],
        contrato: { numero: '30001490', objeto: 'APOIO A FISCALIZACAO', contratante: 'AXIA', contratada: 'CONCREMAT' },
        updatedAt: '2026-06-01T00:00:00Z',
        updatedBy: 'ana@empresa.com',
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /api/monthly-report-settings', () => {
    it('retorna as settings do usuario com _links', async () => {
        monthlyReportSettingsRepository.getByOwner.mockResolvedValueOnce(sampleSettings());
        const res = await request(app).get('/api/monthly-report-settings').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.team).toHaveLength(1);
        expect(res.body.data.contrato.numero).toBe('30001490');
        expect(res.body.data._links.self.href).toContain('monthly-report-settings');
        expect(monthlyReportSettingsRepository.getByOwner).toHaveBeenCalledWith('owner-1');
    });
});

describe('PUT /api/monthly-report-settings', () => {
    it('upsert com envelope { data } e updatedBy do usuario', async () => {
        monthlyReportSettingsRepository.saveByOwner.mockResolvedValueOnce(sampleSettings());
        const res = await request(app)
            .put('/api/monthly-report-settings')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    team: [{ id: 'mem-1', name: 'Matheus Lima' }],
                    contrato: { numero: '30001490' },
                },
            });
        expect(res.status).toBe(200);
        expect(res.body.data._links.self.href).toContain('monthly-report-settings');
        expect(monthlyReportSettingsRepository.saveByOwner).toHaveBeenCalledWith(
            'owner-1',
            expect.objectContaining({
                team: [{ id: 'mem-1', name: 'Matheus Lima' }],
                contrato: expect.objectContaining({ numero: '30001490' }),
            }),
            'ana@empresa.com',
        );
    });

    it('rejeita payload invalido com 400 VALIDATION_ERROR', async () => {
        const res = await request(app)
            .put('/api/monthly-report-settings')
            .set('Authorization', 'Bearer t')
            .send({ data: { team: [{ name: 123 }] } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(monthlyReportSettingsRepository.saveByOwner).not.toHaveBeenCalled();
    });
});
