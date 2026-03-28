const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const { reportCompoundRepository, reportWorkspaceRepository, reportJobRepository } = require('../repositories');

function normalizeWorkspaceIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
}

function normalizeCompoundOrderJson(orderJson, workspaceIds) {
    const normalizedWorkspaceIds = normalizeWorkspaceIds(workspaceIds);
    const normalizedOrder = normalizeWorkspaceIds(orderJson);
    const workspaceIdSet = new Set(normalizedWorkspaceIds);
    const filteredOrder = normalizedOrder.filter((workspaceId) => workspaceIdSet.has(workspaceId));
    const missingWorkspaceIds = normalizedWorkspaceIds.filter((workspaceId) => !filteredOrder.includes(workspaceId));
    return [...filteredOrder, ...missingWorkspaceIds];
}

function createCompoundResponse(req, compound) {
    const compoundId = normalizeText(compound.id);
    return createResourceHateoasResponse(
        req,
        compound,
        `report-compounds/${compoundId}`,
        {
            collectionPath: 'report-compounds',
            extraLinks: {
                addWorkspace: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/add-workspace`, method: 'POST' },
                reorder: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/reorder`, method: 'POST' },
                preflight: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/preflight`, method: 'POST' },
                generate: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/generate`, method: 'POST' },
            },
        },
    );
}

function normalizeCompoundPayload(data = {}, meta = {}, fallback = {}) {
    const workspaceIds = normalizeWorkspaceIds(data.workspaceIds || fallback.workspaceIds);
    const orderJson = normalizeCompoundOrderJson(
        Array.isArray(data.orderJson) ? data.orderJson : fallback.orderJson,
        workspaceIds,
    );

    return {
        ...fallback,
        id: normalizeText(data.id) || normalizeText(fallback.id) || `RC-${crypto.randomUUID()}`,
        nome: normalizeText(data.nome) || normalizeText(fallback.nome) || 'Relatorio composto',
        status: normalizeText(data.status) || normalizeText(fallback.status) || 'draft',
        workspaceIds,
        orderJson,
        sharedTextsJson: data.sharedTextsJson && typeof data.sharedTextsJson === 'object'
            ? data.sharedTextsJson
            : (fallback.sharedTextsJson || {}),
        templateId: normalizeText(data.templateId) || normalizeText(fallback.templateId),
        draftState: data.draftState && typeof data.draftState === 'object' ? data.draftState : (fallback.draftState || {}),
        updatedAt: new Date().toISOString(),
        updatedBy: meta.updatedBy || 'API',
    };
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const items = await reportCompoundRepository.list();
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createCompoundResponse(req, item)),
        });
    } catch (error) {
        console.error('[report-compounds API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar relatorios compostos' });
    }
});

router.post('/', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const payload = normalizeCompoundPayload(data, { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' });
        const saved = await reportCompoundRepository.save(payload, { merge: true });
        return res.status(201).json({ status: 'success', data: createCompoundResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar relatorio composto' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const compound = await reportCompoundRepository.getById(req.params.id);
        if (!compound) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }
        return res.status(200).json({
            status: 'success',
            data: createCompoundResponse(req, compound),
        });
    } catch (error) {
        console.error('[report-compounds API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar relatorio composto' });
    }
});

router.put('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const fallback = await reportCompoundRepository.getById(req.params.id) || {};
        const payload = normalizeCompoundPayload(
            { ...data, id: req.params.id },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            fallback,
        );
        const saved = await reportCompoundRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-compounds API] Error PUT /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao atualizar relatorio composto' });
    }
});

router.post('/:id/add-workspace', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const nextWorkspaceIds = normalizeWorkspaceIds([...(current.workspaceIds || []), ...(data.workspaceIds || []), data.workspaceId]);
        const payload = normalizeCompoundPayload(
            { ...current, workspaceIds: nextWorkspaceIds, id: req.params.id },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            current,
        );

        const saved = await reportCompoundRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/add-workspace:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao adicionar workspace ao relatorio composto' });
    }
});

router.post('/:id/reorder', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const payload = normalizeCompoundPayload(
            { ...current, orderJson: Array.isArray(data.orderJson) ? data.orderJson : current.orderJson, id: req.params.id },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            current,
        );
        const saved = await reportCompoundRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/reorder:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao reordenar relatorio composto' });
    }
});

router.post('/:id/preflight', verifyToken, requireEditor, async (req, res) => {
    try {
        const compound = await reportCompoundRepository.getById(req.params.id);
        if (!compound) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const workspaceIds = normalizeWorkspaceIds(compound.workspaceIds);
        const workspaceDocs = await Promise.all(workspaceIds.map((workspaceId) => reportWorkspaceRepository.getById(workspaceId)));
        const warnings = [];
        const foundWorkspaceCount = workspaceDocs.filter(Boolean).length;

        if (workspaceIds.length === 0) warnings.push('Nenhum workspace adicionado ao relatorio composto.');
        if (foundWorkspaceCount !== workspaceIds.length) warnings.push('Alguns workspaces informados nao foram encontrados.');

        return res.status(200).json({
            status: 'success',
            data: {
                id: req.params.id,
                workspaceCount: workspaceIds.length,
                foundWorkspaceCount,
                warnings,
                errors: [],
                canGenerate: workspaceIds.length > 0,
                _links: {
                    self: { href: `${resolveApiBaseUrl(req)}/report-compounds/${req.params.id}`, method: 'GET' },
                    generate: { href: `${resolveApiBaseUrl(req)}/report-compounds/${req.params.id}/generate`, method: 'POST' },
                },
            },
        });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/preflight:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao executar preflight do relatorio composto' });
    }
});

router.post('/:id/generate', verifyToken, requireEditor, async (req, res) => {
    try {
        const compound = await reportCompoundRepository.getById(req.params.id);
        if (!compound) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const now = new Date().toISOString();
        const jobId = `JOB-${crypto.randomUUID()}`;
        await reportJobRepository.save({
            id: jobId,
            kind: 'report_compound',
            compoundId: req.params.id,
            statusExecucao: 'queued',
            createdAt: now,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        }, { merge: true });

        const nextPayload = {
            ...compound,
            status: 'queued',
            lastJobId: jobId,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        };
        const saved = await reportCompoundRepository.save(nextPayload, { merge: true });

        return res.status(202).json({
            status: 'success',
            data: createCompoundResponse(req, saved || nextPayload),
        });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/generate:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao enfileirar geracao do relatorio composto' });
    }
});

module.exports = router;
