// Rota /api/monthly-reports: verifica guards (mockados), validacao Zod, envelope
// HATEOAS e mapeamento de notFound/conflict. O repository e mockado (a logica
// transacional real exige Postgres e fica fora deste teste de rota).

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
        monthlyReportRepository: {
            listByOwner: jest.fn(async () => []),
            getFull: jest.fn(async () => null),
            getByPeriod: jest.fn(async () => null),
            ensureForPeriod: jest.fn(async () => null),
            create: jest.fn(async () => null),
            saveFull: jest.fn(async () => ({ notFound: true })),
            remove: jest.fn(async () => {}),
        },
        monthlyReportSettingsRepository: {
            getByOwner: jest.fn(async () => null),
            saveByOwner: jest.fn(async () => null),
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
const { monthlyReportRepository, reportJobRepository } = require('../../repositories');
const { triggerWorkerRun } = require('../../utils/workerTrigger');

function sampleReport(overrides = {}) {
    return {
        id: 'MR-1',
        ownerUserId: 'owner-1',
        refYear: 2026,
        refMonth: 4,
        authorName: 'Ana',
        status: 'draft',
        version: 1,
        intro: '',
        conclusao: '',
        quadroStyle: 'marcador',
        holidays: [],
        engineers: [],
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /api/monthly-reports', () => {
    it('lista resumida com _links por item', async () => {
        monthlyReportRepository.listByOwner.mockResolvedValueOnce([
            { id: 'MR-1', refYear: 2026, refMonth: 4, authorName: 'Ana', status: 'draft', version: 2, updatedAt: '2026-05-01T00:00:00Z' },
        ]);
        const res = await request(app).get('/api/monthly-reports').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]._links.self.href).toContain('monthly-reports/MR-1');
        expect(monthlyReportRepository.listByOwner).toHaveBeenCalledWith('owner-1');
    });
});

describe('GET /api/monthly-reports/by-period', () => {
    it('garante o relatorio do periodo e retorna resource', async () => {
        monthlyReportRepository.ensureForPeriod.mockResolvedValueOnce(sampleReport());
        const res = await request(app)
            .get('/api/monthly-reports/by-period?year=2026&month=4')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data._links.self.href).toContain('monthly-reports/MR-1');
        expect(monthlyReportRepository.ensureForPeriod).toHaveBeenCalledWith('owner-1', 2026, 4, 'ana@empresa.com');
    });

    it('rejeita query invalida com 400', async () => {
        const res = await request(app)
            .get('/api/monthly-reports/by-period?year=abc&month=99')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('GET /api/monthly-reports/:id', () => {
    it('404 quando nao encontrado', async () => {
        monthlyReportRepository.getFull.mockResolvedValueOnce(null);
        const res = await request(app).get('/api/monthly-reports/MR-x').set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });

    it('200 com resource quando encontrado', async () => {
        monthlyReportRepository.getFull.mockResolvedValueOnce(sampleReport());
        const res = await request(app).get('/api/monthly-reports/MR-1').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data._links.update.method).toBe('PUT');
        expect(monthlyReportRepository.getFull).toHaveBeenCalledWith('MR-1', 'owner-1');
    });
});

describe('POST /api/monthly-reports', () => {
    it('rejeita categoria invalida com 400 VALIDATION_ERROR', async () => {
        const res = await request(app)
            .post('/api/monthly-reports')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    refYear: 2026,
                    refMonth: 4,
                    engineers: [{
                        name: 'Eng 1',
                        activities: [{ category: 'invalida', description: 'x', startDate: '2026-04-16', endDate: '2026-04-16' }],
                    }],
                },
            });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejeita quadroStyle invalido com 400 VALIDATION_ERROR', async () => {
        const res = await request(app)
            .post('/api/monthly-reports')
            .set('Authorization', 'Bearer t')
            .send({ data: { refYear: 2026, refMonth: 4, quadroStyle: 'zebra' } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('201 ao criar a partir de dados validos', async () => {
        monthlyReportRepository.create.mockResolvedValueOnce(sampleReport());
        const res = await request(app)
            .post('/api/monthly-reports')
            .set('Authorization', 'Bearer t')
            .send({ data: { refYear: 2026, refMonth: 4, authorName: 'Ana' } });
        expect(res.status).toBe(201);
        expect(res.body.data._links.self.href).toContain('monthly-reports/MR-1');
        expect(monthlyReportRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ ownerUserId: 'owner-1', updatedBy: 'ana@empresa.com', refYear: 2026, refMonth: 4 }),
        );
    });

    it('409 PERIOD_EXISTS em unique violation', async () => {
        const err = new Error('dup'); err.code = '23505';
        monthlyReportRepository.create.mockRejectedValueOnce(err);
        const res = await request(app)
            .post('/api/monthly-reports')
            .set('Authorization', 'Bearer t')
            .send({ data: { refYear: 2026, refMonth: 4 } });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PERIOD_EXISTS');
    });
});

describe('PUT /api/monthly-reports/:id', () => {
    it('200 em save bem-sucedido com engineers aninhados', async () => {
        monthlyReportRepository.saveFull.mockResolvedValueOnce({ report: sampleReport({ version: 2 }) });
        const res = await request(app)
            .put('/api/monthly-reports/MR-1')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    refYear: 2026,
                    refMonth: 4,
                    version: 1,
                    intro: 'Texto de introducao',
                    quadroStyle: 'barra',
                    holidays: [{ date: '2026-04-21', name: 'Tiradentes' }],
                    engineers: [{
                        id: 'MRE-1',
                        name: 'Matheus',
                        activities: [{ id: 'MRA-1', category: 'vistoria', description: 'LT 500kv', startDate: '2026-04-16', endDate: '2026-04-17' }],
                        projects: [{ id: 'MRP-1', name: 'LT 500 kV', description: 'Resumo' }],
                    }],
                },
            });
        expect(res.status).toBe(200);
        expect(res.body.data.version).toBe(2);
        expect(monthlyReportRepository.saveFull).toHaveBeenCalledWith(
            'MR-1',
            'owner-1',
            expect.objectContaining({
                updatedBy: 'ana@empresa.com',
                intro: 'Texto de introducao',
                quadroStyle: 'barra',
                holidays: [{ date: '2026-04-21', name: 'Tiradentes' }],
                engineers: [expect.objectContaining({
                    id: 'MRE-1',
                    name: 'Matheus',
                    activities: [expect.objectContaining({ category: 'vistoria' })],
                    projects: [expect.objectContaining({ name: 'LT 500 kV' })],
                })],
            }),
            1,
        );
    });

    it('404 quando o relatorio nao existe', async () => {
        monthlyReportRepository.saveFull.mockResolvedValueOnce({ notFound: true });
        const res = await request(app)
            .put('/api/monthly-reports/MR-x')
            .set('Authorization', 'Bearer t')
            .send({ data: { refYear: 2026, refMonth: 4 } });
        expect(res.status).toBe(404);
    });

    it('409 VERSION_CONFLICT quando version diverge', async () => {
        monthlyReportRepository.saveFull.mockResolvedValueOnce({ conflict: true, currentVersion: 5 });
        const res = await request(app)
            .put('/api/monthly-reports/MR-1')
            .set('Authorization', 'Bearer t')
            .send({ data: { refYear: 2026, refMonth: 4, version: 2 } });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.currentVersion).toBe(5);
    });
});

describe('POST /api/monthly-reports/:id/generate', () => {
    it('enfileira job monthly_report e dispara o worker (202)', async () => {
        monthlyReportRepository.getFull.mockResolvedValueOnce(sampleReport());
        reportJobRepository.save.mockImplementationOnce(async (job) => ({ ...job }));

        const res = await request(app)
            .post('/api/monthly-reports/MR-1/generate')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(202);
        const savedArg = reportJobRepository.save.mock.calls[0][0];
        expect(savedArg).toEqual(
            expect.objectContaining({ kind: 'monthly_report', monthlyReportId: 'MR-1', ownerUserId: 'owner-1', statusExecucao: 'queued' }),
        );
        expect(savedArg.id).toMatch(/^JOB-/);
        expect(res.body.data._links.self.href).toContain(`report-jobs/${savedArg.id}`);
        expect(triggerWorkerRun).toHaveBeenCalled();
    });

    it('404 quando o relatorio nao existe', async () => {
        monthlyReportRepository.getFull.mockResolvedValueOnce(null);
        const res = await request(app)
            .post('/api/monthly-reports/MR-x/generate')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
        expect(reportJobRepository.save).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/monthly-reports/:id', () => {
    it('204 sem body', async () => {
        const res = await request(app).delete('/api/monthly-reports/MR-1').set('Authorization', 'Bearer t');
        expect(res.status).toBe(204);
        expect(monthlyReportRepository.remove).toHaveBeenCalledWith('MR-1', 'owner-1');
    });
});
