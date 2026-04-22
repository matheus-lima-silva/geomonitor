// Anexos de LO: 2 slots fixos por licenca (documentoLO, planoGerenciamento).
// Cada slot referencia um media asset ja criado pelo fluxo padrao em
// backend/routes/media.js (upload-url -> PUT -> complete). Este router so
// vincula/desvincula o mediaAssetId no payload da LO e expoe um download
// "apelido" que redireciona pra access-url da media.

const express = require('express');
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const {
    LICENSE_ATTACHMENT_SLOTS,
    licenseAttachmentAttachSchema,
} = require('../schemas/licenseAttachmentSchemas');
const { operatingLicenseRepository, mediaAssetRepository } = require('../repositories');
const {
    createSignedAccessUrl,
    isTigrisAsset,
    removeStoredMedia,
} = require('../utils/mediaStorage');

function normalizeText(value) {
    return String(value || '').trim();
}

function summarizeAsset(asset) {
    if (!asset) return null;
    return {
        mediaAssetId: asset.id,
        fileName: asset.fileName || '',
        contentType: asset.contentType || '',
        sizeBytes: Number(asset.storedSizeBytes || asset.sizeBytes || 0),
        sha256: asset.sha256 || asset.contentSha256 || '',
    };
}

function createAttachmentResponse(req, licenseId, slot, entry) {
    if (!entry) return null;
    const apiBaseUrl = resolveApiBaseUrl(req);
    const resourcePath = `licenses/${encodeURIComponent(licenseId)}/attachments/${encodeURIComponent(slot)}`;
    const extraLinks = {
        license: {
            href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}`,
            method: 'GET',
        },
        download: {
            href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/attachments/${encodeURIComponent(slot)}/download`,
            method: 'GET',
        },
        media: {
            href: `${apiBaseUrl}/media/${encodeURIComponent(entry.mediaAssetId)}`,
            method: 'GET',
        },
    };
    return createResourceHateoasResponse(req, { ...entry, slot }, resourcePath, {
        allowUpdate: false,
        allowDelete: true,
        extraLinks,
    });
}

async function getLicenseOrFail(licenseId, res) {
    const license = await operatingLicenseRepository.getById(licenseId);
    if (!license) {
        res.status(404).json({ status: 'error', message: 'Licenca nao encontrada' });
        return null;
    }
    return license;
}

function getArquivos(license) {
    const obj = license?.arquivos;
    return (obj && typeof obj === 'object') ? obj : {};
}

const router = express.Router({ mergeParams: true });

// GET /api/licenses/:id/attachments  — lista os slots preenchidos
router.get(
    '/:id/attachments',
    verifyToken,
    requireActiveUser,
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.id);
        const license = await getLicenseOrFail(licenseId, res);
        if (!license) return;
        const arquivos = getArquivos(license);
        const items = [];
        for (const slot of LICENSE_ATTACHMENT_SLOTS) {
            const entry = arquivos[slot];
            if (entry && entry.mediaAssetId) items.push(createAttachmentResponse(req, licenseId, slot, entry));
        }
        const apiBaseUrl = resolveApiBaseUrl(req);
        return res.status(200).json({
            status: 'success',
            data: items,
            _links: {
                self: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/attachments`,
                    method: 'GET',
                },
                license: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}`,
                    method: 'GET',
                },
                attach: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/attachments`,
                    method: 'POST',
                },
            },
        });
    }),
);

// POST /api/licenses/:id/attachments  — vincula mediaAssetId a um slot
router.post(
    '/:id/attachments',
    verifyToken,
    requireEditor,
    validateBody(licenseAttachmentAttachSchema),
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.id);
        const license = await getLicenseOrFail(licenseId, res);
        if (!license) return;

        const { data, meta = {} } = req.body;
        const slot = data.slot;
        const mediaAssetId = normalizeText(data.mediaAssetId);

        const asset = await mediaAssetRepository.getById(mediaAssetId);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media asset nao encontrado' });
        }

        if ((asset.contentType || '').toLowerCase() !== 'application/pdf') {
            return res.status(415).json({
                status: 'error',
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: 'Anexos de LO devem ser PDF (application/pdf).',
            });
        }

        const arquivos = { ...getArquivos(license) };
        // Se ja havia um arquivo nesse slot, remove o asset anterior (best-effort)
        const previous = arquivos[slot];
        if (previous && previous.mediaAssetId && previous.mediaAssetId !== mediaAssetId) {
            const prevAsset = await mediaAssetRepository.getById(previous.mediaAssetId).catch(() => null);
            if (prevAsset) {
                try { await removeStoredMedia(prevAsset); } catch (_err) { /* best-effort */ }
                try { await mediaAssetRepository.remove(prevAsset.id); } catch (_err) { /* best-effort */ }
            }
        }

        const entry = {
            ...summarizeAsset(asset),
            attachedAt: new Date().toISOString(),
            attachedBy: meta.updatedBy || req.user?.email || 'API',
        };
        arquivos[slot] = entry;

        const nextLicense = {
            ...license,
            arquivos,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user?.email || 'API',
        };
        await operatingLicenseRepository.save(nextLicense, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createAttachmentResponse(req, licenseId, slot, entry),
        });
    }),
);

// GET /api/licenses/:id/attachments/:slot/download  — redireciona pra signed URL
router.get(
    '/:id/attachments/:slot/download',
    verifyToken,
    requireActiveUser,
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.id);
        const slot = normalizeText(req.params.slot);
        if (!LICENSE_ATTACHMENT_SLOTS.includes(slot)) {
            return res.status(400).json({ status: 'error', message: `Slot invalido. Use: ${LICENSE_ATTACHMENT_SLOTS.join(', ')}` });
        }
        const license = await getLicenseOrFail(licenseId, res);
        if (!license) return;
        const entry = getArquivos(license)[slot];
        if (!entry || !entry.mediaAssetId) {
            return res.status(404).json({ status: 'error', message: 'Slot vazio.' });
        }
        const asset = await mediaAssetRepository.getById(entry.mediaAssetId);
        if (!asset) {
            return res.status(404).json({ status: 'error', message: 'Media asset nao encontrado.' });
        }
        const apiBaseUrl = resolveApiBaseUrl(req);
        // Delega para /api/media/:id/content (que ja trata Tigris/local).
        const target = isTigrisAsset(asset)
            ? (await createSignedAccessUrl({ storageKey: asset.storageKey })).href
            : `${apiBaseUrl}/media/${encodeURIComponent(asset.id)}/content`;
        return res.redirect(302, target);
    }),
);

// DELETE /api/licenses/:id/attachments/:slot  — desvincula e apaga o asset
router.delete(
    '/:id/attachments/:slot',
    verifyToken,
    requireEditor,
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.id);
        const slot = normalizeText(req.params.slot);
        if (!LICENSE_ATTACHMENT_SLOTS.includes(slot)) {
            return res.status(400).json({ status: 'error', message: `Slot invalido. Use: ${LICENSE_ATTACHMENT_SLOTS.join(', ')}` });
        }
        const license = await getLicenseOrFail(licenseId, res);
        if (!license) return;
        const arquivos = { ...getArquivos(license) };
        const entry = arquivos[slot];
        if (!entry || !entry.mediaAssetId) {
            return res.status(404).json({ status: 'error', message: 'Slot vazio.' });
        }
        const asset = await mediaAssetRepository.getById(entry.mediaAssetId).catch(() => null);
        if (asset) {
            try { await removeStoredMedia(asset); } catch (_err) { /* best-effort */ }
            try { await mediaAssetRepository.remove(asset.id); } catch (_err) { /* best-effort */ }
        }
        delete arquivos[slot];
        const nextLicense = {
            ...license,
            arquivos,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user?.email || 'API',
        };
        await operatingLicenseRepository.save(nextLicense, { merge: true });
        return res.status(204).send();
    }),
);

module.exports = router;
