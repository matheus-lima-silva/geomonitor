const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Jobs API Integration Tests (Mocked DB)', () => {
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

    it('marca job como falha', async () => {
        const { reportJobRepository } = require('../repositories');
        const saved = await reportJobRepository.save({
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
