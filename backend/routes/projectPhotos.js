const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const { reportPhotoRepository, projectPhotoExportRepository, mediaAssetRepository } = require('../repositories');
const {
    getConfiguredMediaBackend,
    isTigrisBackend,
    readStoredMediaContent,
    sanitizeFileName,
    writeStoredContent,
} = require('../utils/mediaStorage');
const { buildStoredZip } = require('../utils/zipBuilder');

function normalizeSelectionIds(values) {
    return Array.isArray(values)
        ? values.map((value) => normalizeText(value)).filter(Boolean)
        : [];
}

function buildExportFilters(filters = {}, selectionIds = []) {
    const nextFilters = filters && typeof filters === 'object' ? { ...filters } : {};
    const normalizedSelectionIds = normalizeSelectionIds(selectionIds);
    if (normalizedSelectionIds.length > 0) {
        nextFilters.ids = normalizedSelectionIds.join(',');
    }
    return nextFilters;
}

function wantsBinaryDownload(query = {}) {
    const rawValue = normalizeText(query.download || query.binary || '');
    return ['1', 'true', 'yes', 'sim'].includes(rawValue.toLowerCase());
}

function sanitizeZipSegment(value, fallback) {
    const normalized = normalizeText(value).replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_');
    return normalized || fallback;
}

function buildProjectPhotoExportFileName(projectId, token) {
    return sanitizeFileName(`photos-${projectId}-${token}.zip`);
}

function buildProjectPhotoExportStorageKey(projectId, token, fileName) {
    return `project-photo-exports/${projectId}/${token}/${sanitizeFileName(fileName)}`;
}

function buildProjectPhotoEntryName(photo, asset, folderMode = 'tower') {
    const baseFileName = sanitizeFileName(asset?.fileName || `${photo.id}.bin`);
    const uniqueFileName = `${sanitizeZipSegment(photo.id, 'photo')}-${baseFileName}`;
    const normalizedFolderMode = normalizeText(folderMode).toLowerCase() || 'tower';

    if (normalizedFolderMode === 'workspace') {
        return `${sanitizeZipSegment(photo.workspaceId, 'sem-workspace')}/${uniqueFileName}`;
    }

    if (normalizedFolderMode === 'flat') {
        return uniqueFileName;
    }

    return `${sanitizeZipSegment(photo.towerId, 'sem-torre')}/${uniqueFileName}`;
}

async function buildProjectPhotoExportArchive(projectId, exported) {
    const filters = buildExportFilters(exported?.filters, exported?.selectionIds);
    const photos = await reportPhotoRepository.listByProject(projectId, filters);
    const photoEntries = [];
    const skippedEntries = [];

    for (const photo of photos) {
        const mediaAssetId = normalizeText(photo.mediaAssetId);
        if (!mediaAssetId) {
            skippedEntries.push(`- ${photo.id}: foto sem mediaAssetId associado.`);
            continue;
        }

        const asset = await mediaAssetRepository.getById(mediaAssetId);
        if (!asset) {
            skippedEntries.push(`- ${photo.id}: media ${mediaAssetId} nao encontrada.`);
            continue;
        }

        try {
            const content = await readStoredMediaContent(asset);
            photoEntries.push({
                name: buildProjectPhotoEntryName(photo, asset, exported?.folderMode),
                data: content.buffer,
                modifiedAt: new Date(photo.captureAt || photo.updatedAt || photo.createdAt || Date.now()),
            });
        } catch (error) {
            skippedEntries.push(`- ${photo.id}: ${error?.message || 'falha ao ler a media.'}`);
        }
    }

    if (photoEntries.length === 0) {
        throw new Error('Nenhuma media disponivel para gerar o ZIP desta exportacao.');
    }

    if (skippedEntries.length > 0) {
        photoEntries.push({
            name: 'README.txt',
            data: Buffer.from(
                [
                    `Exportacao de fotos do empreendimento ${projectId}`,
                    '',
                    'Algumas entradas nao puderam ser incluidas no ZIP:',
                    ...skippedEntries,
                ].join('\n'),
                'utf8',
            ),
            modifiedAt: new Date(),
        });
    }

    return {
        buffer: buildStoredZip(photoEntries),
        itemCount: photoEntries.length - (skippedEntries.length > 0 ? 1 : 0),
        skippedCount: skippedEntries.length,
        fileName: buildProjectPhotoExportFileName(projectId, exported?.token || exported?.id || crypto.randomUUID()),
    };
}

async function ensureProjectPhotoExportArchiveMedia(projectId, exported, actor) {
    const now = new Date().toISOString();
    const existingMediaId = normalizeText(exported?.outputMediaAssetId);

    if (existingMediaId) {
        const existingAsset = await mediaAssetRepository.getById(existingMediaId);
        if (existingAsset && normalizeText(existingAsset.statusExecucao) === 'ready') {
            return {
                asset: existingAsset,
                generatedItemCount: Number.isFinite(Number(exported?.generatedItemCount))
                    ? Number(exported.generatedItemCount)
                    : Number(exported?.itemCount || 0),
                skippedItemCount: Number.isFinite(Number(exported?.skippedItemCount))
                    ? Number(exported.skippedItemCount)
                    : 0,
                generatedAt: normalizeText(exported?.generatedAt) || now,
                reused: true,
            };
        }
    }

    const archive = await buildProjectPhotoExportArchive(projectId, exported);
    const mediaId = existingMediaId || `MED-${crypto.randomUUID()}`;
    const fileName = archive.fileName;
    const payload = {
        id: mediaId,
        fileName,
        contentType: 'application/zip',
        sizeBytes: archive.buffer.byteLength,
        purpose: 'project_photo_export_zip',
        linkedResourceType: 'project_photo_export',
        linkedResourceId: normalizeText(exported?.token),
        storageKey: buildProjectPhotoExportStorageKey(projectId, normalizeText(exported?.token), fileName),
        statusExecucao: 'pending_upload',
        sourceKind: isTigrisBackend() ? 'tigris' : 'local',
        storageBackend: getConfiguredMediaBackend(),
        updatedAt: now,
        updatedBy: actor || 'API',
    };

    const savedAsset = await mediaAssetRepository.save(payload, { merge: true });
    const storageResult = await writeStoredContent(savedAsset, archive.buffer);

    const readyAsset = await mediaAssetRepository.save({
        ...savedAsset,
        statusExecucao: 'ready',
        storedAt: storageResult.storedAt,
        storedSizeBytes: storageResult.storedSizeBytes,
        sizeBytes: storageResult.storedSizeBytes,
        filePath: storageResult.filePath || '',
        contentSha256: storageResult.sha256,
        sha256: storageResult.sha256,
        etag: normalizeText(storageResult.etag || savedAsset.etag),
        updatedAt: now,
        updatedBy: actor || 'API',
    }, { merge: true });

    return {
        asset: readyAsset,
        generatedItemCount: archive.itemCount,
        skippedItemCount: archive.skippedCount,
        generatedAt: now,
        reused: false,
    };
}

function createPhotoResponse(req, projectId, photo) {
    const workspaceId = normalizeText(photo.workspaceId);
    const mediaAssetId = normalizeText(photo.mediaAssetId);
    const photoId = normalizeText(photo.id);
    const extraLinks = {
        project: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}`, method: 'GET' },
    };

    if (workspaceId) {
        extraLinks.workspace = {
            href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}`,
            method: 'GET',
        };
        extraLinks.workspacePhoto = {
            href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}/photos/${photoId}`,
            method: 'PUT',
        };
    }

    if (mediaAssetId) {
        extraLinks.media = {
            href: `${resolveApiBaseUrl(req)}/media/${mediaAssetId}`,
            method: 'GET',
        };
    }

    return createResourceHateoasResponse(
        req,
        photo,
        `projects/${projectId}/photos/${photoId}`,
        {
            allowUpdate: false,
            allowDelete: false,
            collectionPath: `projects/${projectId}/photos`,
            extraLinks,
        },
    );
}

router.get('/:id/photos', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const photos = await reportPhotoRepository.listByProject(projectId, req.query || {});
        return res.status(200).json({
            status: 'success',
            data: photos.map((photo) => createPhotoResponse(req, projectId, photo)),
        });
    } catch (error) {
        console.error('[project-photos API] Error GET /:id/photos:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar fotos do empreendimento' });
    }
});

// Lista fotos arquivadas do empreendimento (archived_at IS NOT NULL).
// O frontend agrupa por mes/ano da vistoria (inspection.dataInicio).
router.get('/:id/archived-photos', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const photos = await reportPhotoRepository.listArchivedByProject(projectId);
        return res.status(200).json({
            status: 'success',
            data: photos.map((photo) => createPhotoResponse(req, projectId, photo)),
        });
    } catch (error) {
        console.error('[project-photos API] Error GET /:id/archived-photos:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar fotos arquivadas' });
    }
});

router.get('/:id/photos/:photoId', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const photoId = normalizeText(req.params.photoId);
        const photo = await reportPhotoRepository.getById(photoId);

        if (!photo || String(photo.projectId || '').toUpperCase() !== projectId) {
            return res.status(404).json({ status: 'error', message: 'Foto do empreendimento nao encontrada' });
        }

        return res.status(200).json({
            status: 'success',
            data: createPhotoResponse(req, projectId, photo),
        });
    } catch (error) {
        console.error('[project-photos API] Error GET /:id/photos/:photoId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar foto do empreendimento' });
    }
});

router.post('/:id/photos/export', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const token = `pex-${crypto.randomUUID()}`;
        const selectionIds = normalizeSelectionIds(data.selectionIds);
        const exportFilters = buildExportFilters(data.filters, selectionIds);
        const matchedPhotos = await reportPhotoRepository.listByProject(projectId, exportFilters);
        const now = new Date();
        const payload = {
            id: `PPE-${crypto.randomUUID()}`,
            token,
            projectId,
            folderMode: normalizeText(data.folderMode) || 'tower',
            selectionIds,
            filters: exportFilters,
            itemCount: matchedPhotos.length,
            statusExecucao: 'queued',
            expiresAt: new Date(now.getTime() + (15 * 60 * 1000)).toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        const saved = await projectPhotoExportRepository.save(token, payload, { merge: true });

        return res.status(202).json({
            status: 'success',
            data: createResourceHateoasResponse(
                req,
                saved || payload,
                `projects/${projectId}/photos/exports/${token}`,
                {
                    allowDelete: false,
                    allowUpdate: false,
                    collectionPath: `projects/${projectId}/photos`,
                    extraLinks: {
                        project: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}`, method: 'GET' },
                        photos: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/photos`, method: 'GET' },
                        download: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/photos/exports/${token}?download=1`, method: 'GET' },
                    },
                },
            ),
        });
    } catch (error) {
        console.error('[project-photos API] Error POST /:id/photos/export:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao solicitar exportacao de fotos do empreendimento' });
    }
});

router.get('/:id/photos/exports/:token', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const token = normalizeText(req.params.token);
        const exported = await projectPhotoExportRepository.getByProjectAndToken(projectId, token);

        if (!exported) {
            return res.status(404).json({ status: 'error', message: 'Exportacao de fotos nao encontrada' });
        }

        if (wantsBinaryDownload(req.query || {})) {
            const archiveResult = await ensureProjectPhotoExportArchiveMedia(projectId, exported, req.user?.email || 'API');
            const readyAsset = archiveResult.asset;
            const content = await readStoredMediaContent(readyAsset);
            const now = new Date().toISOString();
            await projectPhotoExportRepository.save(token, {
                ...exported,
                statusExecucao: 'ready',
                outputMediaAssetId: readyAsset.id,
                generatedAt: archiveResult.generatedAt,
                generatedItemCount: archiveResult.generatedItemCount,
                skippedItemCount: archiveResult.skippedItemCount,
                downloadFileName: readyAsset.fileName,
                updatedAt: now,
                updatedBy: req.user?.email || 'API',
            }, { merge: true });

            return res
                .status(200)
                .set('Content-Type', 'application/zip')
                .set('Content-Disposition', `attachment; filename="${readyAsset.fileName}"`)
                .set('Cache-Control', 'no-store')
                .send(content.buffer);
        }

        return res.status(200).json({
            status: 'success',
            data: createResourceHateoasResponse(
                req,
                exported,
                `projects/${projectId}/photos/exports/${token}`,
                {
                    allowDelete: false,
                    allowUpdate: false,
                    collectionPath: `projects/${projectId}/photos`,
                    extraLinks: {
                        project: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}`, method: 'GET' },
                        photos: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/photos`, method: 'GET' },
                        download: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/photos/exports/${token}?download=1`, method: 'GET' },
                    },
                },
            ),
        });
    } catch (error) {
        console.error('[project-photos API] Error GET /:id/photos/exports/:token:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao consultar exportacao de fotos do empreendimento' });
    }
});

module.exports = router;
