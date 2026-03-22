const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Compounds API Integration Tests (Mocked DB)', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({ data: { id: 'RW-C1', nome: 'Workspace A', projectId: 'PRJ-01' } });
    });

    it('cria composto, adiciona workspace, roda preflight e enfileira geracao', async () => {
        const createResponse = await request(app)
            .post('/api/report-compounds')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Composto principal',
                },
            });

        expect(createResponse.status).toBe(201);
        const compoundId = createResponse.body.data.id;

        const addWorkspaceResponse = await request(app)
            .post(`/api/report-compounds/${compoundId}/add-workspace`)
            .set(AUTH_HEADER)
            .send({ data: { workspaceId: 'RW-C1' } });

        expect(addWorkspaceResponse.status).toBe(200);
        expect(addWorkspaceResponse.body.data.workspaceIds).toContain('RW-C1');

        const preflightResponse = await request(app)
            .post(`/api/report-compounds/${compoundId}/preflight`)
            .set(AUTH_HEADER);

        expect(preflightResponse.status).toBe(200);
        expect(preflightResponse.body.data.workspaceCount).toBe(1);
        expect(preflightResponse.body.data.canGenerate).toBe(true);

        const generateResponse = await request(app)
            .post(`/api/report-compounds/${compoundId}/generate`)
            .set(AUTH_HEADER);

        expect(generateResponse.status).toBe(202);
        expect(generateResponse.body.data.status).toBe('queued');
        expect(generateResponse.body.data._links.generate.href).toContain(`/api/report-compounds/${compoundId}/generate`);
    });
});
