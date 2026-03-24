const request = require('supertest');
const app = require('../server');

jest.mock('../utils/kmzProcessor', () => ({
    processKmzImport: jest.fn(),
}));

const { processKmzImport } = require('../utils/kmzProcessor');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Report Workspaces API Integration Tests (Mocked DB)', () => {
    it('importa um workspace e registra metadata do lote', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-IMPORT-1',
                    nome: 'Workspace Importacao',
                    projectId: 'PRJ-01',
                },
            });

        const response = await request(app)
            .post('/api/report-workspaces/RW-IMPORT-1/import')
            .set(AUTH_HEADER)
            .send({
                data: {
                    sourceType: 'organized_kmz',
                    warnings: ['Legenda ausente em 1 item.'],
                    summaryJson: {
                        importedPhotos: 3,
                    },
                },
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.objectContaining({
            id: 'RW-IMPORT-1',
            importedAt: expect.any(String),
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining('/api/report-workspaces/RW-IMPORT-1') }),
            }),
        }));
    });

    it('cria solicitacao de KMZ efemero, acompanha o job e expone o download final', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-KMZ-1',
                    nome: 'Workspace KMZ',
                    projectId: 'PRJ-02',
                },
            });

        const createResponse = await request(app)
            .post('/api/report-workspaces/RW-KMZ-1/kmz')
            .set(AUTH_HEADER)
            .send({});

        expect(createResponse.status).toBe(202);
        expect(createResponse.body.data).toEqual(expect.objectContaining({
            workspaceId: 'RW-KMZ-1',
            statusExecucao: 'queued',
            token: expect.any(String),
            lastJobId: expect.any(String),
        }));

        const token = createResponse.body.data.token;
        const jobId = createResponse.body.data.lastJobId;

        const claimResponse = await request(app)
            .post('/api/report-jobs/claim')
            .set(AUTH_HEADER);

        expect(claimResponse.status).toBe(200);
        expect(claimResponse.body.data.id).toBe(jobId);
        expect(claimResponse.body.data.kind).toBe('workspace_kmz');

        const getResponse = await request(app)
            .get(`/api/report-workspaces/RW-KMZ-1/kmz/${token}`)
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data).toEqual(expect.objectContaining({
            workspaceId: 'RW-KMZ-1',
            token,
            statusExecucao: 'processing',
            _links: expect.objectContaining({
                self: expect.objectContaining({ href: expect.stringContaining(`/api/report-workspaces/RW-KMZ-1/kmz/${token}`) }),
                job: expect.objectContaining({ href: expect.stringContaining(`/api/report-jobs/${jobId}`) }),
            }),
        }));

        const completeResponse = await request(app)
            .put(`/api/report-jobs/${jobId}/complete`)
            .set(AUTH_HEADER)
            .send({ data: { outputKmzMediaId: 'MEDIA-KMZ-1' } });

        expect(completeResponse.status).toBe(200);

        const readyResponse = await request(app)
            .get(`/api/report-workspaces/RW-KMZ-1/kmz/${token}`)
            .set(AUTH_HEADER);

        expect(readyResponse.status).toBe(200);
        expect(readyResponse.body.data).toEqual(expect.objectContaining({
            workspaceId: 'RW-KMZ-1',
            token,
            statusExecucao: 'completed',
            outputKmzMediaId: 'MEDIA-KMZ-1',
            _links: expect.objectContaining({
                download: expect.objectContaining({ href: expect.stringContaining('/api/media/MEDIA-KMZ-1/access-url') }),
            }),
        }));
    });

    it('processa KMZ organizado e retorna sumario de importacao', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-KMZ-PROC-1',
                    nome: 'Workspace KMZ Process',
                    projectId: 'PRJ-03',
                },
            });

        await request(app)
            .post('/api/media/upload-url')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'MA-KMZ-PROC-1',
                    fileName: 'test.kmz',
                    contentType: 'application/vnd.google-earth.kmz',
                    sizeBytes: 1024,
                    purpose: 'workspace-import',
                },
            });

        processKmzImport.mockResolvedValue({
            photosCreated: 5,
            photosSkipped: 1,
            towersInferred: 4,
            pendingLinkage: 1,
            placemarkCount: 10,
            warnings: ['1 Placemark(s) ignorado(s) por tipo de geometria ou coordenadas invalidas.'],
            photoIds: ['RPH-1', 'RPH-2', 'RPH-3', 'RPH-4', 'RPH-5'],
        });

        const response = await request(app)
            .post('/api/report-workspaces/RW-KMZ-PROC-1/kmz/process')
            .set(AUTH_HEADER)
            .send({
                data: { mediaAssetId: 'MA-KMZ-PROC-1' },
                meta: { updatedBy: 'test@user.com' },
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.summary).toEqual(expect.objectContaining({
            photosCreated: 5,
            photosSkipped: 1,
            towersInferred: 4,
            pendingLinkage: 1,
            placemarkCount: 10,
        }));
        expect(response.body.data._links).toEqual(expect.objectContaining({
            self: expect.objectContaining({ method: 'GET' }),
            photos: expect.objectContaining({ method: 'GET' }),
        }));
        expect(processKmzImport).toHaveBeenCalledWith(expect.objectContaining({
            workspaceId: 'RW-KMZ-PROC-1',
            projectId: 'PRJ-03',
        }));
    });

    it('retorna 400 sem mediaAssetId no kmz/process', async () => {
        await request(app)
            .post('/api/report-workspaces')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'RW-KMZ-PROC-2',
                    nome: 'Workspace Validate',
                    projectId: 'PRJ-04',
                },
            });

        const response = await request(app)
            .post('/api/report-workspaces/RW-KMZ-PROC-2/kmz/process')
            .set(AUTH_HEADER)
            .send({ data: {} });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/mediaAssetId/);
    });

    it('retorna 404 para workspace inexistente no kmz/process', async () => {
        const response = await request(app)
            .post('/api/report-workspaces/INEXISTENTE/kmz/process')
            .set(AUTH_HEADER)
            .send({
                data: { mediaAssetId: 'MA-ANY' },
            });

        expect(response.status).toBe(404);
    });
});
