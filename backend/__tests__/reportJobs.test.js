const request = require('supertest');
const app = require('../server');

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
