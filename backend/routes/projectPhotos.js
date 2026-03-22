const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const { reportPhotoRepository, projectPhotoExportRepository } = require('../repositories');

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
        const matchedPhotos = await reportPhotoRepository.listByProject(projectId, data.filters || {});
        const now = new Date();
        const payload = {
            id: `PPE-${crypto.randomUUID()}`,
            token,
            projectId,
            folderMode: normalizeText(data.folderMode) || 'tower',
            selectionIds: Array.isArray(data.selectionIds) ? data.selectionIds.map((value) => normalizeText(value)).filter(Boolean) : [],
            filters: data.filters && typeof data.filters === 'object' ? data.filters : {},
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
                        download: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/photos/exports/${token}`, method: 'GET' },
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
