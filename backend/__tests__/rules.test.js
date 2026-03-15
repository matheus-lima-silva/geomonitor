const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Rules API Integration Tests (Mocked DB)', () => {
    it('GET /api/rules retorna null quando configuração não existe', async () => {
        const response = await request(app)
            .get('/api/rules')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeNull();
    });

    it('PUT /api/rules salva configuração e GET retorna payload singleton HATEOAS', async () => {
        const putResponse = await request(app)
            .put('/api/rules')
            .set(AUTH_HEADER)
            .send({
                data: {
                    criticidade: { faixas: [1, 2, 3] },
                },
                meta: {
                    updatedBy: 'ops@empresa.com',
                },
            });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body.status).toBe('success');
        expect(putResponse.body.data.criticidade).toEqual({ faixas: [1, 2, 3] });
        expect(putResponse.body.data._links.self.href).toContain('/api/rules');
        expect(putResponse.body.data.updatedBy).toBe('ops@empresa.com');

        const getResponse = await request(app)
            .get('/api/rules')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.criticidade).toEqual({ faixas: [1, 2, 3] });
        expect(getResponse.body.data._links.update.method).toBe('PUT');
    });
});