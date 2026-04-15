const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { reportJobRepository } = require('../repositories');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { reportPreflightSchema, reportGenerateSchema } = require('../schemas/reportSchemas');

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeSlots(slots = []) {
    if (!Array.isArray(slots)) return [];
    return slots.map((slot, index) => ({
        id: normalizeText(slot.id) || `slot-${index + 1}`,
        label: normalizeText(slot.label) || `Slot ${index + 1}`,
        projectId: normalizeText(slot.projectId),
        assetCount: Number.isFinite(Number(slot.assetCount)) ? Number(slot.assetCount) : 0,
    }));
}

router.get('/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const report = await reportJobRepository.getById(req.params.id);
    if (!report) {
        return res.status(404).json({ status: 'error', message: 'Relatorio nao encontrado' });
    }

    return res.status(200).json({
        status: 'success',
        data: createHateoasResponse(req, report, 'reports', report.id),
    });
}));

router.post('/preflight', verifyToken, requireEditor, validateBody(reportPreflightSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    const slots = normalizeSlots(data.slots);
    const warnings = [];
    const errors = [];

    if (slots.length === 0) {
        errors.push('Nenhum slot informado para preflight.');
    }

    const readySlots = slots.filter((slot) => slot.assetCount > 0);
    if (readySlots.length === 0 && slots.length > 0) {
        warnings.push('Nenhum slot possui assets contabilizados ainda.');
    }

    const baseUrl = resolveApiBaseUrl(req);
    return res.status(200).json({
        status: 'success',
        data: {
            workspaceId: normalizeText(data.workspaceId),
            slotCount: slots.length,
            readySlotCount: readySlots.length,
            warnings,
            errors,
            conflicts: [],
            canGenerate: errors.length === 0,
        },
        _links: {
            self: { href: `${baseUrl}/reports/preflight`, method: 'POST' },
            generate: { href: `${baseUrl}/reports/generate`, method: 'POST' },
        },
    });
}));

router.post('/generate', verifyToken, requireEditor, validateBody(reportGenerateSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    const reportId = normalizeText(data.id) || `REP-${crypto.randomUUID()}`;
    const slots = normalizeSlots(data.slots);
    const now = new Date().toISOString();

    const payload = {
        id: reportId,
        kind: 'report_legacy',
        workspaceId: normalizeText(data.workspaceId),
        nome: normalizeText(data.nome) || 'Relatorio GeoRelat',
        statusExecucao: 'queued',
        slotCount: slots.length,
        readySlotCount: slots.filter((slot) => slot.assetCount > 0).length,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.user?.email || 'API',
    };

    const saved = await reportJobRepository.save(payload, { merge: true });

    return res.status(202).json({
        status: 'success',
        data: createHateoasResponse(req, saved || payload, 'reports', reportId),
    });
}));

module.exports = router;
