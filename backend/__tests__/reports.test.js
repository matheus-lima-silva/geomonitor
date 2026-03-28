const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Reports API Integration Tests (Mocked DB)', () => {
    it('POST /api/reports/preflight retorna resumo basico dos slots', async () => {
        const response = await request(app)
            .post('/api/reports/preflight')
            .set(AUTH_HEADER)
            .send({
                data: {
                    workspaceId: 'RW-1',
                    slots: [
                        { id: 'A', label: 'A', assetCount: 3 },
                        { id: 'B', label: 'B', assetCount: 0 },
                    ],
                },
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
            expect.objectContaining({
                workspaceId: 'RW-1',
                slotCount: 2,
                readySlotCount: 1,
                canGenerate: true,
            }),
        );
    });

    it('POST /api/reports/generate enfileira relatorio e GET /api/reports/:id retorna metadata', async () => {
        const generateResponse = await request(app)
            .post('/api/reports/generate')
            .set(AUTH_HEADER)
            .send({
                data: {
                    workspaceId: 'RW-1',
                    nome: 'RT Consolidado',
                    slots: [{ id: 'A', assetCount: 2 }],
                },
            });

        expect(generateResponse.status).toBe(202);
        expect(generateResponse.body.data.statusExecucao).toBe('queued');
        const reportId = generateResponse.body.data.id;

        const getResponse = await request(app)
            .get(`/api/reports/${reportId}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data).toEqual(
            expect.objectContaining({
                id: reportId,
                workspaceId: 'RW-1',
                nome: 'RT Consolidado',
            }),
        );
    });
});
