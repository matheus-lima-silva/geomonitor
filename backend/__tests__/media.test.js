const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };
const WORKER_HEADER = { 'x-worker-token': 'worker-secret' };

function binaryParser(res, callback) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Media API Integration Tests (Mocked DB)', () => {
    let mediaRoot;

    beforeEach(async () => {
        mediaRoot = path.join(os.tmpdir(), `geomonitor-media-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        process.env.MEDIA_STORAGE_ROOT = mediaRoot;
        process.env.WORKER_API_TOKEN = 'worker-secret';
    });

    afterEach(async () => {
        delete process.env.MEDIA_STORAGE_ROOT;
        delete process.env.WORKER_API_TOKEN;
        await fs.rm(mediaRoot, { recursive: true, force: true });
    });

    it('cadastra upload, envia binario, gera access-url e remove media', async () => {
        const createResponse = await request(app)
            .post('/api/media/upload-url')
            .set(AUTH_HEADER)
            .send({
                data: {
                    fileName: 'foto-1.jpg',
                    contentType: 'image/jpeg',
                    sizeBytes: 4,
                    purpose: 'erosion-photo',
                    linkedResourceType: 'erosions',
                    linkedResourceId: 'E-1',
                },
            });

        expect(createResponse.status).toBe(201);
        const mediaId = createResponse.body.data.id;

        const uploadResponse = await request(app)
            .put(`/api/media/${mediaId}/upload`)
            .set(AUTH_HEADER)
            .set('Content-Type', 'image/jpeg')
            .send(Buffer.from('test'));

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.data.statusExecucao).toBe('ready');

        const accessUrlResponse = await request(app)
            .get(`/api/media/${mediaId}/access-url`)
            .set(AUTH_HEADER);

        expect(accessUrlResponse.status).toBe(200);
        expect(accessUrlResponse.body.data.accessUrl).toContain(`/api/media/${mediaId}/content`);

        const contentResponse = await request(app)
            .get(`/api/media/${mediaId}/content`)
            .set(AUTH_HEADER);

        expect(contentResponse.status).toBe(200);
        expect(contentResponse.headers['content-type']).toContain('image/jpeg');
        expect(Buffer.from(contentResponse.body).toString()).toBe('test');

        const deleteResponse = await request(app)
            .delete(`/api/media/${mediaId}`)
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);
    });

    it('permite upload e leitura de conteudo via token interno do worker', async () => {
        const createResponse = await request(app)
            .post('/api/media/upload-url')
            .set(WORKER_HEADER)
            .send({
                data: {
                    fileName: 'relatorio.docx',
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    sizeBytes: 12,
                    purpose: 'report_output_docx',
                    linkedResourceType: 'report_job',
                    linkedResourceId: 'JOB-CTX-1',
                },
            });

        expect(createResponse.status).toBe(201);
        const mediaId = createResponse.body.data.id;

        const uploadResponse = await request(app)
            .put(`/api/media/${mediaId}/upload`)
            .set(WORKER_HEADER)
            .set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            .send(Buffer.from('docx-content'));

        expect(uploadResponse.status).toBe(200);

        const completeResponse = await request(app)
            .post('/api/media/complete')
            .set(WORKER_HEADER)
            .send({ data: { id: mediaId, storedSizeBytes: 12 } });

        expect(completeResponse.status).toBe(200);
        expect(completeResponse.body.data.statusExecucao).toBe('ready');

        const contentResponse = await request(app)
            .get(`/api/media/${mediaId}/content`)
            .buffer(true)
            .parse(binaryParser)
            .set(WORKER_HEADER);

        expect(contentResponse.status).toBe(200);
        expect(contentResponse.body.toString()).toBe('docx-content');
    });
});
