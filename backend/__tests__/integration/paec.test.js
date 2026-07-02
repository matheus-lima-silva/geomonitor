// Rotas /api/paec (templates + fichas por usina + generate): guards mockados,
// validacao Zod, envelope HATEOAS, 409s (NAME_EXISTS, REVISION_EXISTS,
// VERSION_CONFLICT) e enfileiramento do job paec_report. Repositories
// mockados (a logica transacional real exige Postgres).

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
        requireAdmin: [pass],
        requireAdminOrWorker: pass,
        getCachedProfile: jest.fn(() => null),
        setCachedProfile: jest.fn(),
        invalidateCachedProfile: jest.fn(),
    };
});

jest.mock('../../repositories', () => {
    const noopList = jest.fn(async () => []);
    const noopPaginated = jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 50 }));
    return {
        paecTemplateRepository: {
            list: jest.fn(async () => []),
            getById: jest.fn(async () => null),
            getActive: jest.fn(async () => null),
            create: jest.fn(async () => null),
            activate: jest.fn(async () => null),
        },
        paecPlantRepository: {
            list: jest.fn(async () => []),
            getFull: jest.fn(async () => null),
            create: jest.fn(async () => null),
            saveFull: jest.fn(async () => ({ notFound: true })),
            remove: jest.fn(async () => {}),
        },
        monthlyReportRepository: {
            listByOwner: noopList,
            getFull: jest.fn(async () => null),
            getByPeriod: jest.fn(async () => null),
            ensureForPeriod: jest.fn(async () => null),
            create: jest.fn(async () => null),
            saveFull: jest.fn(async () => ({ notFound: true })),
            remove: jest.fn(async () => {}),
        },
        monthlyReportSettingsRepository: { getByOwner: jest.fn(async () => null), saveByOwner: jest.fn() },
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
const { paecTemplateRepository, paecPlantRepository, reportJobRepository } = require('../../repositories');
const { triggerWorkerRun } = require('../../utils/workerTrigger');

function sampleManifest() {
    return {
        templateName: 'PAEC AXIA',
        revisionLabel: 'REV 10',
        fields: [
            { key: 'usina', label: 'Usina', section: 'identificacao', type: 'text', required: true, sampleValue: 'Marimbondo' },
            { key: 'cnpj_1', label: 'CNPJ', section: 'identificacao', type: 'text', required: true, sampleValue: '00.000.000/0000-00' },
        ],
        blocks: [{ key: 'brigadistas', kind: 'list', label: 'Relacao de brigadistas' }],
        sections: [],
        imageSlots: [],
    };
}

function sampleTemplate(overrides = {}) {
    return {
        id: 'PAECT-1',
        name: 'PAEC AXIA',
        revisionLabel: 'REV 10',
        status: 'active',
        sourceDocxMediaId: null,
        tokenizedDocxMediaId: 'MEDIA-tok',
        manifest: sampleManifest(),
        ...overrides,
    };
}

function samplePlant(overrides = {}) {
    return {
        id: 'PAEC-1',
        name: 'PCH Anta',
        projectId: null,
        plantType: 'PCH',
        installedCapacityMw: 12.5,
        templateId: 'PAECT-1',
        version: 1,
        fields: { usina: 'PCH Anta' },
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /api/paec/templates', () => {
    it('lista com _links por item', async () => {
        paecTemplateRepository.list.mockResolvedValueOnce([sampleTemplate()]);
        const res = await request(app).get('/api/paec/templates').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data[0]._links.self.href).toContain('paec/templates/PAECT-1');
        expect(res.body.data[0]._links.activate.method).toBe('POST');
    });
});

describe('POST /api/paec/templates', () => {
    it('201 registrando revisao com manifest valido', async () => {
        paecTemplateRepository.create.mockResolvedValueOnce(sampleTemplate({ status: 'draft' }));
        const res = await request(app)
            .post('/api/paec/templates')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    revisionLabel: 'REV 10',
                    tokenizedDocxMediaId: 'MEDIA-tok',
                    manifest: sampleManifest(),
                },
            });
        expect(res.status).toBe(201);
        expect(paecTemplateRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'PAEC AXIA', revisionLabel: 'REV 10', updatedBy: 'ana@empresa.com' }),
        );
    });

    it('400 sem tokenizedDocxMediaId', async () => {
        const res = await request(app)
            .post('/api/paec/templates')
            .set('Authorization', 'Bearer t')
            .send({ data: { revisionLabel: 'REV 10', manifest: sampleManifest() } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('409 REVISION_EXISTS em unique violation', async () => {
        const err = new Error('dup'); err.code = '23505';
        paecTemplateRepository.create.mockRejectedValueOnce(err);
        const res = await request(app)
            .post('/api/paec/templates')
            .set('Authorization', 'Bearer t')
            .send({
                data: { revisionLabel: 'REV 10', tokenizedDocxMediaId: 'MEDIA-tok', manifest: sampleManifest() },
            });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('REVISION_EXISTS');
    });
});

describe('POST /api/paec/templates/:id/activate', () => {
    it('200 ativando', async () => {
        paecTemplateRepository.activate.mockResolvedValueOnce(sampleTemplate());
        const res = await request(app)
            .post('/api/paec/templates/PAECT-1/activate')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(paecTemplateRepository.activate).toHaveBeenCalledWith('PAECT-1', { updatedBy: 'ana@empresa.com' });
    });

    it('404 quando nao existe', async () => {
        paecTemplateRepository.activate.mockResolvedValueOnce(null);
        const res = await request(app)
            .post('/api/paec/templates/PAECT-x/activate')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });
});

describe('GET /api/paec/plants', () => {
    it('lista com completude por ficha', async () => {
        paecPlantRepository.list.mockResolvedValueOnce([
            { ...samplePlant(), templateRevisionLabel: 'REV 10', filledFields: 1 },
        ]);
        paecTemplateRepository.list.mockResolvedValueOnce([]);
        paecTemplateRepository.getById.mockResolvedValueOnce(sampleTemplate());
        const res = await request(app).get('/api/paec/plants').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data[0].completeness).toEqual({ fieldsFilled: 1, fieldsTotal: 2 });
        expect(res.body.data[0]._links.generate.method).toBe('POST');
    });
});

describe('POST /api/paec/plants', () => {
    it('422 NO_ACTIVE_TEMPLATE sem revisao ativa', async () => {
        paecTemplateRepository.getActive.mockResolvedValueOnce(null);
        const res = await request(app)
            .post('/api/paec/plants')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'PCH Anta' } });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('NO_ACTIVE_TEMPLATE');
    });

    it('201 criando ficha vinculada ao template ativo', async () => {
        paecTemplateRepository.getActive.mockResolvedValueOnce(sampleTemplate());
        paecPlantRepository.create.mockResolvedValueOnce(samplePlant());
        const res = await request(app)
            .post('/api/paec/plants')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    name: 'PCH Anta',
                    plantType: 'PCH',
                    installedCapacityMw: 12.5,
                    fields: { usina: 'PCH Anta' },
                },
            });
        expect(res.status).toBe(201);
        expect(paecPlantRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'PCH Anta',
                templateId: 'PAECT-1',
                plantType: 'PCH',
                installedCapacityMw: 12.5,
                updatedBy: 'ana@empresa.com',
            }),
        );
        expect(res.body.data._links.self.href).toContain('paec/plants/PAEC-1');
        expect(res.body.data.plantType).toBe('PCH');
        expect(res.body.data.installedCapacityMw).toBe(12.5);
    });

    it('400 com plantType invalido', async () => {
        paecTemplateRepository.getActive.mockResolvedValueOnce(sampleTemplate());
        const res = await request(app)
            .post('/api/paec/plants')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'PCH Anta', plantType: 'ETE' } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(paecPlantRepository.create).not.toHaveBeenCalled();
    });

    it('409 NAME_EXISTS em unique violation', async () => {
        paecTemplateRepository.getActive.mockResolvedValueOnce(sampleTemplate());
        const err = new Error('dup'); err.code = '23505';
        paecPlantRepository.create.mockRejectedValueOnce(err);
        const res = await request(app)
            .post('/api/paec/plants')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'PCH Anta' } });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('NAME_EXISTS');
    });
});

describe('GET /api/paec/plants/:id', () => {
    it('404 quando nao encontrada', async () => {
        paecPlantRepository.getFull.mockResolvedValueOnce(null);
        const res = await request(app).get('/api/paec/plants/PAEC-x').set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });

    it('200 com pendencias computadas do manifest', async () => {
        paecPlantRepository.getFull.mockResolvedValueOnce(samplePlant());
        paecTemplateRepository.getById.mockResolvedValueOnce(sampleTemplate());
        const res = await request(app).get('/api/paec/plants/PAEC-1').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.data.templateRevisionLabel).toBe('REV 10');
        // usina preenchida; cnpj_1 pendente; bloco brigadistas pendente fixo
        expect(res.body.data.pendencies).toEqual([
            expect.objectContaining({ kind: 'field', key: 'cnpj_1' }),
            expect.objectContaining({ kind: 'list', key: 'brigadistas' }),
        ]);
        expect(res.body.data.stats).toEqual({ fieldsFilled: 1, fieldsTotal: 2 });
    });
});

describe('PUT /api/paec/plants/:id', () => {
    it('200 em save com version', async () => {
        paecPlantRepository.saveFull.mockResolvedValueOnce({ plant: samplePlant({ version: 2 }) });
        const res = await request(app)
            .put('/api/paec/plants/PAEC-1')
            .set('Authorization', 'Bearer t')
            .send({
                data: {
                    name: 'PCH Anta',
                    version: 1,
                    plantType: 'PCH',
                    installedCapacityMw: 12.5,
                    fields: { usina: 'PCH Anta' },
                },
            });
        expect(res.status).toBe(200);
        expect(res.body.data.version).toBe(2);
        expect(paecPlantRepository.saveFull).toHaveBeenCalledWith(
            'PAEC-1',
            expect.objectContaining({
                updatedBy: 'ana@empresa.com',
                fields: { usina: 'PCH Anta' },
                plantType: 'PCH',
                installedCapacityMw: 12.5,
            }),
            1,
        );
    });

    it('409 VERSION_CONFLICT com currentVersion', async () => {
        paecPlantRepository.saveFull.mockResolvedValueOnce({ conflict: true, currentVersion: 4 });
        const res = await request(app)
            .put('/api/paec/plants/PAEC-1')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: 'PCH Anta', version: 2 } });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VERSION_CONFLICT');
        expect(res.body.currentVersion).toBe(4);
    });

    it('400 sem nome', async () => {
        const res = await request(app)
            .put('/api/paec/plants/PAEC-1')
            .set('Authorization', 'Bearer t')
            .send({ data: { name: '', version: 1 } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('POST /api/paec/plants/:id/generate', () => {
    it('202 enfileirando job paec_report com ids no payload', async () => {
        paecPlantRepository.getFull.mockResolvedValueOnce(samplePlant());
        paecTemplateRepository.getById.mockResolvedValueOnce(sampleTemplate());
        reportJobRepository.save.mockImplementationOnce(async (job) => ({ ...job }));

        const res = await request(app)
            .post('/api/paec/plants/PAEC-1/generate')
            .set('Authorization', 'Bearer t');

        expect(res.status).toBe(202);
        const savedArg = reportJobRepository.save.mock.calls[0][0];
        expect(savedArg).toEqual(expect.objectContaining({
            kind: 'paec_report',
            paecPlantId: 'PAEC-1',
            paecTemplateId: 'PAECT-1',
            statusExecucao: 'queued',
            ownerUserId: 'owner-1',
        }));
        // A coluna report_jobs.template_id tem FK para report_templates —
        // o id do template PAEC NAO pode ir nela.
        expect(savedArg.templateId).toBeUndefined();
        expect(savedArg.id).toMatch(/^JOB-/);
        expect(res.body.data._links.plant.href).toContain('paec/plants/PAEC-1');
        expect(triggerWorkerRun).toHaveBeenCalled();
    });

    it('422 TEMPLATE_UNAVAILABLE sem docx tokenizado', async () => {
        paecPlantRepository.getFull.mockResolvedValueOnce(samplePlant());
        paecTemplateRepository.getById.mockResolvedValueOnce(sampleTemplate({ tokenizedDocxMediaId: '' }));
        const res = await request(app)
            .post('/api/paec/plants/PAEC-1/generate')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('TEMPLATE_UNAVAILABLE');
        expect(reportJobRepository.save).not.toHaveBeenCalled();
    });

    it('404 quando a ficha nao existe', async () => {
        paecPlantRepository.getFull.mockResolvedValueOnce(null);
        const res = await request(app)
            .post('/api/paec/plants/PAEC-x/generate')
            .set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/paec/plants/:id', () => {
    it('204 sem body', async () => {
        const res = await request(app).delete('/api/paec/plants/PAEC-1').set('Authorization', 'Bearer t');
        expect(res.status).toBe(204);
        expect(paecPlantRepository.remove).toHaveBeenCalledWith('PAEC-1');
    });
});
