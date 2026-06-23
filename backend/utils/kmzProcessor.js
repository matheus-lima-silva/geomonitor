const crypto = require('crypto');
const { extractKmzContents } = require('./kmzReader');
const { parseKmlPlacemarks, inferTowerIdFromPath, findTowerIdFromSource } = require('./kmlParser');
const { writeLocalContent, readStoredMediaContent, removeLocalMedia } = require('./mediaStorage');

function normalizeText(value) {
    return String(value || '').trim();
}

function buildDefaultCaption(fileName = '') {
    return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function fileStem(name = '') {
    const base = String(name || '').split(/[\\/]/).pop() || '';
    return base.replace(/\.[^.]+$/, '');
}

// Resolve a torre de um placemark/imagem por prioridade:
//   1. pasta organizada pelo usuario (folderPath, ex.: "Torre 15") — sinal do round-trip;
//   2. caminho da imagem dentro do zip (KMZ externo com pastas Torre N/);
//   3. nome do placemark.
function resolveTower(entry, placemark) {
    if (placemark && placemark.folderPath) {
        const fromFolder = findTowerIdFromSource(placemark.folderPath);
        if (fromFolder) return { towerId: fromFolder, towerSource: 'kmz_folder' };
    }
    const fromPath = inferTowerIdFromPath(entry.internalPath);
    if (fromPath) return { towerId: fromPath, towerSource: 'kmz_folder' };
    if (placemark && placemark.name) {
        const fromName = findTowerIdFromSource(placemark.name);
        if (fromName) return { towerId: fromName, towerSource: 'kmz_placemark' };
    }
    return { towerId: '', towerSource: '' };
}

async function buildExistingPhotoIndex(workspaceId, existingPhotos, mediaAssetRepository) {
    const byId = new Map();
    const byMediaAssetId = new Map();
    const bySha256 = new Map();

    for (const photo of existingPhotos) {
        const id = normalizeText(photo.id);
        const mediaId = normalizeText(photo.mediaAssetId);
        if (id) byId.set(id, photo);
        if (mediaId) byMediaAssetId.set(mediaId, photo);
        const payloadSha = normalizeText(photo.sha256 || photo.contentSha256);
        if (payloadSha && !bySha256.has(payloadSha)) bySha256.set(payloadSha, photo);
    }

    // sha256 das midias das fotos existentes (uma query). E a rede de seguranca do
    // round-trip: casa por conteudo quando a identidade no KML some (ex.: Google
    // Earth recompactou o KMZ sem ExtendedData).
    const mediaIds = [...byMediaAssetId.keys()];
    if (mediaIds.length > 0 && typeof mediaAssetRepository.listByIds === 'function') {
        const mediaList = await mediaAssetRepository.listByIds(mediaIds);
        const shaByMediaId = new Map();
        for (const media of mediaList) {
            const sha = normalizeText(media.sha256);
            if (sha) shaByMediaId.set(normalizeText(media.id), sha);
        }
        for (const photo of existingPhotos) {
            const sha = shaByMediaId.get(normalizeText(photo.mediaAssetId));
            if (sha && !bySha256.has(sha)) bySha256.set(sha, photo);
        }
    }

    return { byId, byMediaAssetId, bySha256 };
}

// Reconcilia os curationDrafts do workspace com as torres recem-atribuidas pelo
// round-trip. Os drafts sao snapshots de autosave por foto; se ficarem com a torre
// antiga (vazia) eles MASCARAM a torre nova na UI de curadoria. Atualiza so as
// entradas existentes das fotos afetadas, preservando o resto do draft_state.
// Best-effort: a torre ja foi salva em report_photos (o que importa), entao falha
// aqui nao quebra o import.
async function reconcileCurationDrafts(workspaceId, assignedTowers, reportWorkspaceRepository, updatedBy) {
    if (!reportWorkspaceRepository || assignedTowers.size === 0) return;
    try {
        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        const draftState = workspace?.draftState;
        const curationDrafts = draftState?.curationDrafts;
        if (!curationDrafts || typeof curationDrafts !== 'object') return;

        let changed = false;
        const nextCurationDrafts = { ...curationDrafts };
        for (const [photoId, towerId] of assignedTowers) {
            const draft = nextCurationDrafts[photoId];
            if (draft && typeof draft === 'object' && normalizeText(draft.towerId) !== towerId) {
                nextCurationDrafts[photoId] = { ...draft, towerId };
                changed = true;
            }
        }
        if (!changed) return;

        await reportWorkspaceRepository.save({
            id: workspaceId,
            draftState: { ...draftState, curationDrafts: nextCurationDrafts },
            updatedBy,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (err) {
        console.error('[kmzProcessor] Falha ao reconciliar curationDrafts apos round-trip', workspaceId, err);
    }
}

async function processKmzImport({
    workspaceId,
    projectId,
    mediaAsset,
    updatedBy,
    mediaAssetRepository,
    reportPhotoRepository,
    reportWorkspaceRepository,
}) {
    const { buffer } = await readStoredMediaContent(mediaAsset);
    const { kmlText, imageEntries } = extractKmzContents(buffer);

    let placemarkCount = 0;
    const warnings = [];
    let placemarks = [];

    if (kmlText) {
        const kmlResult = parseKmlPlacemarks(kmlText);
        placemarks = kmlResult.placemarks;
        placemarkCount = placemarks.length;
        warnings.push(...kmlResult.warnings);
    } else {
        warnings.push('Nenhum arquivo KML encontrado no KMZ.');
    }

    // Indices de placemark por identidade estavel (ExtendedData) e por nome (fallback
    // de KMZ externo). O placemark carrega o folderPath = pasta onde a foto foi
    // organizada, que e a fonte primaria de torre no re-import.
    const placemarkByPhotoId = new Map();
    const placemarkByMediaAssetId = new Map();
    const placemarkByName = new Map();
    for (const pm of placemarks) {
        const ext = pm.extendedData || {};
        const pmPhotoId = normalizeText(ext.photoId);
        const pmMediaAssetId = normalizeText(ext.mediaAssetId);
        if (pmPhotoId) placemarkByPhotoId.set(pmPhotoId, pm);
        if (pmMediaAssetId) placemarkByMediaAssetId.set(pmMediaAssetId, pm);
        if (pm.name) placemarkByName.set(pm.name.toLowerCase(), pm);
    }

    if (imageEntries.length === 0) {
        warnings.push('Nenhuma imagem encontrada no KMZ.');
        return {
            photosCreated: 0,
            photosUpdated: 0,
            photosSkipped: 0,
            towersInferred: 0,
            towersAssigned: 0,
            pendingLinkage: 0,
            placemarkCount,
            warnings,
            photoIds: [],
        };
    }

    const existingPhotos = await reportPhotoRepository.listByWorkspace(workspaceId);
    const { byId, byMediaAssetId, bySha256 } = await buildExistingPhotoIndex(
        workspaceId,
        existingPhotos,
        mediaAssetRepository,
    );
    const existingHashes = new Set(bySha256.keys());

    let photosCreated = 0;
    let photosUpdated = 0;
    let photosSkipped = 0;
    let towersInferred = 0;
    let towersAssigned = 0;
    let pendingLinkage = 0;
    const photoIds = [];
    const assignedTowers = new Map();
    const createdSortBase = existingPhotos.length;

    for (const entry of imageEntries) {
        const sha256 = crypto.createHash('sha256').update(entry.data).digest('hex');
        const stem = fileStem(entry.name);

        // Localiza o placemark correspondente (para folderPath + ExtendedData).
        const placemark = placemarkByPhotoId.get(stem)
            || placemarkByName.get(stem.toLowerCase())
            || null;
        const ext = placemark?.extendedData || {};
        const pmPhotoId = normalizeText(ext.photoId);
        const pmMediaAssetId = normalizeText(ext.mediaAssetId);

        // Resolve a foto existente por prioridade de identidade:
        // photoId (nome do arquivo) -> ExtendedData.photoId -> ExtendedData.mediaAssetId -> sha256.
        const existingPhoto = byId.get(stem)
            || (pmPhotoId ? byId.get(pmPhotoId) : null)
            || (pmMediaAssetId ? byMediaAssetId.get(pmMediaAssetId) : null)
            || bySha256.get(sha256)
            || null;

        const { towerId } = resolveTower(entry, placemark);

        if (existingPhoto) {
            // Re-import: atualiza a torre da foto existente SEM novo upload. So escreve
            // quando ha uma torre nova/diferente — senao e no-op.
            const currentTower = normalizeText(existingPhoto.towerId);
            if (towerId && towerId !== currentTower) {
                await reportPhotoRepository.save({
                    id: existingPhoto.id,
                    towerId,
                    towerSource: 'kmz_organized',
                    updatedBy,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
                photosUpdated += 1;
                if (!currentTower) towersAssigned += 1;
                assignedTowers.set(existingPhoto.id, towerId);
                photoIds.push(existingPhoto.id);
            } else {
                photosSkipped += 1;
            }
            continue;
        }

        // Sem foto existente: dedupe por sha256 e cria (caso de KMZ externo).
        if (existingHashes.has(sha256)) {
            photosSkipped += 1;
            continue;
        }

        const mediaId = `MA-${crypto.randomUUID()}`;
        const storageResult = await writeLocalContent(mediaId, entry.name, entry.data);

        try {
            await mediaAssetRepository.save({
                id: mediaId,
                purpose: 'workspace-photo',
                linkedResourceType: 'reportWorkspaces',
                linkedResourceId: workspaceId,
                contentType: guessContentType(entry.name),
                sizeBytes: entry.data.byteLength,
                sha256,
                statusExecucao: 'completed',
                sourceKind: 'local',
                filePath: storageResult.filePath,
                fileName: entry.name,
                updatedBy,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        } catch (dbErr) {
            await removeLocalMedia(mediaId).catch(() => {});
            throw dbErr;
        }

        let towerSource = '';
        if (!towerId) {
            towerSource = 'pending';
            pendingLinkage += 1;
        } else {
            towerSource = resolveTower(entry, placemark).towerSource || 'kmz_folder';
            towersInferred += 1;
        }

        const gpsLat = placemark && Number.isFinite(placemark.lat) ? placemark.lat : null;
        const gpsLon = placemark && Number.isFinite(placemark.lon) ? placemark.lon : null;

        const photoId = `RPH-${crypto.randomUUID()}`;
        await reportPhotoRepository.save({
            id: photoId,
            workspaceId,
            projectId,
            mediaAssetId: mediaId,
            towerId: towerId || '',
            towerSource,
            includeInReport: false,
            caption: buildDefaultCaption(entry.name),
            curationStatus: towerId ? 'reviewed' : 'uploaded',
            importSource: 'organized_kmz',
            // Persiste o sha256 no payload da foto para que re-imports futuros possam
            // casar por conteudo mesmo sem consultar media_assets.
            sha256,
            gpsLat,
            gpsLon,
            sortOrder: createdSortBase + photosCreated,
            updatedBy,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        bySha256.set(sha256, { id: photoId });
        existingHashes.add(sha256);
        photoIds.push(photoId);
        photosCreated += 1;
    }

    await reconcileCurationDrafts(workspaceId, assignedTowers, reportWorkspaceRepository, updatedBy);

    return {
        photosCreated,
        photosUpdated,
        photosSkipped,
        towersInferred,
        towersAssigned,
        pendingLinkage,
        placemarkCount,
        warnings,
        photoIds,
    };
}

function guessContentType(fileName) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    const types = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        bmp: 'image/bmp',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        webp: 'image/webp',
    };
    return types[ext] || 'application/octet-stream';
}

module.exports = {
    processKmzImport,
};
