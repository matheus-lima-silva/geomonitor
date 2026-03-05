const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Projects API Integration Tests (Mocked DB)', () => {
    it('requires bearer token for protected endpoint', async () => {
        const response = await request(app).get('/api/projects');
        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
    });

    it('GET /api/projects returns an empty array initially', async () => {
        const response = await request(app)
            .get('/api/projects')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual([]);
    });

    it('POST creates project and GET /:id returns HATEOAS payload', async () => {
        const createPayload = {
            data: {
                id: ' prj-test ',
                nome: 'Empreendimento Teste',
                tipo: 'Linha de Transmissao',
            },
            meta: {
                updatedBy: 'qa@empresa.com',
            },
        };

        const postResponse = await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send(createPayload);

        expect(postResponse.status).toBe(201);
        expect(postResponse.body.status).toBe('success');
        expect(postResponse.body.data.id).toBe('PRJ-TEST');
        expect(postResponse.body.data._links).toBeDefined();
        expect(postResponse.body.data._links.self.href).toContain('/api/projects/PRJ-TEST');

        const getResponse = await request(app)
            .get('/api/projects/PRJ-TEST')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.status).toBe('success');
        expect(getResponse.body.data.id).toBe('PRJ-TEST');
        expect(getResponse.body.data.nome).toBe('Empreendimento Teste');
        expect(getResponse.body.data.updatedBy).toBe('qa@empresa.com');
    });

    it('PUT /:id reuses save logic and merges data', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'P-10', nome: 'Original' } });

        const putResponse = await request(app)
            .put('/api/projects/P-10')
            .set(AUTH_HEADER)
            .send({ data: { nome: 'Atualizado' } });

        expect(putResponse.status).toBe(201);
        expect(putResponse.body.status).toBe('success');
        expect(putResponse.body.data.id).toBe('P-10');

        const getResponse = await request(app)
            .get('/api/projects/P-10')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.id).toBe('P-10');
        expect(getResponse.body.data.nome).toBe('Atualizado');
    });

    it('DELETE /:id removes project and next GET returns 404', async () => {
        await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { id: 'P-DEL', nome: 'Projeto para exclusao' } });

        const deleteResponse = await request(app)
            .delete('/api/projects/P-DEL')
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.status).toBe('success');

        const getResponse = await request(app)
            .get('/api/projects/P-DEL')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(404);
        expect(getResponse.body.status).toBe('error');
    });

    it('POST /api/projects without id returns 400', async () => {
        const response = await request(app)
            .post('/api/projects')
            .set(AUTH_HEADER)
            .send({ data: { nome: 'Sem ID' } });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
    });
});

