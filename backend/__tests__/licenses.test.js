const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Licenses API Integration Tests (Mocked DB)', () => {
    it('GET /api/licenses returns an empty array initially', async () => {
        const response = await request(app)
            .get('/api/licenses')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual([]);
    });

    it('POST creates license and GET /:id returns persisted data', async () => {
        const payload = {
            data: {
                id: 'LO-2026-01',
                projetoId: 'P-01',
                orgao: 'IBAMA',
            },
            meta: {
                updatedBy: 'ambiental@empresa.com',
            },
        };

        const postResponse = await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send(payload);

        expect(postResponse.status).toBe(201);
        expect(postResponse.body.status).toBe('success');
        expect(postResponse.body.data.id).toBe('LO-2026-01');

        const getResponse = await request(app)
            .get('/api/licenses/LO-2026-01')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.status).toBe('success');
        expect(getResponse.body.data.id).toBe('LO-2026-01');
        expect(getResponse.body.data.orgao).toBe('IBAMA');
        expect(getResponse.body.data.updatedBy).toBe('ambiental@empresa.com');
    });

    it('PUT /:id updates existing license', async () => {
        await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send({ data: { id: 'LO-11', orgao: 'INEA' } });

        const putResponse = await request(app)
            .put('/api/licenses/LO-11')
            .set(AUTH_HEADER)
            .send({ data: { validade: '2027-12-31' } });

        expect(putResponse.status).toBe(201);
        expect(putResponse.body.status).toBe('success');
        expect(putResponse.body.data.id).toBe('LO-11');

        const getResponse = await request(app)
            .get('/api/licenses/LO-11')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.validade).toBe('2027-12-31');
    });

    it('DELETE /:id removes license', async () => {
        await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send({ data: { id: 'LO-DEL', orgao: 'ANP' } });

        const deleteResponse = await request(app)
            .delete('/api/licenses/LO-DEL')
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.status).toBe('success');

        const getResponse = await request(app)
            .get('/api/licenses/LO-DEL')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(404);
        expect(getResponse.body.status).toBe('error');
    });

    it('POST without id returns 400', async () => {
        const response = await request(app)
            .post('/api/licenses')
            .set(AUTH_HEADER)
            .send({ data: { projetoId: 'P-100' } });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
    });
});

