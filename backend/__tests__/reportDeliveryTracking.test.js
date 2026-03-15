const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Delivery Tracking API Integration Tests (Mocked DB)', () => {
    it('POST cria tracking com id derivado e GET lista payload HATEOAS', async () => {
        const postResponse = await request(app)
            .post('/api/report-delivery-tracking')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'P-01',
                    monthKey: '2026-03',
                    operationalStatus: 'Entregue',
                    notes: 'ok',
                },
                meta: {
                    updatedBy: 'ops@empresa.com',
                },
            });

        expect(postResponse.status).toBe(201);
        expect(postResponse.body.status).toBe('success');
        expect(postResponse.body.data.id).toBe('P-01__2026-03');
        expect(postResponse.body.data._links.self.href).toContain('/api/report-delivery-tracking/P-01__2026-03');

        const getResponse = await request(app)
            .get('/api/report-delivery-tracking/P-01__2026-03')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.projectId).toBe('P-01');
        expect(getResponse.body.data.monthKey).toBe('2026-03');
        expect(getResponse.body.data.updatedBy).toBe('ops@empresa.com');
    });

    it('POST sem projectId/monthKey válidos retorna 400', async () => {
        const response = await request(app)
            .post('/api/report-delivery-tracking')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'P-01',
                    monthKey: '03-2026',
                },
            });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
    });
});