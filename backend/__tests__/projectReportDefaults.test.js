const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Project Report Defaults API Integration Tests (Mocked DB)', () => {
    it('GET /api/projects/:id/report-defaults retorna defaults e PUT persiste HATEOAS', async () => {
        const getResponse = await request(app)
            .get('/api/projects/PRJ-01/report-defaults')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data).toEqual(expect.objectContaining({
            projectId: 'PRJ-01',
            faixaBufferMetersSide: 200,
            towerSuggestionRadiusMeters: 300,
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining('/api/projects/PRJ-01/report-defaults') }),
                update: expect.objectContaining({ method: 'PUT' }),
            }),
        }));

        const putResponse = await request(app)
            .put('/api/projects/PRJ-01/report-defaults')
            .set(AUTH_HEADER)
            .send({
                data: {
                    faixaBufferMetersSide: 240,
                    towerSuggestionRadiusMeters: 450,
                },
            });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body.data.faixaBufferMetersSide).toBe(240);
        expect(putResponse.body.data.towerSuggestionRadiusMeters).toBe(450);
    });
});
