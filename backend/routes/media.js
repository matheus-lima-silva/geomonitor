const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const router = express.Router();
const {
    verifyToken,
    requireActiveUser,
    requireActiveUserOrWorker,
    requireEditor,
    requireEditorOrWorker,
} = require('../utils/authMiddleware');
const { mediaAssetRepository } = require('../repositories');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const {
    createSignedAccessUrl,
    createSignedUploadUrl,
    getConfiguredMediaBackend,
    isTigrisAsset,
    isTigrisBackend,
    removeStoredMedia,
    sanitizeFileName,
    writeLocalContent,
    buildLocalContentPath,
} = require('../utils/mediaStorage');

function normalizeText(value) {
    return String(value || '').trim();
}

function createMediaResponse(req, asset, extraLinks = {}) {
    return createResourceHateoasResponse(req, asset, `media/${asset.id}`, {
        collectionPath: 'media',
        extraLinks,
    });
}

router.post('/upload-url', requireEditorOrWorker, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const fileName = sanitizeFileName(data.fileName);
        const mediaId = normalizeText(data.id) || `MED-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const storageKey = `${normalizeText(data.purpose) || 'generic'}/${mediaId}/${fileName}`;
        const mediaBackend = getConfiguredMediaBackend();

        const payload = {
            id: mediaId,
            fileName,
            contentType: normalizeText(data.contentType) || 'application/octet-stream',
            sizeBytes: Number.isFinite(Number(data.sizeBytes)) ? Number(data.sizeBytes) : 0,
            purpose: normalizeText(data.purpose) || 'generic',
            linkedResourceType: normalizeText(data.linkedResourceType),
            linkedResourceId: normalizeText(data.linkedResourceId),
            storageKey,
            statusExecucao: 'pending_upload',
            sourceKind: isTigrisBackend() ? 'tigris' : 'local',
            storageBackend: mediaBackend,
            createdAt: now,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        };

        const asset = await mediaAssetRepository.save(payload, { merge: true });
        const apiBaseUrl = resolveApiBaseUrl(req);

        const upload = isTigrisBackend()
            ? await createSignedUploadUrl({
                storageKey: asset.storageKey,
                contentType: asset.contentType,
            })
            : {
                href: `${apiBaseUrl}/media/${mediaId}/upload`,
                method: 'PUT',
            };

        return res.status(201).json({
            status: 'success',
            data: {
                ...createMediaResponse(req, asset, {
                    access: { href: `${apiBaseUrl}/media/${mediaId}/access-url`, method: 'GET' },
                    upload,
                }),
                upload,
            },
        });
    } catch (error) {
        console.error('[media API] Error POST /upload-url:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao preparar upload de media' });
    }
});

router.put('/:id/upload', requireEditorOrWorker, express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    try {
        const mediaId = normalizeText(req.params.id);
        const asset = await mediaAssetRepository.getById(mediaId);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media nao encontrada para upload' });
        }

        if (isTigrisAsset(asset)) {
            return res.status(409).json({
                status: 'error',
                message: 'Upload binario direto indisponivel quando a media usa Tigris. Use a URL assinada retornada por /upload-url.',
            });
        }

        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
        const storageResult = await writeLocalContent(mediaId, asset.fileName, buffer);

        const nextData = {
            ...asset,
            statusExecucao: 'ready',
            storedAt: storageResult.storedAt,
            storedSizeBytes: storageResult.storedSizeBytes,
            contentSha256: storageResult.sha256,
            sha256: storageResult.sha256,
            filePath: storageResult.filePath,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user?.email || 'API',
        };

        const savedAsset = await mediaAssetRepository.save(nextData, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createMediaResponse(req, savedAsset),
        });
    } catch (error) {
        console.error('[media API] Error PUT /:id/upload:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao receber upload de media' });
    }
});

router.post('/complete', requireEditorOrWorker, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const mediaId = normalizeText(data.id);
        if (!mediaId) {
            return res.status(400).json({ status: 'error', message: 'Media invalida.' });
        }

        const asset = await mediaAssetRepository.getById(mediaId);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media nao encontrada' });
        }

        const nextData = {
            ...asset,
            statusExecucao: asset.statusExecucao === 'ready'
                ? 'ready'
                : (isTigrisAsset(asset) ? 'ready' : 'completed'),
            completedAt: new Date().toISOString(),
            etag: normalizeText(data.etag || asset.etag),
            storedSizeBytes: Number.isFinite(Number(data.storedSizeBytes))
                ? Number(data.storedSizeBytes)
                : asset.storedSizeBytes,
            sha256: normalizeText(data.sha256 || asset.sha256 || asset.contentSha256),
            contentSha256: normalizeText(data.sha256 || asset.contentSha256 || asset.sha256),
            updatedAt: new Date().toISOString(),
            updatedBy: req.user?.email || 'API',
        };
        const savedAsset = await mediaAssetRepository.save(nextData, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createMediaResponse(req, savedAsset),
        });
    } catch (error) {
        console.error('[media API] Error POST /complete:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao concluir cadastro de media' });
    }
});

router.get('/:id/access-url', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const asset = await mediaAssetRepository.getById(req.params.id);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media nao encontrada' });
        }

        if (!normalizeText(asset.storageKey) && !normalizeText(asset.filePath)) {
            return res.status(404).json({ status: 'error', message: 'Conteudo da media ainda nao disponivel' });
        }

        const access = isTigrisAsset(asset)
            ? await createSignedAccessUrl({ storageKey: asset.storageKey })
            : {
                href: `${resolveApiBaseUrl(req)}/media/${req.params.id}/content`,
                method: 'GET',
                expiresAt: null,
            };

        return res.status(200).json({
            status: 'success',
            data: {
                id: req.params.id,
                accessUrl: access.href,
                method: access.method,
                expiresAt: access.expiresAt,
                backend: isTigrisAsset(asset) ? 'tigris' : 'local',
            },
        });
    } catch (error) {
        console.error('[media API] Error GET /:id/access-url:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao gerar URL de acesso da media' });
    }
});

router.get('/:id/content', requireActiveUserOrWorker, async (req, res) => {
    try {
        const asset = await mediaAssetRepository.getById(req.params.id);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media nao encontrada' });
        }

        if (isTigrisAsset(asset)) {
            const access = await createSignedAccessUrl({ storageKey: asset.storageKey });
            return res.redirect(302, access.href);
        }

        const filePath = asset.filePath ? normalizeText(asset.filePath) : buildLocalContentPath(asset.id, asset.fileName);
        const resolvedPath = buildLocalContentPath(asset.id, asset.fileName);

        // Verifica se o arquivo fisicamente existe no disco para evitar que o
        // express lance erro ao global handler lotando o log do terminal.
        try {
            await fs.access(resolvedPath);
        } catch (missingError) {
            return res.status(404).json({ status: 'error', message: 'Conteudo fisico da media ainda nao salvo ou apagado do disco.' });
        }

        // Se o filePath antigo persistido no banco não coincidir mais com a realidade
        // (ex: mudança de pasta no Windows), usamos a recriação dinâmica garantida.
        // Importante: Passamos { dotfiles: 'allow' } pois a pasta padrão do backend
        // se chama .storage e o express.sendFile recusa trafegar pastas ocultas por padrão.
        return res.type(asset.contentType || 'application/octet-stream').sendFile(resolvedPath, { dotfiles: 'allow' });
    } catch (error) {
        console.error('[media API] Error GET /:id/content:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao carregar conteudo da media' });
    }
});

router.delete('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const mediaId = normalizeText(req.params.id);
        const asset = await mediaAssetRepository.getById(mediaId);
        if (asset) {
            await removeStoredMedia(asset);
            await mediaAssetRepository.remove(mediaId);
        }
        return res.status(200).json({ status: 'success', message: 'Media removida com sucesso' });
    } catch (error) {
        console.error('[media API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover media' });
    }
});

module.exports = router;
