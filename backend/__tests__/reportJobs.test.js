const request = require('supertest');
const app = require('../server');
const { getDocRef } = require('../utils/firebaseSetup');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };
const WORKER_HEADER = { 'x-worker-token': 'worker-secret' };

describe('Report Jobs API Integration Tests (Mocked DB)', () => {
    beforeEach(() => {
        process.env.WORKER_API_TOKEN = 'worker-secret';
    });

    afterEach(() => {
        delete process.env.WORKER_API_TOKEN;
    });

    it('claim retorna 204 quando nao ha jobs na fila', async () => {
        const response = await request(app)
            .post('/api/report-jobs/claim')
            .set(AUTH_HEADER);

        expect(response.status).toBe(204);
    });

    it('cria job via compound generate, claim retorna o job, complete marca concluido', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-JOB-1', nome: 'WS Job', projectId: 'PRJ-01' } });

        const compoundRes = await request(app)
            .post('/api/report-compounds')
            .set(AUTH_HEADER)
            .send({ data: { nome: 'Composto para job', workspaceIds: ['RW-JOB-1'] } });

        const compoundId = compoundRes.body.data.id;

        const generateRes = await request(app)
            .post(`/api/report-compounds/${compoundId}/generate`)
            .set(AUTH_HEADER);

        expect(generateRes.status).toBe(202);

        const listResponse = await request(app)
            .get('/api/report-jobs')
            .set(AUTH_HEADER);

        expect(listResponse.status).toBe(200);
        const queuedJobs = listResponse.body.data.filter((j) => j.statusExecucao === 'queued');
        expect(queuedJobs.length).toBeGreaterThanOrEqual(1);

        const claimResponse = await request(app)
            .post('/api/report-jobs/claim')
            .set(AUTH_HEADER);

        expect(claimResponse.status).toBe(200);
        expect(claimResponse.body.data.statusExecucao).toBe('processing');
        const jobId = claimResponse.body.data.id;

        const completeResponse = await request(app)
            .put(`/api/report-jobs/${jobId}/complete`)
            .set(AUTH_HEADER)
            .send({ data: { outputDocxMediaId: 'MEDIA-DOCX-1' } });

        expect(completeResponse.status).toBe(200);
        expect(completeResponse.body.data.statusExecucao).toBe('completed');
        expect(completeResponse.body.data.outputDocxMediaId).toBe('MEDIA-DOCX-1');
        expect(completeResponse.body.data._links.complete).toBeDefined();
        expect(completeResponse.body.data._links.fail).toBeDefined();

        const compoundState = await request(app)
            .get(`/api/report-compounds/${compoundId}`)
            .set(AUTH_HEADER);

        expect(compoundState.status).toBe(200);
        expect(compoundState.body.data.status).toBe('completed');
        expect(compoundState.body.data.outputDocxMediaId).toBe('MEDIA-DOCX-1');
    });

    it('permite claim e complete via token interno do worker', async () => {
        const { reportJobRepository } = require('../repositories');
        await reportJobRepository.save({
            id: 'JOB-WORKER-1',
            kind: 'report_compound',
            statusExecucao: 'queued',
        });

        const claimResponse = await request(app)
            .post('/api/report-jobs/claim')
            .set(WORKER_HEADER);

        expect(claimResponse.status).toBe(200);
        expect(claimResponse.body.data.id).toBe('JOB-WORKER-1');
        expect(claimResponse.body.data.statusExecucao).toBe('processing');
        expect(claimResponse.body.data.updatedBy).toBe('geomonitor-worker@internal');

        const completeResponse = await request(app)
            .put('/api/report-jobs/JOB-WORKER-1/complete')
            .set(WORKER_HEADER)
            .send({ data: { outputKmzMediaId: 'MEDIA-KMZ-1' } });

        expect(completeResponse.status).toBe(200);
        expect(completeResponse.body.data.statusExecucao).toBe('completed');
        expect(completeResponse.body.data.outputKmzMediaId).toBe('MEDIA-KMZ-1');
        expect(completeResponse.body.data.updatedBy).toBe('geomonitor-worker@internal');
    });

    it('marca job como falha', async () => {
        const { reportJobRepository } = require('../repositories');
        await reportJobRepository.save({
            id: 'JOB-FAIL-TEST',
            kind: 'test',
            statusExecucao: 'processing',
        });

        const failResponse = await request(app)
            .put('/api/report-jobs/JOB-FAIL-TEST/fail')
            .set(AUTH_HEADER)
            .send({ data: { errorLog: 'Template nao encontrado' } });

        expect(failResponse.status).toBe(200);
        expect(failResponse.body.data.statusExecucao).toBe('failed');
        expect(failResponse.body.data.errorLog).toBe('Template nao encontrado');
    });

    it('monta contexto de project_dossier respeitando scopeJson', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'PRJ-CTX-1', nome: 'Projeto Contexto' } });

        await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send({ data: { id: 'LO-CTX-1', projetoId: 'PRJ-CTX-1', orgao: 'IBAMA' } });

        await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({ data: { id: 'VS-CTX-1', projetoId: 'PRJ-CTX-1', dataInicio: '2026-03-01' } });

        await request(app)
            .post('/api/report-delivery-tracking')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-CTX-1', monthKey: '2026-03', operationalStatus: 'Entregue' } });

        await getDocRef('erosions', 'ERS-CTX-1').set({
            id: 'ERS-CTX-1',
            projectId: 'PRJ-CTX-1',
            status: 'aberta',
        });

        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-CTX-1', nome: 'Workspace Ctx', projectId: 'PRJ-CTX-1' } });

        await request(app)
            .put('/api/report-workspaces/RW-CTX-1/photos/RPH-CTX-1')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-CTX-1', caption: 'Foto contexto', includeInReport: true } });

        const createDossier = await request(app)
            .post('/api/projects/PRJ-CTX-1/dossiers')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Dossie contexto',
                    observacoes: 'Observacao teste',
                    scopeJson: {
                        includeLicencas: true,
                        includeInspecoes: false,
                        includeErosoes: true,
                        includeEntregas: false,
                        includeWorkspaces: true,
                        includeFotos: true,
                    },
                },
            });

        const dossierId = createDossier.body.data.id;

        const generateResponse = await request(app)
            .post(`/api/projects/PRJ-CTX-1/dossiers/${dossierId}/generate`)
            .set(AUTH_HEADER);

        const jobId = generateResponse.body.data.lastJobId;

        const contextResponse = await request(app)
            .get(`/api/report-jobs/${jobId}/context`)
            .set(WORKER_HEADER);

        expect(contextResponse.status).toBe(200);
        expect(contextResponse.body.data.job.kind).toBe('project_dossier');
        expect(contextResponse.body.data.project).toEqual(expect.objectContaining({ id: 'PRJ-CTX-1' }));
        expect(contextResponse.body.data.defaults).toEqual(expect.objectContaining({ projectId: 'PRJ-CTX-1' }));
        expect(contextResponse.body.data.renderModel.dossier).toEqual(expect.objectContaining({
            id: dossierId,
            nome: 'Dossie contexto',
            observacoes: 'Observacao teste',
        }));
        expect(contextResponse.body.data.renderModel.sections.licencas).toHaveLength(1);
        expect(contextResponse.body.data.renderModel.sections.inspecoes).toHaveLength(0);
        expect(contextResponse.body.data.renderModel.sections.erosoes).toHaveLength(1);
        expect(contextResponse.body.data.renderModel.sections.entregas).toHaveLength(0);
        expect(contextResponse.body.data.renderModel.sections.workspaces).toHaveLength(1);
        expect(contextResponse.body.data.renderModel.sections.photos).toHaveLength(1);
    });

    it('monta contexto de report_compound respeitando orderJson e fotos incluidas', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'PRJ-CP-1', nome: 'Projeto A' } });

        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'PRJ-CP-2', nome: 'Projeto B' } });

        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-CP-1', nome: 'Workspace A', projectId: 'PRJ-CP-1' } });

        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-CP-2', nome: 'Workspace B', projectId: 'PRJ-CP-2' } });

        await request(app)
            .put('/api/report-workspaces/RW-CP-1/photos/RPH-CP-1')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-CP-1', caption: 'Incluir', includeInReport: true } });

        await request(app)
            .put('/api/report-workspaces/RW-CP-1/photos/RPH-CP-2')
            .set(AUTH_HEADER)
            .send({ data: { projectId: 'PRJ-CP-1', caption: 'Excluir', includeInReport: false } });

        const compoundCreate = await request(app)
            .post('/api/report-compounds')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Composto contexto',
                    workspaceIds: ['RW-CP-1', 'RW-CP-2'],
                    orderJson: ['RW-CP-2', 'RW-CP-1'],
                    sharedTextsJson: { introducao: 'Introducao global' },
                },
            });

        const compoundId = compoundCreate.body.data.id;

        const generateResponse = await request(app)
            .post(`/api/report-compounds/${compoundId}/generate`)
            .set(AUTH_HEADER);

        const jobId = generateResponse.body.data.lastJobId;

        const contextResponse = await request(app)
            .get(`/api/report-jobs/${jobId}/context`)
            .set(WORKER_HEADER);

        expect(contextResponse.status).toBe(200);
        expect(contextResponse.body.data.job.kind).toBe('report_compound');
        expect(contextResponse.body.data.renderModel.compound).toEqual(expect.objectContaining({
            id: compoundId,
            nome: 'Composto contexto',
            orderJson: ['RW-CP-2', 'RW-CP-1'],
        }));
        expect(contextResponse.body.data.renderModel.workspaces).toHaveLength(2);
        expect(contextResponse.body.data.renderModel.workspaces[0].workspace.id).toBe('RW-CP-2');
        expect(contextResponse.body.data.renderModel.workspaces[1].workspace.id).toBe('RW-CP-1');
        expect(contextResponse.body.data.renderModel.workspaces[1].photos).toHaveLength(1);
        expect(contextResponse.body.data.renderModel.workspaces[1].photos[0].caption).toBe('Incluir');
    });

    it('sincroniza falha do job com o registro pai', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'PRJ-FAIL-1', nome: 'Projeto Falha' } });

        const createDossier = await request(app)
            .post('/api/projects/PRJ-FAIL-1/dossiers')
            .set(AUTH_HEADER)
            .send({ data: { nome: 'Dossie falha' } });

        const dossierId = createDossier.body.data.id;

        const generateResponse = await request(app)
            .post(`/api/projects/PRJ-FAIL-1/dossiers/${dossierId}/generate`)
            .set(AUTH_HEADER);

        const jobId = generateResponse.body.data.lastJobId;

        const failResponse = await request(app)
            .put(`/api/report-jobs/${jobId}/fail`)
            .set(WORKER_HEADER)
            .send({ data: { errorLog: 'Falha de renderizacao' } });

        expect(failResponse.status).toBe(200);

        const dossierState = await request(app)
            .get(`/api/projects/PRJ-FAIL-1/dossiers/${dossierId}`)
            .set(AUTH_HEADER);

        expect(dossierState.status).toBe(200);
        expect(dossierState.body.data.status).toBe('failed');
        expect(dossierState.body.data.lastError).toBe('Falha de renderizacao');
    });

    it('monta contexto de workspace_kmz e sincroniza o status da solicitacao', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'PRJ-KMZ-CTX',
                    nome: 'Projeto KMZ',
                    torresCoordenadas: [{ numero: '1', latitude: -22.1, longitude: -43.1 }],
                },
            });

        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-KMZ-CTX', nome: 'Workspace KMZ', projectId: 'PRJ-KMZ-CTX' } });

        await request(app)
            .put('/api/report-workspaces/RW-KMZ-CTX/photos/RPH-KMZ-CTX-1')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'PRJ-KMZ-CTX',
                    caption: 'Foto KMZ',
                    towerId: '1',
                    gpsLat: -22.11,
                    gpsLon: -43.11,
                    mediaAssetId: 'MED-KMZ-CTX-1',
                    includeInReport: true,
                },
            });

        const createResponse = await request(app)
            .post('/api/report-workspaces/RW-KMZ-CTX/kmz')
            .set(AUTH_HEADER)
            .send({});

        const jobId = createResponse.body.data.lastJobId;
        const token = createResponse.body.data.token;

        const contextResponse = await request(app)
            .get(`/api/report-jobs/${jobId}/context`)
            .set(WORKER_HEADER);

        expect(contextResponse.status).toBe(200);
        expect(contextResponse.body.data.job.kind).toBe('workspace_kmz');
        expect(contextResponse.body.data.project).toEqual(expect.objectContaining({ id: 'PRJ-KMZ-CTX' }));
        expect(contextResponse.body.data.renderModel.workspace).toEqual(expect.objectContaining({
            id: 'RW-KMZ-CTX',
            projectId: 'PRJ-KMZ-CTX',
        }));
        expect(contextResponse.body.data.renderModel.workspaceKmz).toEqual(expect.objectContaining({
            token,
            workspaceId: 'RW-KMZ-CTX',
        }));
        expect(contextResponse.body.data.renderModel.photos).toEqual([
            expect.objectContaining({
                id: 'RPH-KMZ-CTX-1',
                mediaAssetId: 'MED-KMZ-CTX-1',
                towerId: '1',
            }),
        ]);

        const claimResponse = await request(app)
            .post('/api/report-jobs/claim')
            .set(WORKER_HEADER);

        expect(claimResponse.status).toBe(200);
        expect(claimResponse.body.data.id).toBe(jobId);

        const processingRequest = await request(app)
            .get(`/api/report-workspaces/RW-KMZ-CTX/kmz/${token}`)
            .set(AUTH_HEADER);

        expect(processingRequest.status).toBe(200);
        expect(processingRequest.body.data.statusExecucao).toBe('processing');

        const completeResponse = await request(app)
            .put(`/api/report-jobs/${jobId}/complete`)
            .set(WORKER_HEADER)
            .send({ data: { outputKmzMediaId: 'MED-KMZ-OUT-1' } });

        expect(completeResponse.status).toBe(200);

        const completedRequest = await request(app)
            .get(`/api/report-workspaces/RW-KMZ-CTX/kmz/${token}`)
            .set(AUTH_HEADER);

        expect(completedRequest.status).toBe(200);
        expect(completedRequest.body.data.outputKmzMediaId).toBe('MED-KMZ-OUT-1');
        expect(completedRequest.body.data.statusExecucao).toBe('completed');
    });

    it('rejeita token interno invalido do worker', async () => {
        const response = await request(app)
            .post('/api/report-jobs/claim')
            .set({ 'x-worker-token': 'wrong-secret' });

        expect(response.status).toBe(403);
    });

    it('retorna 404 ao buscar job inexistente', async () => {
        const response = await request(app)
            .get('/api/report-jobs/INEXISTENTE')
            .set(AUTH_HEADER);

        expect(response.status).toBe(404);
    });

    it('retorna 404 ao completar job inexistente', async () => {
        const response = await request(app)
            .put('/api/report-jobs/INEXISTENTE/complete')
            .set(AUTH_HEADER)
            .send({ data: {} });

        expect(response.status).toBe(404);
    });
});
