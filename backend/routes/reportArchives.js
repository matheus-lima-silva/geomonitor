const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { attachDeliveredSchema } = require('../schemas/reportArchiveSchemas');
const { reportArchiveRepository, mediaAssetRepository } = require('../repositories');

function normalizeText(value) {
    return String(value || '').trim();
}

function createArchiveResponse(req, archive) {
    if (!archive) return null;
    const apiBaseUrl = resolveApiBaseUrl(req);
    const archiveId = normalizeText(archive.id);
    const extraLinks = {
        compound: {
            href: `${apiBaseUrl}/report-compounds/${archive.compoundId}`,
            method: 'GET',
        },
        downloadGenerated: {
            href: `${apiBaseUrl}/report-archives/${archiveId}/download?variant=generated`,
            method: 'GET',
        },
    };
    if (archive.deliveredMediaId) {
        extraLinks.downloadDelivered = {
            href: `${apiBaseUrl}/report-archives/${archiveId}/download?variant=delivered`,
            method: 'GET',
        };
    } else {
        extraLinks.attachDelivered = {
            href: `${apiBaseUrl}/report-archives/${archiveId}/attach-delivered`,
            method: 'POST',
        };
    }
    return createResourceHateoasResponse(req, archive, `report-archives/${archiveId}`, {
        allowDelete: false,
        allowUpdate: false,
        collectionPath: 'report-archives',
        extraLinks,
    });
}

router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const compoundId = normalizeText(req.query.compoundId);
    const items = await reportArchiveRepository.list(compoundId ? { compoundId } : {});
    return res.status(200).json({
        status: 'success',
        data: items.map((archive) => createArchiveResponse(req, archive)),
    });
}));

router.get('/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const archive = await reportArchiveRepository.getById(req.params.id);
    if (!archive) {
        return res.status(404).json({ status: 'error', message: 'Entrega nao encontrada' });
    }
    return res.status(200).json({ status: 'success', data: createArchiveResponse(req, archive) });
}));

router.post(
    '/:id/attach-delivered',
    verifyToken,
    requireEditor,
    validateBody(attachDeliveredSchema),
    asyncHandler(async (req, res) => {
        const archive = await reportArchiveRepository.getById(req.params.id);
        if (!archive) {
            return res.status(404).json({ status: 'error', message: 'Entrega nao encontrada' });
        }
        if (archive.deliveredMediaId) {
            return res.status(409).json({
                status: 'error',
                code: 'DELIVERED_MEDIA_ALREADY_SET',
                message: 'Esta entrega ja tem um arquivo final vinculado e nao pode ser sobrescrita.',
            });
        }

        const { mediaId, sha256, notes } = req.body.data;
        const asset = await mediaAssetRepository.getById(mediaId);
        if (!asset) {
            return res.status(400).json({ status: 'error', message: 'Media asset nao encontrado' });
        }

        // Valida integridade: se o asset ja tem sha256 registrado (backend
        // calculou no upload ou o worker populou), precisa bater com o
        // informado pelo cliente. Se ainda nao tem, confia no cliente mas
        // loga para auditoria.
        if (asset.sha256 && normalizeText(asset.sha256) !== normalizeText(sha256)) {
            return res.status(400).json({
                status: 'error',
                code: 'SHA256_MISMATCH',
                message: 'O sha256 informado nao bate com o do media asset.',
            });
        }

        const updated = await reportArchiveRepository.attachDeliveredMedia(archive.id, {
            mediaId,
            sha256,
            notes,
        });
        if (!updated) {
            // Se vier null, significa que entre a leitura e o update outra
            // requisicao preencheu delivered_media_id (race) — trata como 409.
            return res.status(409).json({
                status: 'error',
                code: 'DELIVERED_MEDIA_ALREADY_SET',
                message: 'Esta entrega ja tem um arquivo final vinculado.',
            });
        }
        return res.status(200).json({ status: 'success', data: createArchiveResponse(req, updated) });
    }),
);

router.get('/:id/download', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const archive = await reportArchiveRepository.getById(req.params.id);
    if (!archive) {
        return res.status(404).json({ status: 'error', message: 'Entrega nao encontrada' });
    }
    const variant = normalizeText(req.query.variant) || 'generated';
    let mediaId = '';
    if (variant === 'generated') {
        mediaId = normalizeText(archive.generatedMediaId);
    } else if (variant === 'delivered') {
        mediaId = normalizeText(archive.deliveredMediaId);
    } else {
        return res.status(400).json({ status: 'error', message: 'variant invalido. Use generated ou delivered.' });
    }

    if (!mediaId) {
        return res.status(404).json({
            status: 'error',
            message: variant === 'delivered'
                ? 'Esta entrega ainda nao tem arquivo final vinculado.'
                : 'Mídia gerada nao disponivel.',
        });
    }

    const apiBaseUrl = resolveApiBaseUrl(req);
    const target = `${apiBaseUrl}/media/${mediaId}/access-url`;
    return res.redirect(302, target);
}));

module.exports = router;
