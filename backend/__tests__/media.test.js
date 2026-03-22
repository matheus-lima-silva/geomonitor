const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../server');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Media API Integration Tests (Mocked DB)', () => {
    let mediaRoot;

    beforeEach(async () => {
        mediaRoot = path.join(os.tmpdir(), `geomonitor-media-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        process.env.MEDIA_STORAGE_ROOT = mediaRoot;
    });

    afterEach(async () => {
        delete process.env.MEDIA_STORAGE_ROOT;
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
});
