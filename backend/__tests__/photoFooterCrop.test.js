// Testes unitarios do corte/desfazer do rodape de uma foto (utils/photoFooterCrop).
// Storage e repositorios em memoria; o corte em si usa sharp de verdade sobre um
// JPEG sintetico (topo vermelho + rodape azul), como em imageCrop.test.js.

const sharp = require('sharp');

const mockStore = new Map(); // storageKey -> Buffer
const mockPhotos = new Map();
const mockAssets = new Map();

function storageKeyOf(asset) {
    return String(asset.storageKey || asset.id || '');
}

jest.mock('../utils/mediaStorage', () => ({
    readStoredMediaContent: jest.fn(async (asset) => {
        const key = String(asset.storageKey || asset.id || '');
        if (!mockStore.has(key)) throw new Error(`objeto ausente: ${key}`);
        return { buffer: mockStore.get(key), contentType: 'image/jpeg', fileName: asset.fileName || 'foto.jpg' };
    }),
    writeStoredContent: jest.fn(async (asset, buffer) => {
        const key = String(asset.storageKey || asset.id || '');
        mockStore.set(key, Buffer.from(buffer));
        const crypto = require('crypto');
        return {
            storedAt: '2026-10-12T20:00:00.000Z',
            storedSizeBytes: buffer.byteLength,
            sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
            etag: '',
            filePath: '',
        };
    }),
    removeStoredMedia: jest.fn(async (asset) => {
        mockStore.delete(String(asset.storageKey || asset.id || ''));
    }),
}));

jest.mock('../repositories', () => ({
    reportPhotoRepository: {
        save: jest.fn(async (payload) => {
            const next = { ...(mockPhotos.get(payload.id) || {}), ...payload };
            mockPhotos.set(payload.id, next);
            return next;
        }),
        getById: jest.fn(async (id) => mockPhotos.get(id) || null),
    },
    mediaAssetRepository: {
        save: jest.fn(async (payload) => {
            const next = { ...(mockAssets.get(payload.id) || {}), ...payload };
            mockAssets.set(payload.id, next);
            return next;
        }),
        getById: jest.fn(async (id) => mockAssets.get(id) || null),
    },
}));

const mediaStorage = require('../utils/mediaStorage');
const {
    PhotoCropError,
    buildBackupAsset,
    cropPhotoFooter,
    cropPhotoFooterBatch,
    purgeExpiredCropBackups,
    undoPhotoFooterCrop,
} = require('../utils/photoFooterCrop');

const WIDTH = 100;
const TOP_HEIGHT = 100;
const BAND_HEIGHT = 20;

async function buildSyntheticJpeg() {
    const channels = 3;
    const height = TOP_HEIGHT + BAND_HEIGHT;
    const raw = Buffer.alloc(WIDTH * height * channels);
    for (let y = 0; y < height; y += 1) {
        const isBand = y >= TOP_HEIGHT;
        for (let x = 0; x < WIDTH; x += 1) {
            const idx = (y * WIDTH + x) * channels;
            raw[idx] = isBand ? 0 : 255;
            raw[idx + 1] = 0;
            raw[idx + 2] = isBand ? 255 : 0;
        }
    }
    return sharp(raw, { raw: { width: WIDTH, height, channels } }).jpeg({ quality: 100 }).toBuffer();
}

function seed(originalBuffer) {
    const asset = {
        id: 'MA-1',
        storageKey: 'workspaces/WS-1/MA-1.jpg',
        fileName: 'TimePhoto_1.jpg',
        contentType: 'image/jpeg',
        sourceKind: 'tigris',
        sha256: 'sha-original',
        sizeBytes: originalBuffer.byteLength,
    };
    const photo = { id: 'RPH-1', workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: 'MA-1', caption: 'Torre 126', towerId: '126' };
    mockAssets.set(asset.id, asset);
    mockPhotos.set(photo.id, photo);
    mockStore.set(storageKeyOf(asset), originalBuffer);
    return { asset, photo };
}

beforeEach(() => {
    mockStore.clear();
    mockPhotos.clear();
    mockAssets.clear();
    jest.clearAllMocks();
});

function seedMany(originalBuffer, ids) {
    return ids.map((id) => {
        const asset = { id: `MA-${id}`, storageKey: `workspaces/WS-1/MA-${id}.jpg`, fileName: `TimePhoto_${id}.jpg`, contentType: 'image/jpeg', sourceKind: 'tigris', sha256: `sha-${id}`, sizeBytes: originalBuffer.byteLength };
        const photo = { id: `RPH-${id}`, workspaceId: 'WS-1', projectId: 'P1', mediaAssetId: asset.id, towerId: '126' };
        mockAssets.set(asset.id, asset);
        mockPhotos.set(photo.id, photo);
        mockStore.set(storageKeyOf(asset), originalBuffer);
        return { asset, photo };
    });
}

describe('cropPhotoFooterBatch', () => {
    it('corta varias fotos, pula as ja cortadas e reporta erro por foto sem travar o lote', async () => {
        const original = await buildSyntheticJpeg();
        const [a, b, c] = seedMany(original, ['a', 'b', 'c']);
        // b ja foi cortada antes.
        const first = await cropPhotoFooter({ photo: b.photo, asset: b.asset, pixels: BAND_HEIGHT, actor: 'antes' });
        // c nao tem midia.
        const broken = { photo: { ...c.photo, mediaAssetId: '' }, asset: null };

        const result = await cropPhotoFooterBatch({
            targets: [{ photo: a.photo, asset: a.asset }, { photo: first.photo, asset: b.asset }, broken],
            pixels: BAND_HEIGHT,
            actor: 'lote@test',
        });

        expect(result.cropped).toBe(1);
        expect(result.photos.map((p) => p.id)).toEqual(['RPH-a']);
        expect(result.photos[0].cropHistory[0]).toMatchObject({ pixels: BAND_HEIGHT, by: 'lote@test' });
        expect(result.skipped).toEqual([
            { photoId: 'RPH-b', code: 'ALREADY_CROPPED', message: 'Foto ja cortada; pulada.' },
            { photoId: 'RPH-c', code: 'PHOTO_WITHOUT_MEDIA', message: 'Foto sem arquivo de midia associado.' },
        ]);
        const meta = await sharp(mockStore.get(storageKeyOf(a.asset))).metadata();
        expect(meta.height).toBe(TOP_HEIGHT);
        // b continua com um unico corte (nao foi cortada de novo).
        expect(mockPhotos.get('RPH-b').cropHistory).toHaveLength(1);
    });

    it('skipCropped=false corta de novo uma foto ja cortada', async () => {
        const original = await buildSyntheticJpeg();
        const [a] = seedMany(original, ['a']);
        const first = await cropPhotoFooter({ photo: a.photo, asset: a.asset, pixels: 5 });
        const result = await cropPhotoFooterBatch({ targets: [{ photo: first.photo, asset: mockAssets.get('MA-a') }], pixels: 5, skipCropped: false });
        expect(result.cropped).toBe(1);
        expect(mockPhotos.get('RPH-a').cropHistory).toHaveLength(2);
    });
});

describe('purgeExpiredCropBackups', () => {
    it('apaga so os backups vencidos, marca a entrada e torna o corte nao desfazivel', async () => {
        const original = await buildSyntheticJpeg();
        const [a, b] = seedMany(original, ['a', 'b']);
        const oldCrop = await cropPhotoFooter({ photo: a.photo, asset: a.asset, pixels: BAND_HEIGHT });
        const recentCrop = await cropPhotoFooter({ photo: b.photo, asset: b.asset, pixels: BAND_HEIGHT });
        // Envelhece o corte de "a" em 40 dias.
        const agedPhoto = { ...oldCrop.photo, cropHistory: [{ ...oldCrop.entry, at: new Date(Date.now() - 40 * 86_400_000).toISOString() }] };
        mockPhotos.set('RPH-a', agedPhoto);
        const oldBackupKey = oldCrop.entry.backup.storageKey;
        const recentBackupKey = recentCrop.entry.backup.storageKey;
        expect(mockStore.has(oldBackupKey)).toBe(true);

        const result = await purgeExpiredCropBackups({
            targets: [{ photo: agedPhoto, asset: mockAssets.get('MA-a') }, { photo: recentCrop.photo, asset: mockAssets.get('MA-b') }],
            days: 30,
            actor: 'retention',
        });

        expect(result).toMatchObject({ purged: 1, failed: 0, photosTouched: 1, days: 30 });
        expect(mockStore.has(oldBackupKey)).toBe(false);
        expect(mockStore.has(recentBackupKey)).toBe(true);
        const purgedEntry = mockPhotos.get('RPH-a').cropHistory[0];
        expect(purgedEntry.backup).toBeNull();
        expect(purgedEntry.purgedAt).toBeTruthy();
        expect(purgedEntry.pixels).toBe(BAND_HEIGHT); // historico (auditoria) permanece
        // O binario cortado continua la e o undo agora falha com 409.
        expect(mockStore.has(storageKeyOf(mockAssets.get('MA-a')))).toBe(true);
        await expect(undoPhotoFooterCrop({ photo: mockPhotos.get('RPH-a'), asset: mockAssets.get('MA-a') }))
            .rejects.toMatchObject({ status: 409, code: 'BACKUP_UNAVAILABLE' });
        // Rodar de novo nao mexe em nada.
        const again = await purgeExpiredCropBackups({ targets: [{ photo: mockPhotos.get('RPH-a'), asset: mockAssets.get('MA-a') }], days: 30 });
        expect(again).toMatchObject({ purged: 0, photosTouched: 0 });
    });

    it('falha de storage vira purgeError na entrada e conta em failed, sem lancar', async () => {
        const original = await buildSyntheticJpeg();
        const [a] = seedMany(original, ['a']);
        const crop = await cropPhotoFooter({ photo: a.photo, asset: a.asset, pixels: BAND_HEIGHT });
        const aged = { ...crop.photo, cropHistory: [{ ...crop.entry, at: '2020-01-01T00:00:00.000Z' }] };
        mediaStorage.removeStoredMedia.mockImplementationOnce(async () => { throw new Error('bucket indisponivel'); });

        const result = await purgeExpiredCropBackups({ targets: [{ photo: aged, asset: mockAssets.get('MA-a') }], days: 30 });
        expect(result).toMatchObject({ purged: 0, failed: 1, photosTouched: 1 });
        const entry = mockPhotos.get('RPH-a').cropHistory[0];
        expect(entry.backup).toBeTruthy();
        expect(entry.purgeError).toContain('bucket indisponivel');
    });
});

describe('buildBackupAsset', () => {
    it('deriva id, storageKey e fileName unicos e zera filePath', () => {
        const backup = buildBackupAsset({ id: 'MA-1', storageKey: 'a/b/MA-1.jpg', fileName: 'foto.jpg', filePath: '/x/foto.jpg', sourceKind: 'tigris' }, 123);
        expect(backup).toMatchObject({ id: 'MA-1--orig-123', storageKey: 'a/b/MA-1.jpg.orig-123', fileName: 'foto.orig-123.jpg', filePath: '', sourceKind: 'tigris' });
    });
});

describe('cropPhotoFooter', () => {
    it('grava backup, sobrescreve o binario cortado, atualiza o media_asset e registra o historico', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);

        const result = await cropPhotoFooter({ photo, asset, pixels: BAND_HEIGHT, actor: 'tester@x' });

        // Binario no mesmo storage_key ficou menor em altura e sem a faixa azul.
        const stored = mockStore.get(storageKeyOf(asset));
        const meta = await sharp(stored).metadata();
        expect(meta.height).toBe(TOP_HEIGHT);
        expect(stored.equals(original)).toBe(false);

        // Backup com o original intacto.
        const backupKey = result.entry.backup.storageKey;
        expect(backupKey).toMatch(/\.orig-\d+$/);
        expect(mockStore.get(backupKey).equals(original)).toBe(true);

        // media_asset atualizado (sha/size novos).
        expect(result.asset.sha256).toBe(result.entry.newSha256);
        expect(result.asset.sizeBytes).toBe(stored.byteLength);
        expect(result.asset.updatedBy).toBe('tester@x');

        // Historico na foto, curadoria preservada.
        expect(result.photo.cropHistory).toHaveLength(1);
        expect(result.photo.cropHistory[0]).toMatchObject({ pixels: BAND_HEIGHT, by: 'tester@x', prevSha256: 'sha-original', prevSizeBytes: original.byteLength });
        expect(result.photo.caption).toBe('Torre 126');
        expect(result.photo.towerId).toBe('126');
    });

    it('aceita percent quando pixels nao vem', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        const result = await cropPhotoFooter({ photo, asset, percent: 0.5, actor: 'a' });
        const meta = await sharp(mockStore.get(storageKeyOf(asset))).metadata();
        expect(meta.height).toBe(60);
        expect(result.entry.percent).toBe(0.5);
        expect(result.entry.pixels).toBeNull();
    });

    it('rejeita faixa invalida e nao grava nada', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        await expect(cropPhotoFooter({ photo, asset, pixels: 0 })).rejects.toMatchObject({ status: 400, code: 'INVALID_CROP_BAND' });
        await expect(cropPhotoFooter({ photo, asset, pixels: 500 })).rejects.toMatchObject({ status: 422, code: 'CROP_FAILED' });
        expect(mockStore.get(storageKeyOf(asset)).equals(original)).toBe(true);
        expect(mediaStorage.writeStoredContent).not.toHaveBeenCalled();
    });

    it('exige foto com midia e asset existente', async () => {
        await expect(cropPhotoFooter({ photo: { id: 'X' }, asset: { id: 'MA' }, pixels: 10 })).rejects.toBeInstanceOf(PhotoCropError);
        await expect(cropPhotoFooter({ photo: { id: 'X', mediaAssetId: 'MA' }, asset: null, pixels: 10 })).rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
    });
});

describe('undoPhotoFooterCrop', () => {
    it('restaura o original, atualiza o media_asset, remove a entrada e apaga o backup', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        const cropped = await cropPhotoFooter({ photo, asset, pixels: BAND_HEIGHT, actor: 'a' });

        const result = await undoPhotoFooterCrop({ photo: cropped.photo, asset: cropped.asset, actor: 'b' });

        expect(mockStore.get(storageKeyOf(asset)).equals(original)).toBe(true);
        expect(mockStore.has(cropped.entry.backup.storageKey)).toBe(false);
        expect(result.photo.cropHistory).toEqual([]);
        expect(result.asset.sizeBytes).toBe(original.byteLength);
        expect(result.asset.updatedBy).toBe('b');
        expect(mediaStorage.removeStoredMedia).toHaveBeenCalledTimes(1);
    });

    it('desfaz apenas o ultimo corte quando ha dois', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        const first = await cropPhotoFooter({ photo, asset, pixels: 10, actor: 'a' });
        const second = await cropPhotoFooter({ photo: first.photo, asset: first.asset, pixels: 10, actor: 'a' });
        expect(second.photo.cropHistory).toHaveLength(2);

        const undone = await undoPhotoFooterCrop({ photo: second.photo, asset: second.asset, actor: 'a' });
        const meta = await sharp(mockStore.get(storageKeyOf(asset))).metadata();
        expect(meta.height).toBe(TOP_HEIGHT + BAND_HEIGHT - 10);
        expect(undone.photo.cropHistory).toHaveLength(1);
    });

    it('sem historico responde 409', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        await expect(undoPhotoFooterCrop({ photo, asset })).rejects.toMatchObject({ status: 409, code: 'NO_CROP_HISTORY' });
    });

    it('backup ausente no storage responde 409 sem alterar o binario atual', async () => {
        const original = await buildSyntheticJpeg();
        const { asset, photo } = seed(original);
        const cropped = await cropPhotoFooter({ photo, asset, pixels: BAND_HEIGHT, actor: 'a' });
        mockStore.delete(cropped.entry.backup.storageKey);
        const current = mockStore.get(storageKeyOf(asset));

        await expect(undoPhotoFooterCrop({ photo: cropped.photo, asset: cropped.asset })).rejects.toMatchObject({ status: 409, code: 'BACKUP_UNAVAILABLE' });
        expect(mockStore.get(storageKeyOf(asset)).equals(current)).toBe(true);
    });
});
