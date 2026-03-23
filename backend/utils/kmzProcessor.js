const crypto = require('crypto');
const { extractKmzContents } = require('./kmzReader');
const { parseKmlPlacemarks, inferTowerIdFromPath, findTowerIdFromSource } = require('./kmlParser');
const { writeLocalContent, readStoredMediaContent } = require('./mediaStorage');

function normalizeText(value) {
    return String(value || '').trim();
}

function buildDefaultCaption(fileName = '') {
    return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

async function processKmzImport({
    workspaceId,
    projectId,
    mediaAsset,
    updatedBy,
    mediaAssetRepository,
    reportPhotoRepository,
}) {
    const { buffer } = await readStoredMediaContent(mediaAsset);
    const { kmlText, imageEntries } = extractKmzContents(buffer);

    let placemarkCount = 0;
    let placemarkLookup = new Map();
    const warnings = [];

    if (kmlText) {
        const kmlResult = parseKmlPlacemarks(kmlText);
        placemarkCount = kmlResult.placemarks.length;
        warnings.push(...kmlResult.warnings);

        for (const pm of kmlResult.placemarks) {
            if (pm.name) {
                placemarkLookup.set(pm.name.toLowerCase(), pm);
            }
        }
    } else {
        warnings.push('Nenhum arquivo KML encontrado no KMZ.');
    }

    if (imageEntries.length === 0) {
        warnings.push('Nenhuma imagem encontrada no KMZ.');
        return {
            photosCreated: 0,
            photosSkipped: 0,
            towersInferred: 0,
            pendingLinkage: 0,
            placemarkCount,
            warnings,
            photoIds: [],
        };
    }

    const existingPhotos = await reportPhotoRepository.listByWorkspace(workspaceId);
    const existingHashes = new Set(
        existingPhotos
            .map((p) => normalizeText(p.sha256 || p.contentSha256))
            .filter(Boolean),
    );

    let photosCreated = 0;
    let photosSkipped = 0;
    let towersInferred = 0;
    let pendingLinkage = 0;
    const photoIds = [];

    for (const entry of imageEntries) {
        const sha256 = crypto.createHash('sha256').update(entry.data).digest('hex');

        if (existingHashes.has(sha256)) {
            photosSkipped += 1;
            continue;
        }

        const mediaId = `MA-${crypto.randomUUID()}`;
        const storageResult = await writeLocalContent(mediaId, entry.name, entry.data);

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

        let towerId = inferTowerIdFromPath(entry.internalPath);
        let towerSource = towerId ? 'kmz_folder' : '';

        if (!towerId) {
            const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
            const placemarkMatch = placemarkLookup.get(baseName);
            if (placemarkMatch) {
                const fromPlacemark = findTowerIdFromSource(placemarkMatch.name);
                if (fromPlacemark) {
                    towerId = fromPlacemark;
                    towerSource = 'kmz_placemark';
                }
            }
        }

        if (!towerId) {
            towerSource = 'pending';
            pendingLinkage += 1;
        } else {
            towersInferred += 1;
        }

        let gpsLat = null;
        let gpsLon = null;
        for (const pm of placemarkLookup.values()) {
            const pmTower = findTowerIdFromSource(pm.name);
            if (pmTower && pmTower === towerId) {
                gpsLat = pm.lat;
                gpsLon = pm.lon;
                break;
            }
        }

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
            gpsLat,
            gpsLon,
            sortOrder: photosCreated,
            updatedBy,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        existingHashes.add(sha256);
        photoIds.push(photoId);
        photosCreated += 1;
    }

    return {
        photosCreated,
        photosSkipped,
        towersInferred,
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
