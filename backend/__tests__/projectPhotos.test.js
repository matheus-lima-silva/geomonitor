const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Project Photos API Integration Tests (Mocked DB)', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-10',
                    nome: 'Workspace teste',
                    projectId: 'PRJ-01',
                },
            });

        await request(app)
            .put('/api/report-workspaces/RW-10/photos/RPH-1')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'PRJ-01',
                    mediaAssetId: 'MED-1',
                    towerId: 'T-01',
                    includeInReport: true,
                    caption: 'Foto principal',
                    captureAt: '2026-03-21T10:00:00.000Z',
                    importSource: 'structured_folders',
                },
            });

        await request(app)
            .put('/api/report-workspaces/RW-10/photos/RPH-2')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'PRJ-01',
                    mediaAssetId: 'MED-2',
                    towerId: 'T-02',
                    includeInReport: false,
                    caption: 'Vista geral',
                    captureAt: '2026-03-18T10:00:00.000Z',
                    importSource: 'loose_photos',
                },
            });
    });

    it('GET /api/projects/:id/photos lista fotos agregadas do empreendimento com HATEOAS', async () => {
        const response = await request(app)
            .get('/api/projects/PRJ-01/photos')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0]).toEqual(expect.objectContaining({
            projectId: 'PRJ-01',
            towerId: 'T-01',
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining('/api/projects/PRJ-01/photos/RPH-1') }),
                workspace: expect.objectContaining({ href: expect.stringContaining('/api/report-workspaces/RW-10') }),
            }),
        }));
    });

    it('GET /api/projects/:id/photos aplica filtros por workspace, torre, legenda e data', async () => {
        const response = await request(app)
            .get('/api/projects/PRJ-01/photos')
            .query({
                workspaceId: 'RW-10',
                towerId: 'T-01',
                captionQuery: 'principal',
                dateFrom: '2026-03-20',
                dateTo: '2026-03-21',
            })
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(expect.objectContaining({
            id: 'RPH-1',
            caption: 'Foto principal',
            towerId: 'T-01',
        }));
    });

    it('POST /api/projects/:id/photos/export cria exportacao efemera e GET consulta status', async () => {
        const createResponse = await request(app)
            .post('/api/projects/PRJ-01/photos/export')
            .set(AUTH_HEADER)
            .send({
                data: {
                    folderMode: 'tower',
                    filters: {
                        workspaceId: 'RW-10',
                        towerId: 'T-01',
                        captionQuery: 'principal',
                        dateFrom: '2026-03-20',
                        dateTo: '2026-03-21',
                    },
                },
            });

        expect(createResponse.status).toBe(202);
        const token = createResponse.body.data.token;
        expect(createResponse.body.data.itemCount).toBe(1);

        const getResponse = await request(app)
            .get(`/api/projects/PRJ-01/photos/exports/${token}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data).toEqual(expect.objectContaining({
            projectId: 'PRJ-01',
            statusExecucao: 'queued',
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining(`/api/projects/PRJ-01/photos/exports/${token}`) }),
            }),
        }));
    });
});
