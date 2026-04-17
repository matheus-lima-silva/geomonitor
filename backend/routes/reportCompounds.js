const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const {
    reportCompoundRepository,
    reportWorkspaceRepository,
    reportJobRepository,
    reportArchiveRepository,
    mediaAssetRepository,
} = require('../repositories');
const { triggerWorkerRun } = require('../utils/workerTrigger');
const { flushWorkspaceDraftsToPhotos } = require('../utils/reportJobContext');

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
                removeWorkspace: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/remove-workspace`, method: 'POST' },
                trash: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/trash`, method: 'POST' },
                restore: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/restore`, method: 'POST' },
                reorder: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/reorder`, method: 'POST' },
                preflight: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/preflight`, method: 'POST' },
                generate: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/generate`, method: 'POST' },
                deliver: { href: `${resolveApiBaseUrl(req)}/report-compounds/${compoundId}/deliver`, method: 'POST' },
                archives: { href: `${resolveApiBaseUrl(req)}/report-archives?compoundId=${compoundId}`, method: 'GET' },
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

router.post('/:id/remove-workspace', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }
        const workspaceIdToRemove = normalizeText(data.workspaceId);
        const nextWorkspaceIds = normalizeWorkspaceIds((current.workspaceIds || []).filter((id) => id !== workspaceIdToRemove));
        const payload = normalizeCompoundPayload(
            { ...current, workspaceIds: nextWorkspaceIds, id: req.params.id },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            current,
        );
        const saved = await reportCompoundRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || payload) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/remove-workspace:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover workspace do relatorio composto' });
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

const ALLOWED_TOWER_COORDINATE_FORMATS = new Set(['decimal', 'dms', 'utm']);

router.post('/:id/generate', verifyToken, requireEditor, async (req, res) => {
    try {
        const compound = await reportCompoundRepository.getById(req.params.id);
        if (!compound) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const ensureTowerCoordinates = body.ensureTowerCoordinates === true;
        let towerCoordinateFormat = normalizeText(body.towerCoordinateFormat).toLowerCase();
        if (towerCoordinateFormat && !ALLOWED_TOWER_COORDINATE_FORMATS.has(towerCoordinateFormat)) {
            return res.status(400).json({
                status: 'error',
                message: `Formato de coordenada invalido: '${towerCoordinateFormat}'. Use 'decimal', 'dms' ou 'utm'.`,
            });
        }

        // Flush curation drafts to report_photos before generating
        const workspaceIds = normalizeWorkspaceIds(compound.workspaceIds);
        for (const workspaceId of workspaceIds) {
            await flushWorkspaceDraftsToPhotos(workspaceId);
        }

        let compoundForJob = compound;
        if (ensureTowerCoordinates) {
            const currentShared = compound.sharedTextsJson && typeof compound.sharedTextsJson === 'object'
                ? compound.sharedTextsJson
                : {};
            const resolvedFormat = towerCoordinateFormat
                || normalizeText(currentShared.towerCoordinateFormat).toLowerCase()
                || 'decimal';
            const mergedShared = {
                ...currentShared,
                includeTowerCoordinates: true,
                towerCoordinateFormat: resolvedFormat,
            };
            const savedCompound = await reportCompoundRepository.save({
                ...compound,
                sharedTextsJson: mergedShared,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user?.email || 'API',
            }, { merge: true });
            compoundForJob = savedCompound || { ...compound, sharedTextsJson: mergedShared };
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
            ...compoundForJob,
            status: 'queued',
            lastJobId: jobId,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        };
        const saved = await reportCompoundRepository.save(nextPayload, { merge: true });

        triggerWorkerRun();

        return res.status(202).json({
            status: 'success',
            data: createCompoundResponse(req, saved || nextPayload),
        });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/generate:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao enfileirar geracao do relatorio composto' });
    }
});

// Cria um snapshot imutavel (report_archive) do compound + do media gerado,
// sequenciando a versao automaticamente. O upload do PDF final entregue
// externamente e feito em duas etapas subsequentes pelo frontend:
//   (a) POST /api/media/upload-url para criar media_asset pending_upload
//   (b) PUT no signed URL com o binario
//   (c) POST /api/report-archives/:archiveId/attach-delivered com {mediaId, sha256}
router.post('/:id/deliver', verifyToken, requireEditor, async (req, res) => {
    try {
        const compound = await reportCompoundRepository.getById(req.params.id);
        if (!compound) {
            return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        }

        const generatedMediaId = normalizeText(compound.outputDocxMediaId);
        if (!generatedMediaId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_GENERATED_DOCX',
                message: 'Gere o relatorio antes de criar uma entrega.',
            });
        }

        let generatedSha256 = '';
        try {
            const generatedAsset = await mediaAssetRepository.getById(generatedMediaId);
            generatedSha256 = normalizeText(generatedAsset?.sha256);
        } catch (_err) {
            // sha256 e opcional no snapshot; segue sem bloquear.
        }

        const previousMax = await reportArchiveRepository.getMaxVersionForCompound(compound.id);
        const nextVersion = Number(previousMax) + 1;

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};

        const archiveId = `RA-${crypto.randomUUID()}`;
        const snapshotPayload = {
            id: compound.id,
            nome: compound.nome,
            status: compound.status,
            workspaceIds: Array.isArray(compound.workspaceIds) ? compound.workspaceIds : [],
            orderJson: Array.isArray(compound.orderJson) ? compound.orderJson : [],
            sharedTextsJson: compound.sharedTextsJson && typeof compound.sharedTextsJson === 'object'
                ? compound.sharedTextsJson
                : {},
            templateId: compound.templateId || null,
            outputDocxMediaId: generatedMediaId,
            lastJobId: compound.lastJobId || null,
            capturedAt: new Date().toISOString(),
        };

        const created = await reportArchiveRepository.create({
            id: archiveId,
            compoundId: compound.id,
            version: nextVersion,
            deliveredBy: req.user?.email || normalizeText(body.meta?.updatedBy) || 'API',
            generatedMediaId,
            generatedSha256,
            deliveredMediaId: null,
            deliveredSha256: null,
            notes: normalizeText(data.notes),
            snapshotPayload,
        });

        const apiBaseUrl = resolveApiBaseUrl(req);
        const archiveUrl = `${apiBaseUrl}/report-archives/${archiveId}`;
        return res.status(201).json({
            status: 'success',
            data: {
                ...created,
                _links: {
                    self: { href: archiveUrl, method: 'GET' },
                    compound: { href: `${apiBaseUrl}/report-compounds/${compound.id}`, method: 'GET' },
                    attachDelivered: { href: `${archiveUrl}/attach-delivered`, method: 'POST' },
                    downloadGenerated: { href: `${archiveUrl}/download?variant=generated`, method: 'GET' },
                },
            },
        });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/deliver:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar entrega do relatorio composto' });
    }
});

router.post('/:id/trash', verifyToken, requireEditor, async (req, res) => {
    try {
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        const saved = await reportCompoundRepository.save(
            { ...current, deletedAt: new Date().toISOString(), updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || current) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao mover relatorio composto para lixeira' });
    }
});

router.post('/:id/restore', verifyToken, requireEditor, async (req, res) => {
    try {
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        const { deletedAt, ...rest } = current;
        const saved = await reportCompoundRepository.save(
            { ...rest, deletedAt: null, updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createCompoundResponse(req, saved || rest) });
    } catch (error) {
        console.error('[report-compounds API] Error POST /:id/restore:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao restaurar relatorio composto da lixeira' });
    }
});

router.delete('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const current = await reportCompoundRepository.getById(req.params.id);
        if (!current) return res.status(404).json({ status: 'error', message: 'Relatorio composto nao encontrado' });
        await reportCompoundRepository.remove(req.params.id);
        return res.status(204).send();
    } catch (error) {
        console.error('[report-compounds API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover relatorio composto' });
    }
});

module.exports = router;
