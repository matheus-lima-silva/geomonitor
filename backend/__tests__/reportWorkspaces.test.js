const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Workspaces API Integration Tests (Mocked DB)', () => {
    it('importa um workspace e registra metadata do lote', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-IMPORT-1',
                    nome: 'Workspace Importacao',
                    projectId: 'PRJ-01',
                },
            });

        const response = await request(app)
            .post('/api/report-workspaces/RW-IMPORT-1/import')
            .set(AUTH_HEADER)
            .send({
                data: {
                    sourceType: 'organized_kmz',
                    warnings: ['Legenda ausente em 1 item.'],
                    summaryJson: {
                        importedPhotos: 3,
                    },
                },
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.objectContaining({
            id: 'RW-IMPORT-1',
            importedAt: expect.any(String),
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining('/api/report-workspaces/RW-IMPORT-1') }),
            }),
        }));
    });

    it('cria solicitacao de KMZ efemero e consulta o status pelo token', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-KMZ-1',
                    nome: 'Workspace KMZ',
                    projectId: 'PRJ-02',
                },
            });

        const createResponse = await request(app)
            .post('/api/report-workspaces/RW-KMZ-1/kmz')
            .set(AUTH_HEADER)
            .send({});

        expect(createResponse.status).toBe(202);
        expect(createResponse.body.data).toEqual(expect.objectContaining({
            workspaceId: 'RW-KMZ-1',
            statusExecucao: 'queued',
            token: expect.any(String),
        }));

        const token = createResponse.body.data.token;
        const getResponse = await request(app)
            .get(`/api/report-workspaces/RW-KMZ-1/kmz/${token}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data).toEqual(expect.objectContaining({
            workspaceId: 'RW-KMZ-1',
            token,
            statusExecucao: 'queued',
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining(`/api/report-workspaces/RW-KMZ-1/kmz/${token}`) }),
            }),
        }));
    });
});
