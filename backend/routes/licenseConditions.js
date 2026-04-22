const express = require('express');
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const {
    licenseConditionCreateSchema,
    licenseConditionUpdateSchema,
    licenseConditionBulkReplaceSchema,
} = require('../schemas/licenseConditionSchemas');
const { licenseConditionRepository, operatingLicenseRepository } = require('../repositories');

function normalizeText(value) {
    return String(value || '').trim();
}

function buildConditionId({ licenseId, numero, id }) {
    const explicit = normalizeText(id);
    if (explicit) return explicit.toUpperCase();
    const licPart = normalizeText(licenseId).toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    const numPart = normalizeText(numero).toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    return `COND-${licPart || 'UNKNOWN'}-${numPart || Date.now()}`;
}

function createConditionResponse(req, condition) {
    if (!condition) return null;
    const apiBaseUrl = resolveApiBaseUrl(req);
    const resourcePath = `license-conditions/${encodeURIComponent(condition.id)}`;
    const extraLinks = {
        license: {
            href: `${apiBaseUrl}/licenses/${encodeURIComponent(condition.licenseId)}`,
            method: 'GET',
        },
        licenseConditions: {
            href: `${apiBaseUrl}/licenses/${encodeURIComponent(condition.licenseId)}/conditions`,
            method: 'GET',
        },
    };
    return createResourceHateoasResponse(req, condition, resourcePath, {
        collectionPath: 'license-conditions',
        extraLinks,
    });
}

async function ensureLicenseExists(licenseId, res) {
    const license = await operatingLicenseRepository.getById(licenseId);
    if (!license) {
        res.status(404).json({ status: 'error', message: 'Licenca nao encontrada' });
        return null;
    }
    return license;
}

// =========================================================================
// Nested router: montado em /api/licenses (sub-paths /:licenseId/conditions)
// =========================================================================
const nestedRouter = express.Router({ mergeParams: true });

nestedRouter.get(
    '/:licenseId/conditions',
    verifyToken,
    requireActiveUser,
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.licenseId);
        const license = await ensureLicenseExists(licenseId, res);
        if (!license) return;
        const items = await licenseConditionRepository.listByLicense(licenseId);
        const apiBaseUrl = resolveApiBaseUrl(req);
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createConditionResponse(req, item)),
            _links: {
                self: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/conditions`,
                    method: 'GET',
                },
                license: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}`,
                    method: 'GET',
                },
                create: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/conditions`,
                    method: 'POST',
                },
                bulkReplace: {
                    href: `${apiBaseUrl}/licenses/${encodeURIComponent(licenseId)}/conditions`,
                    method: 'PUT',
                },
            },
        });
    }),
);

nestedRouter.post(
    '/:licenseId/conditions',
    verifyToken,
    requireEditor,
    validateBody(licenseConditionCreateSchema),
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.licenseId);
        const license = await ensureLicenseExists(licenseId, res);
        if (!license) return;
        const { data, meta = {} } = req.body;
        const condition = {
            ...data,
            licenseId,
            id: buildConditionId({ licenseId, numero: data.numero, id: data.id }),
        };
        const saved = await licenseConditionRepository.save(condition, {
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        });
        return res.status(201).json({ status: 'success', data: createConditionResponse(req, saved) });
    }),
);

nestedRouter.put(
    '/:licenseId/conditions',
    verifyToken,
    requireEditor,
    validateBody(licenseConditionBulkReplaceSchema),
    asyncHandler(async (req, res) => {
        const licenseId = normalizeText(req.params.licenseId);
        const license = await ensureLicenseExists(licenseId, res);
        if (!license) return;
        const { data, meta = {} } = req.body;
        const normalized = data.map((cond, idx) => ({
            ...cond,
            licenseId,
            id: buildConditionId({ licenseId, numero: cond.numero, id: cond.id }),
            ordem: Number.isInteger(cond.ordem) ? cond.ordem : idx,
        }));
        const items = await licenseConditionRepository.bulkReplace(licenseId, normalized, {
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        });
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createConditionResponse(req, item)),
        });
    }),
);

// =========================================================================
// Flat router: montado em /api/license-conditions (item por id)
// =========================================================================
const flatRouter = express.Router();

flatRouter.get(
    '/:id',
    verifyToken,
    requireActiveUser,
    asyncHandler(async (req, res) => {
        const condition = await licenseConditionRepository.getById(req.params.id);
        if (!condition) {
            return res.status(404).json({ status: 'error', message: 'Condicionante nao encontrada' });
        }
        return res.status(200).json({ status: 'success', data: createConditionResponse(req, condition) });
    }),
);

flatRouter.put(
    '/:id',
    verifyToken,
    requireEditor,
    validateBody(licenseConditionUpdateSchema),
    asyncHandler(async (req, res) => {
        const existing = await licenseConditionRepository.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'Condicionante nao encontrada' });
        }
        const { data, meta = {} } = req.body;
        const merged = {
            ...existing,
            ...data,
            id: existing.id,
            licenseId: existing.licenseId,
        };
        const saved = await licenseConditionRepository.save(merged, {
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        });
        return res.status(200).json({ status: 'success', data: createConditionResponse(req, saved) });
    }),
);

flatRouter.delete(
    '/:id',
    verifyToken,
    requireEditor,
    asyncHandler(async (req, res) => {
        const existing = await licenseConditionRepository.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'Condicionante nao encontrada' });
        }
        await licenseConditionRepository.remove(existing.id);
        return res.status(204).send();
    }),
);

module.exports = {
    nestedRouter,
    flatRouter,
};
