const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

function binaryParser(res, callback) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function uploadTestMedia({ fileName, content, linkedResourceId }) {
    const uploadResponse = await request(app)
        .post('/api/media/upload-url')
        .set(AUTH_HEADER)
        .send({
            data: {
                fileName,
                contentType: 'image/jpeg',
                sizeBytes: Buffer.byteLength(content),
                purpose: 'workspace-photo',
                linkedResourceType: 'reportWorkspaces',
                linkedResourceId,
            },
        });

    const mediaId = uploadResponse.body.data.id;

    await request(app)
        .put(`/api/media/${mediaId}/upload`)
        .set(AUTH_HEADER)
        .set('Content-Type', 'image/jpeg')
        .send(Buffer.from(content));

    return mediaId;
}

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

        const mediaId1 = await uploadTestMedia({
            fileName: 'foto-principal.jpg',
            content: 'conteudo-foto-principal',
            linkedResourceId: 'RW-10',
        });
        const mediaId2 = await uploadTestMedia({
            fileName: 'vista-geral.jpg',
            content: 'conteudo-vista-geral',
            linkedResourceId: 'RW-10',
        });

        await request(app)
            .put('/api/report-workspaces/RW-10/photos/RPH-1')
            .set(AUTH_HEADER)
            .send({
                data: {
                    projectId: 'PRJ-01',
                    mediaAssetId: mediaId1,
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
                    mediaAssetId: mediaId2,
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

    it('GET /api/projects/:id/photos/exports/:token?download=1 devolve ZIP efemero real', async () => {
        const createResponse = await request(app)
            .post('/api/projects/PRJ-01/photos/export')
            .set(AUTH_HEADER)
            .send({
                data: {
                    folderMode: 'tower',
                    filters: {
                        workspaceId: 'RW-10',
                    },
                },
            });

        const token = createResponse.body.data.token;

        const downloadResponse = await request(app)
            .get(`/api/projects/PRJ-01/photos/exports/${token}`)
            .query({ download: '1' })
            .buffer(true)
            .parse(binaryParser)
            .set(AUTH_HEADER);

        expect(downloadResponse.status).toBe(200);
        expect(downloadResponse.headers['content-type']).toContain('application/zip');
        expect(downloadResponse.headers['content-disposition']).toContain('.zip');
        expect(Buffer.isBuffer(downloadResponse.body)).toBe(true);
        expect(downloadResponse.body.subarray(0, 4).toString('hex')).toBe('504b0304');
        expect(downloadResponse.body.toString('utf8')).toContain('T-01/RPH-1-foto-principal.jpg');
        expect(downloadResponse.body.toString('utf8')).toContain('T-02/RPH-2-vista-geral.jpg');

        const statusResponse = await request(app)
            .get(`/api/projects/PRJ-01/photos/exports/${token}`)
            .set(AUTH_HEADER);

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.body.data.statusExecucao).toBe('ready');
        expect(statusResponse.body.data.outputMediaAssetId).toEqual(expect.stringMatching(/^MED-/));
        expect(statusResponse.body.data.downloadFileName).toContain('.zip');

        const secondDownloadResponse = await request(app)
            .get(`/api/projects/PRJ-01/photos/exports/${token}`)
            .query({ download: '1' })
            .buffer(true)
            .parse(binaryParser)
            .set(AUTH_HEADER);

        expect(secondDownloadResponse.status).toBe(200);
        expect(secondDownloadResponse.headers['content-disposition']).toContain(statusResponse.body.data.downloadFileName);
        expect(secondDownloadResponse.body.subarray(0, 4).toString('hex')).toBe('504b0304');
    });
});
