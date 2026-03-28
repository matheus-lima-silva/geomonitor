describe('mediaStorage', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    it('gera URL assinada de upload para backend tigris', async () => {
        process.env.MEDIA_BACKEND = 'tigris';
        process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
        process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
        process.env.AWS_ENDPOINT_URL_S3 = 'https://fly.storage.tigris.dev';
        process.env.AWS_REGION = 'auto';
        process.env.BUCKET_NAME = 'geomonitor-media-hml';
        process.env.MEDIA_PRESIGN_TTL_SECONDS = '600';

        const mediaStorage = require('../mediaStorage');
        const upload = await mediaStorage.createSignedUploadUrl({
            storageKey: 'reports/MED-1/foto.jpg',
            contentType: 'image/jpeg',
        });

        expect(upload.method).toBe('PUT');
        expect(upload.href).toContain('https://fly.storage.tigris.dev');
        expect(upload.href).toContain('geomonitor-media-hml');
        expect(upload.href).toContain('X-Amz-Signature');
        expect(upload.headers['Content-Type']).toBe('image/jpeg');
        expect(upload.expiresAt).toBeTruthy();
    });

    it('gera URL assinada de leitura para backend tigris', async () => {
        process.env.MEDIA_BACKEND = 'tigris';
        process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
        process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
        process.env.AWS_ENDPOINT_URL_S3 = 'https://fly.storage.tigris.dev';
        process.env.AWS_REGION = 'auto';
        process.env.BUCKET_NAME = 'geomonitor-media-hml';

        const mediaStorage = require('../mediaStorage');
        const access = await mediaStorage.createSignedAccessUrl({
            storageKey: 'reports/MED-2/foto.jpg',
        });

        expect(access.method).toBe('GET');
        expect(access.href).toContain('https://fly.storage.tigris.dev');
        expect(access.href).toContain('X-Amz-Signature');
        expect(access.expiresAt).toBeTruthy();
    });
});
