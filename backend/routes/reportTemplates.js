const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { reportTemplateRepository } = require('../repositories');

function normalizeText(value) {
    return String(value || '').trim();
}

function createTemplateResponse(req, template) {
    const templateId = normalizeText(template.id);
    return createResourceHateoasResponse(
        req,
        template,
        `report-templates/${templateId}`,
        {
            collectionPath: 'report-templates',
            extraLinks: {
                activate: { href: `${resolveApiBaseUrl(req)}/report-templates/${templateId}/activate`, method: 'POST' },
            },
        },
    );
}

function normalizeTemplatePayload(data = {}, meta = {}, fallback = {}) {
    return {
        ...fallback,
        id: normalizeText(data.id) || normalizeText(fallback.id) || `TPL-${crypto.randomUUID()}`,
        versionLabel: normalizeText(data.versionLabel) || normalizeText(fallback.versionLabel) || 'v1',
        sourceKind: normalizeText(data.sourceKind) || normalizeText(fallback.sourceKind) || 'docx_base',
        storageKey: normalizeText(data.storageKey) || normalizeText(fallback.storageKey),
        sha256: normalizeText(data.sha256) || normalizeText(fallback.sha256),
        isActive: typeof data.isActive === 'boolean' ? data.isActive : (fallback.isActive || false),
        notes: normalizeText(data.notes) || normalizeText(fallback.notes),
        updatedAt: new Date().toISOString(),
        updatedBy: meta.updatedBy || 'API',
    };
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const items = await reportTemplateRepository.list();
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createTemplateResponse(req, item)),
        });
    } catch (error) {
        console.error('[report-templates API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar templates' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const template = await reportTemplateRepository.getById(req.params.id);
        if (!template) {
            return res.status(404).json({ status: 'error', message: 'Template nao encontrado' });
        }
        return res.status(200).json({
            status: 'success',
            data: createTemplateResponse(req, template),
        });
    } catch (error) {
        console.error('[report-templates API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar template' });
    }
});

router.post('/', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const payload = normalizeTemplatePayload(data, { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' });
        const saved = await reportTemplateRepository.save(payload, { merge: true });
        return res.status(201).json({ status: 'success', data: createTemplateResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-templates API] Error POST /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar template' });
    }
});

router.put('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const fallback = await reportTemplateRepository.getById(req.params.id) || {};
        const payload = normalizeTemplatePayload(
            { ...data, id: req.params.id },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            fallback,
        );
        const saved = await reportTemplateRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createTemplateResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-templates API] Error PUT /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao atualizar template' });
    }
});

router.delete('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const template = await reportTemplateRepository.getById(req.params.id);
        if (!template) {
            return res.status(404).json({ status: 'error', message: 'Template nao encontrado' });
        }
        await reportTemplateRepository.remove(req.params.id);
        return res.status(204).send();
    } catch (error) {
        console.error('[report-templates API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover template' });
    }
});

router.post('/:id/activate', verifyToken, requireEditor, async (req, res) => {
    try {
        const activated = await reportTemplateRepository.activate(req.params.id);
        if (!activated) {
            return res.status(404).json({ status: 'error', message: 'Template nao encontrado' });
        }
        return res.status(200).json({ status: 'success', data: createTemplateResponse(req, activated) });
    } catch (error) {
        console.error('[report-templates API] Error POST /:id/activate:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao ativar template' });
    }
});

module.exports = router;
