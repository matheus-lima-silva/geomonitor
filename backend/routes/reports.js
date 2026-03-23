const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createHateoasResponse } = require('../utils/hateoas');
const { isPostgresBackend, postgresStore } = require('../repositories/common');
const { reportJobRepository } = require('../repositories');

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

async function getLegacyReport(id) {
    if (isPostgresBackend()) {
        const doc = await postgresStore.getDoc('reports', id);
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    const { getDataStore } = require('../data');
    const doc = await getDataStore().getDoc('reports', id);
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const job = await reportJobRepository.getById(req.params.id);
        const report = job || await getLegacyReport(req.params.id);
        if (!report) {
            return res.status(404).json({ status: 'error', message: 'Relatorio nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, report, 'reports', report.id),
        });
    } catch (error) {
        console.error('[reports API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar relatorio' });
    }
});

router.post('/preflight', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
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
        });
    } catch (error) {
        console.error('[reports API] Error POST /preflight:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao executar preflight de relatorio' });
    }
});

router.post('/generate', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
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
    } catch (error) {
        console.error('[reports API] Error POST /generate:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao enfileirar geracao de relatorio' });
    }
});

module.exports = router;
