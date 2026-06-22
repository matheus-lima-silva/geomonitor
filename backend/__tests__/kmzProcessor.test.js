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
        listByIds: jest.fn(async (ids) => (Array.isArray(ids) ? ids : [])
            .map((id) => stored.get(id))
            .filter(Boolean)),
        _stored: stored,
    };
}

function createMockReportPhotoRepository() {
    const stored = new Map();
    return {
        // Espelha o merge do repositorio real: com { merge:true } so atualiza os
        // campos informados, preservando o restante (caption, sortOrder, etc.).
        save: jest.fn(async (payload, options = {}) => {
            const current = options.merge ? stored.get(payload.id) : null;
            const next = { ...(current || {}), ...payload };
            stored.set(payload.id, next);
            return next;
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

    it('no-op quando a foto existente ja tem a torre resolvida (dedupe puro)', async () => {
        const imageData = Buffer.from([0xAA, 0xBB, 0xCC]);
        const sha256 = require('crypto').createHash('sha256').update(imageData).digest('hex');

        // Foto existente ja na torre 15; o KMZ traz a mesma imagem na pasta 15.
        reportPhotoRepository._stored.set('existing', { id: 'existing', sha256, towerId: '15' });

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

        // duplicate.jpg casa a foto existente, mas a torre ja e 15 -> no-op (skip);
        // unique.jpg e nova -> created.
        expect(result.photosUpdated).toBe(0);
        expect(result.photosSkipped).toBe(1);
        expect(result.photosCreated).toBe(1);
    });

    it('atualiza a torre de uma foto existente via match por sha256 (sem ExtendedData)', async () => {
        const imageData = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
        const sha256 = require('crypto').createHash('sha256').update(imageData).digest('hex');

        // Foto existente SEM torre, identificada pela sha256 da sua media.
        reportPhotoRepository._stored.set('RPH-1', {
            id: 'RPH-1', mediaAssetId: 'MED-1', towerId: '', caption: 'orig', sortOrder: 0,
        });
        mediaAssetRepository._stored.set('MED-1', { id: 'MED-1', sha256 });

        // KMZ sem ExtendedData, com a mesma imagem numa pasta "Torre 22".
        const kmzBuffer = buildTestKmz({
            kmlText: '<kml><Document></Document></kml>',
            images: [{ path: 'files/22/foto.jpg', data: imageData }],
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

        expect(result.photosCreated).toBe(0);
        expect(result.photosUpdated).toBe(1);
        expect(result.towersAssigned).toBe(1);

        const updated = reportPhotoRepository._stored.get('RPH-1');
        expect(updated.towerId).toBe('22');
        expect(updated.towerSource).toBe('kmz_organized');
        // merge preserva campos nao informados (caption original).
        expect(updated.caption).toBe('orig');
    });

    it('round-trip: nome de arquivo por photoId + folderPath atribui torre a foto existente', async () => {
        // Espelha o export do worker: imagem em files/{photoId}.jpg, placemark com
        // ExtendedData.photoId dentro de uma pasta Torre N organizada pelo usuario.
        reportPhotoRepository._stored.set('RPH-7', {
            id: 'RPH-7', mediaAssetId: 'MED-7', towerId: '', caption: 'torre tbd',
        });

        const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Folder>
              <name>Torre 30</name>
              <Placemark>
                <name>Foto 1</name>
                <ExtendedData>
                  <Data name="photoId"><value>RPH-7</value></Data>
                  <Data name="mediaAssetId"><value>MED-7</value></Data>
                </ExtendedData>
                <Point><coordinates>-43.1,-22.4,0</coordinates></Point>
              </Placemark>
            </Folder>
          </Document>
        </kml>`;

        const kmzBuffer = buildTestKmz({
            kmlText: kml,
            images: [{ path: 'files/RPH-7.jpg', data: Buffer.from([0x01, 0x02, 0x03]) }],
        });

        readStoredMediaContent.mockResolvedValue({
            buffer: kmzBuffer,
            contentType: 'application/vnd.google-earth.kmz',
            fileName: 'organizado.kmz',
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
        expect(result.photosUpdated).toBe(1);
        expect(result.towersAssigned).toBe(1);
        expect(reportPhotoRepository._stored.get('RPH-7').towerId).toBe('30');
        // nao cria midia nova (sem reupload).
        expect(mediaAssetRepository.save).not.toHaveBeenCalled();
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
