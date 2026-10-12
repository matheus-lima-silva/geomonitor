// Corte (e desfazer) do rodape da marca d'agua de UMA foto do workspace, a
// partir do lightbox de curadoria. Porta o fluxo do script one-off
// scripts/crop-watermark-footer.js para uso em rota:
//
//   1. le o binario atual do media_asset
//   2. grava um BACKUP do original num objeto irmao do bucket (pseudo-asset
//      com storage_key `<key>.orig-<ts>`; sem linha em media_assets)
//   3. corta a faixa inferior (utils/imageCrop.cropBottomBand, mantem Exif/JFIF)
//   4. sobrescreve o MESMO storage_key e atualiza sha256/size do media_asset
//   5. registra a operacao em report_photos.payload.cropHistory[]
//
// A curadoria (legenda, torre, include, GPS) vive nas colunas de report_photos
// e nao e tocada. Desfazer le o backup, regrava o original e apaga o backup.

const path = require('path');
const { reportPhotoRepository, mediaAssetRepository } = require('../repositories');
const { readStoredMediaContent, writeStoredContent, removeStoredMedia } = require('./mediaStorage');
const { cropBottomBand } = require('./imageCrop');

class PhotoCropError extends Error {
    constructor(message, status = 400, code = 'PHOTO_CROP_ERROR') {
        super(message);
        this.name = 'PhotoCropError';
        this.status = status;
        this.code = code;
    }
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function toFinitePositive(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// Pseudo-asset que aponta para o objeto de backup. Reusa contentType/backend do
// asset original; id e storageKey derivados garantem caminho unico tanto no
// S3/MinIO (storageKey) quanto no backend local (id -> filePath).
function buildBackupAsset(asset, timestamp) {
    const stamp = String(timestamp || Date.now());
    const fileName = normalizeText(asset?.fileName) || `${normalizeText(asset?.id) || 'foto'}.jpg`;
    const ext = path.extname(fileName) || '.jpg';
    const base = fileName.slice(0, fileName.length - ext.length) || 'foto';
    const storageKey = normalizeText(asset?.storageKey);
    return {
        ...asset,
        id: `${normalizeText(asset?.id)}--orig-${stamp}`,
        storageKey: storageKey ? `${storageKey}.orig-${stamp}` : '',
        fileName: `${base}.orig-${stamp}${ext}`,
        filePath: '',
    };
}

function assertCropTargets(photo, asset) {
    if (!photo || typeof photo !== 'object' || !normalizeText(photo.id)) {
        throw new PhotoCropError('Foto nao encontrada.', 404, 'PHOTO_NOT_FOUND');
    }
    if (!normalizeText(photo.mediaAssetId)) {
        throw new PhotoCropError('Foto sem arquivo de midia associado.', 400, 'PHOTO_WITHOUT_MEDIA');
    }
    if (!asset || typeof asset !== 'object' || !normalizeText(asset.id)) {
        throw new PhotoCropError('Arquivo de midia da foto nao encontrado.', 400, 'MEDIA_NOT_FOUND');
    }
}

function buildAssetUpdate(asset, storageResult, actor) {
    return {
        ...asset,
        sha256: storageResult.sha256,
        contentSha256: storageResult.sha256,
        sizeBytes: storageResult.storedSizeBytes,
        storedSizeBytes: storageResult.storedSizeBytes,
        storedAt: storageResult.storedAt,
        filePath: storageResult.filePath || asset.filePath || '',
        etag: storageResult.etag || asset.etag || '',
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
    };
}

/**
 * Corta `pixels` (ou `percent` da altura) do rodape da foto. Devolve a foto
 * atualizada (com `cropHistory`), o media_asset atualizado e a entrada criada.
 */
async function cropPhotoFooter({ photo, asset, pixels, percent, actor = 'API' } = {}) {
    assertCropTargets(photo, asset);
    const px = toFinitePositive(pixels);
    const pct = toFinitePositive(percent);
    if (!px && !pct) {
        throw new PhotoCropError('Informe pixels (>0) ou percent (>0) para o corte.', 400, 'INVALID_CROP_BAND');
    }

    const original = await readStoredMediaContent(asset);
    let cropped;
    try {
        cropped = await cropBottomBand(original.buffer, px ? { pixels: px } : { percent: pct });
    } catch (error) {
        throw new PhotoCropError(error?.message || 'Nao foi possivel cortar a imagem.', 422, 'CROP_FAILED');
    }

    const timestamp = Date.now();
    const backupAsset = buildBackupAsset(asset, timestamp);
    const backupResult = await writeStoredContent(backupAsset, original.buffer);
    const storageResult = await writeStoredContent(asset, cropped);
    const nextAsset = await mediaAssetRepository.save(buildAssetUpdate(asset, storageResult, actor), { merge: true });

    const entry = {
        at: new Date(timestamp).toISOString(),
        by: actor,
        pixels: px ? Math.round(px) : null,
        percent: pct || null,
        backup: {
            id: backupAsset.id,
            storageKey: backupAsset.storageKey,
            fileName: backupAsset.fileName,
            filePath: backupResult?.filePath || '',
        },
        prevSha256: normalizeText(asset.sha256 || asset.contentSha256) || null,
        prevSizeBytes: Number.isFinite(Number(asset.sizeBytes)) ? Number(asset.sizeBytes) : null,
        newSha256: storageResult.sha256,
        newSizeBytes: storageResult.storedSizeBytes,
    };
    const history = Array.isArray(photo.cropHistory) ? photo.cropHistory : [];
    const nextPhoto = await reportPhotoRepository.save(
        { ...photo, cropHistory: [...history, entry], updatedBy: actor },
        { merge: true },
    );

    return { photo: nextPhoto || { ...photo, cropHistory: [...history, entry] }, asset: nextAsset || asset, entry };
}

/**
 * Desfaz o ultimo corte: regrava o original guardado no backup, atualiza o
 * media_asset, remove a entrada do historico e apaga o backup (best-effort).
 */
async function undoPhotoFooterCrop({ photo, asset, actor = 'API' } = {}) {
    assertCropTargets(photo, asset);
    const history = Array.isArray(photo.cropHistory) ? photo.cropHistory : [];
    if (!history.length) {
        throw new PhotoCropError('Esta foto nao tem corte para desfazer.', 409, 'NO_CROP_HISTORY');
    }
    const entry = history[history.length - 1];
    const backup = entry?.backup && typeof entry.backup === 'object' ? entry.backup : {};
    if (!normalizeText(backup.storageKey) && !normalizeText(backup.filePath)) {
        throw new PhotoCropError('Backup do original nao esta disponivel.', 409, 'BACKUP_UNAVAILABLE');
    }
    const backupAsset = { ...asset, ...backup };

    let original;
    try {
        original = await readStoredMediaContent(backupAsset);
    } catch (error) {
        throw new PhotoCropError(`Nao foi possivel ler o backup do original: ${error?.message || error}`, 409, 'BACKUP_UNAVAILABLE');
    }

    const storageResult = await writeStoredContent(asset, original.buffer);
    const nextAsset = await mediaAssetRepository.save(buildAssetUpdate(asset, storageResult, actor), { merge: true });
    const nextPhoto = await reportPhotoRepository.save(
        { ...photo, cropHistory: history.slice(0, -1), updatedBy: actor },
        { merge: true },
    );

    try {
        await removeStoredMedia(backupAsset);
    } catch (error) {
        console.error('[photoFooterCrop] falha ao remover backup apos desfazer corte:', error?.message || error);
    }

    return { photo: nextPhoto || { ...photo, cropHistory: history.slice(0, -1) }, asset: nextAsset || asset, entry };
}

module.exports = {
    PhotoCropError,
    buildBackupAsset,
    cropPhotoFooter,
    undoPhotoFooterCrop,
};
