const request = require('supertest');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Media API with MEDIA_BACKEND=tigris', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    it('gera upload e access-url assinados sem usar upload binario local', async () => {
        process.env.MEDIA_BACKEND = 'tigris';
        process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
        process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
        process.env.AWS_ENDPOINT_URL_S3 = 'https://fly.storage.tigris.dev';
        process.env.AWS_REGION = 'auto';
        process.env.BUCKET_NAME = 'geomonitor-media-hml';
        process.env.MEDIA_PRESIGN_TTL_SECONDS = '300';

        const app = require('../server');

        const createResponse = await request(app)
            .post('/api/media/upload-url')
            .set(AUTH_HEADER)
            .send({
                data: {
                    fileName: 'foto-kmz.jpg',
                    contentType: 'image/jpeg',
                    sizeBytes: 1234,
                    purpose: 'workspace-photo',
                    linkedResourceType: 'reportWorkspaces',
                    linkedResourceId: 'RW-1',
                },
            });

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.data.upload.href).toContain('fly.storage.tigris.dev');
        expect(createResponse.body.data.upload.method).toBe('PUT');

        const mediaId = createResponse.body.data.id;

        const completeResponse = await request(app)
            .post('/api/media/complete')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: mediaId,
                    etag: 'mock-etag',
                    storedSizeBytes: 1234,
                    sha256: 'abc123',
                },
            });

        expect(completeResponse.status).toBe(200);
        expect(completeResponse.body.data.statusExecucao).toBe('ready');
        expect(completeResponse.body.data.sha256).toBe('abc123');

        const accessUrlResponse = await request(app)
            .get(`/api/media/${mediaId}/access-url`)
            .set(AUTH_HEADER);

        expect(accessUrlResponse.status).toBe(200);
        expect(accessUrlResponse.body.data.accessUrl).toContain('fly.storage.tigris.dev');
        expect(accessUrlResponse.body.data.backend).toBe('tigris');

        const directUploadResponse = await request(app)
            .put(`/api/media/${mediaId}/upload`)
            .set(AUTH_HEADER)
            .set('Content-Type', 'image/jpeg')
            .send(Buffer.from('test'));

        expect(directUploadResponse.status).toBe(409);
    });
});
