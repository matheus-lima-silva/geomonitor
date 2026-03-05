const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Inspections API Integration Tests (Mocked DB)', () => {
    it('GET /api/inspections returns an empty array initially', async () => {
        const response = await request(app)
            .get('/api/inspections')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual([]);
    });

    it('POST creates inspection with generated id and normalized defaults', async () => {
        const response = await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projetoId: 'P-01',
                    dataInicio: '2026-03-04',
                    detalhesDias: 'invalido',
                },
                meta: {
                    updatedBy: 'fiscal@empresa.com',
                },
            });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.id).toMatch(/^VS-\d+$/);

        const inspectionId = response.body.data.id;
        const getResponse = await request(app)
            .get(`/api/inspections/${inspectionId}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.id).toBe(inspectionId);
        expect(getResponse.body.data.dataFim).toBe('2026-03-04');
        expect(getResponse.body.data.detalhesDias).toEqual([]);
        expect(getResponse.body.data.updatedBy).toBe('fiscal@empresa.com');
    });

    it('PUT /:id updates inspection and keeps id from url', async () => {
        await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'VS-200',
                    projetoId: 'P-02',
                    dataInicio: '2026-03-01',
                },
            });

        const putResponse = await request(app)
            .put('/api/inspections/VS-200')
            .set(AUTH_HEADER)
            .send({
                data: {
                    detalhesDias: [{ data: '2026-03-01' }],
                    dataFim: '2026-03-02',
                },
            });

        expect(putResponse.status).toBe(201);
        expect(putResponse.body.status).toBe('success');
        expect(putResponse.body.data.id).toBe('VS-200');

        const getResponse = await request(app)
            .get('/api/inspections/VS-200')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.id).toBe('VS-200');
        expect(getResponse.body.data.dataFim).toBe('2026-03-02');
        expect(getResponse.body.data.detalhesDias).toEqual([{ data: '2026-03-01' }]);
    });

    it('DELETE /:id removes inspection', async () => {
        await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({ data: { id: 'VS-DEL', projetoId: 'P-03' } });

        const deleteResponse = await request(app)
            .delete('/api/inspections/VS-DEL')
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.status).toBe('success');

        const getResponse = await request(app)
            .get('/api/inspections/VS-DEL')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(404);
        expect(getResponse.body.status).toBe('error');
    });

    it('POST without data returns 400', async () => {
        const response = await request(app)
            .post('/api/inspections')
            .set(AUTH_HEADER)
            .send({ meta: { updatedBy: 'qa@empresa.com' } });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
    });
});

