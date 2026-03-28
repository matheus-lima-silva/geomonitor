const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Templates API Integration Tests (Mocked DB)', () => {
    it('cria template, lista, busca por id, atualiza e remove', async () => {
        const createResponse = await request(app)
            .post('/api/report-templates')
            .set(AUTH_HEADER)
            .send({
                data: {
                    versionLabel: 'v1.0',
                    sourceKind: 'docx_base',
                    notes: 'Template base inicial',
                },
            });

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.data.versionLabel).toBe('v1.0');
        expect(createResponse.body.data.sourceKind).toBe('docx_base');
        expect(createResponse.body.data.isActive).toBe(false);
        expect(createResponse.body.data._links.activate).toBeDefined();

        const templateId = createResponse.body.data.id;

        const listResponse = await request(app)
            .get('/api/report-templates')
            .set(AUTH_HEADER);

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data.length).toBeGreaterThanOrEqual(1);

        const getResponse = await request(app)
            .get(`/api/report-templates/${templateId}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.id).toBe(templateId);
        expect(getResponse.body.data.versionLabel).toBe('v1.0');

        const updateResponse = await request(app)
            .put(`/api/report-templates/${templateId}`)
            .set(AUTH_HEADER)
            .send({
                data: {
                    versionLabel: 'v1.1',
                    notes: 'Atualizado',
                },
            });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.data.versionLabel).toBe('v1.1');
        expect(updateResponse.body.data.notes).toBe('Atualizado');

        const deleteResponse = await request(app)
            .delete(`/api/report-templates/${templateId}`)
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);

        const getAfterDelete = await request(app)
            .get(`/api/report-templates/${templateId}`)
            .set(AUTH_HEADER);

        expect(getAfterDelete.status).toBe(404);
    });

    it('ativa template e desativa outros do mesmo sourceKind', async () => {
        const tpl1 = await request(app)
            .post('/api/report-templates')
            .set(AUTH_HEADER)
            .send({
                data: { id: 'TPL-ACT-1', versionLabel: 'v1', sourceKind: 'docx_base' },
            });

        expect(tpl1.status).toBe(201);

        const tpl2 = await request(app)
            .post('/api/report-templates')
            .set(AUTH_HEADER)
            .send({
                data: { id: 'TPL-ACT-2', versionLabel: 'v2', sourceKind: 'docx_base' },
            });

        expect(tpl2.status).toBe(201);

        const activateResponse = await request(app)
            .post('/api/report-templates/TPL-ACT-1/activate')
            .set(AUTH_HEADER);

        expect(activateResponse.status).toBe(200);
        expect(activateResponse.body.data.isActive).toBe(true);

        const activate2Response = await request(app)
            .post('/api/report-templates/TPL-ACT-2/activate')
            .set(AUTH_HEADER);

        expect(activate2Response.status).toBe(200);
        expect(activate2Response.body.data.isActive).toBe(true);

        const tpl1After = await request(app)
            .get('/api/report-templates/TPL-ACT-1')
            .set(AUTH_HEADER);

        expect(tpl1After.body.data.isActive).toBe(false);
    });

    it('retorna 404 ao buscar template inexistente', async () => {
        const response = await request(app)
            .get('/api/report-templates/INEXISTENTE')
            .set(AUTH_HEADER);

        expect(response.status).toBe(404);
    });

    it('retorna 404 ao ativar template inexistente', async () => {
        const response = await request(app)
            .post('/api/report-templates/INEXISTENTE/activate')
            .set(AUTH_HEADER);

        expect(response.status).toBe(404);
    });

    it('retorna 404 ao deletar template inexistente', async () => {
        const response = await request(app)
            .delete('/api/report-templates/INEXISTENTE')
            .set(AUTH_HEADER);

        expect(response.status).toBe(404);
    });
});
