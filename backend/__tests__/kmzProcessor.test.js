const { buildStoredZip } = require('../utils/zipBuilder');
const { processKmzImport } = require('../utils/kmzProcessor');

function buildTestKmz({ kmlText, images = [] }) {
    const entries = [];
    if (kmlText) {
        entries.push({ name: 'doc.kml', data: Buffer.from(kmlText, 'utf8') });
    }
    for (const img of images) {
        entries.push({ name: img.path, data: img.data || Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
    }
    return buildStoredZip(entries);
}

function createMockMediaAssetRepository() {
    const stored = new Map();
    return {
        save: jest.fn(async (payload) => {
            stored.set(payload.id, payload);
            return payload;
        }),
        getById: jest.fn(async (id) => stored.get(id) || null),
        _stored: stored,
    };
}

function createMockReportPhotoRepository() {
    const stored = new Map();
    return {
        save: jest.fn(async (payload) => {
            stored.set(payload.id, payload);
            return payload;
        }),
        listByWorkspace: jest.fn(async () => [...stored.values()]),
        _stored: stored,
    };
}

jest.mock('../utils/mediaStorage', () => ({
    readStoredMediaContent: jest.fn(),
    writeLocalContent: jest.fn(async (mediaId, fileName, buffer) => ({
        filePath: `/tmp/test/${mediaId}/${fileName}`,
        sha256: require('crypto').createHash('sha256').update(buffer).digest('hex'),
        storedSizeBytes: buffer.byteLength,
        storedAt: new Date().toISOString(),
    })),
}));

const { readStoredMediaContent } = require('../utils/mediaStorage');

describe('kmzProcessor', () => {
    let mediaAssetRepository;
    let reportPhotoRepository;

    beforeEach(() => {
        mediaAssetRepository = createMockMediaAssetRepository();
        reportPhotoRepository = createMockReportPhotoRepository();
        jest.clearAllMocks();
    });

    it('processes a KMZ with photos and KML placemarks', async () => {
        const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>Test LT</name>
            <Placemark>
              <name>Torre 15</name>
              <Point><coordinates>-43.123,-22.456,100</coordinates></Point>
            </Placemark>
            <Placemark>
              <name>Torre 16</name>
              <Point><coordinates>-43.124,-22.457,100</coordinates></Point>
            </Placemark>
          </Document>
        </kml>`;

        const kmzBuffer = buildTestKmz({
            kmlText: kml,
            images: [
                { path: 'files/15/foto_a.jpg', data: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x01]) },
                { path: 'files/16/foto_b.jpg', data: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x02]) },
                { path: 'files/sem_torre/foto_c.jpg', data: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x03]) },
            ],
        });

        readStoredMediaContent.mockResolvedValue({
            buffer: kmzBuffer,
            contentType: 'application/vnd.google-earth.kmz',
            fileName: 'test.kmz',
        });

        const result = await processKmzImport({
            workspaceId: 'WS-001',
            projectId: 'PROJ-001',
            mediaAsset: { id: 'MA-KMZ', filePath: '/tmp/kmz' },
            updatedBy: 'test@user.com',
            mediaAssetRepository,
            reportPhotoRepository,
        });

        expect(result.photosCreated).toBe(3);
        expect(result.photosSkipped).toBe(0);
        expect(result.towersInferred).toBe(2);
        expect(result.pendingLinkage).toBe(1);
        expect(result.placemarkCount).toBe(2);
        expect(result.photoIds).toHaveLength(3);
        expect(result.warnings).toHaveLength(0);

        expect(mediaAssetRepository.save).toHaveBeenCalledTimes(3);
        expect(reportPhotoRepository.save).toHaveBeenCalledTimes(3);

        const savedPhotos = [...reportPhotoRepository._stored.values()];
        const photoWithTower15 = savedPhotos.find((p) => p.towerId === '15');
        expect(photoWithTower15).toBeDefined();
        expect(photoWithTower15.towerSource).toBe('kmz_folder');
        expect(photoWithTower15.importSource).toBe('organized_kmz');

        const pendingPhoto = savedPhotos.find((p) => p.towerSource === 'pending');
        expect(pendingPhoto).toBeDefined();
    });

    it('skips duplicate photos by sha256', async () => {
        const imageData = Buffer.from([0xAA, 0xBB, 0xCC]);
        const sha256 = require('crypto').createHash('sha256').update(imageData).digest('hex');

        reportPhotoRepository._stored.set('existing', { id: 'existing', sha256 });

        const kmzBuffer = buildTestKmz({
            kmlText: '<kml><Document></Document></kml>',
            images: [
                { path: 'files/15/duplicate.jpg', data: imageData },
                { path: 'files/16/unique.jpg', data: Buffer.from([0xDD, 0xEE]) },
            ],
        });

        readStoredMediaContent.mockResolvedValue({
            buffer: kmzBuffer,
            contentType: 'application/vnd.google-earth.kmz',
            fileName: 'test.kmz',
        });

        const result = await processKmzImport({
            workspaceId: 'WS-001',
            projectId: 'PROJ-001',
            mediaAsset: { id: 'MA-KMZ', filePath: '/tmp/kmz' },
            updatedBy: 'test@user.com',
            mediaAssetRepository,
            reportPhotoRepository,
        });

        expect(result.photosCreated).toBe(1);
        expect(result.photosSkipped).toBe(1);
    });

    it('handles KMZ without images gracefully', async () => {
        const kmzBuffer = buildTestKmz({
            kmlText: `<?xml version="1.0"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
              <Document><name>Empty</name></Document>
            </kml>`,
            images: [],
        });

        readStoredMediaContent.mockResolvedValue({
            buffer: kmzBuffer,
            contentType: 'application/vnd.google-earth.kmz',
            fileName: 'empty.kmz',
        });

        const result = await processKmzImport({
            workspaceId: 'WS-001',
            projectId: 'PROJ-001',
            mediaAsset: { id: 'MA-KMZ', filePath: '/tmp/kmz' },
            updatedBy: 'test@user.com',
            mediaAssetRepository,
            reportPhotoRepository,
        });

        expect(result.photosCreated).toBe(0);
        expect(result.warnings).toContain('Nenhuma imagem encontrada no KMZ.');
    });

    it('handles KMZ without KML', async () => {
        const kmzBuffer = buildTestKmz({
            kmlText: null,
            images: [
                { path: 'files/15/foto.jpg' },
            ],
        });

        readStoredMediaContent.mockResolvedValue({
            buffer: kmzBuffer,
            contentType: 'application/vnd.google-earth.kmz',
            fileName: 'no-kml.kmz',
        });

        const result = await processKmzImport({
            workspaceId: 'WS-001',
            projectId: 'PROJ-001',
            mediaAsset: { id: 'MA-KMZ', filePath: '/tmp/kmz' },
            updatedBy: 'test@user.com',
            mediaAssetRepository,
            reportPhotoRepository,
        });

        expect(result.photosCreated).toBe(1);
        expect(result.towersInferred).toBe(1);
        expect(result.warnings).toContain('Nenhum arquivo KML encontrado no KMZ.');
    });
});
