const request = require('supertest');
const app = require('../server'); // Express app

describe('Projects API Integration Tests (Mocked DB)', () => {

    it('GET /api/projects deve retornar HTTP 200', async () => {
        const response = await request(app)
            .get('/api/projects')
            // Assuming our Mock Auth Middleware passes anything with Authorization header
            .set('Authorization', 'Bearer fake-token-for-test');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('POST /api/projects deve retornar HTTP 201 com HATEOAS Links', async () => {
        const testProject = {
            id: 'PRJ-TEST',
            nome: 'Empreendimento de Teste'
        };

        const response = await request(app)
            .post('/api/projects')
            .set('Authorization', 'Bearer fake-token-for-test')
            .send({ data: testProject });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');

        // Assert HATEOAS Structure
        const createdData = response.body.data;
        expect(createdData.id).toBe('PRJ-TEST');
        expect(createdData._links).toBeDefined();

        // Assert self link
        expect(createdData._links.self.method).toBe('GET');
        expect(createdData._links.self.href).toContain('/api/projects/PRJ-TEST');

        // Assert update link
        expect(createdData._links.update.method).toBe('PUT');
    });

    it('POST /api/projects sem ID de dados deve dar erro 400', async () => {
        const response = await request(app)
            .post('/api/projects')
            .set('Authorization', 'Bearer fake-token-for-test')
            .send({ data: { nome: 'Sem ID' } }); // Falhando propositalmente

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
        expect(response.body.message).toMatch(/ID e dados/i);
    });
});
