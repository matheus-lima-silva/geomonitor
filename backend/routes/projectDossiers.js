const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const {
    projectDossierRepository,
    reportJobRepository,
    reportWorkspaceRepository,
    reportPhotoRepository,
    inspectionRepository,
    operatingLicenseRepository,
    erosionRepository,
    reportDeliveryTrackingRepository,
} = require('../repositories');
const { triggerWorkerRun } = require('../utils/workerTrigger');

function createDossierResponse(req, projectId, dossier) {
    const dossierId = normalizeText(dossier.id);
    return createResourceHateoasResponse(
        req,
        dossier,
        `projects/${projectId}/dossiers/${dossierId}`,
        {
            collectionPath: `projects/${projectId}/dossiers`,
            extraLinks: {
                project: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}`, method: 'GET' },
                preflight: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}/preflight`, method: 'POST' },
                generate: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}/generate`, method: 'POST' },
                trash: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}/trash`, method: 'POST' },
                restore: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}/restore`, method: 'POST' },
            },
        },
    );
}

function normalizeScopeFlag(value, fallbackValue = true) {
    if (typeof value === 'boolean') return value;
    if (typeof fallbackValue === 'boolean') return fallbackValue;
    return true;
}

function normalizeDossierScopeJson(scopeJson = {}, fallbackScopeJson = {}) {
    const nextScope = scopeJson && typeof scopeJson === 'object' ? scopeJson : {};
    const fallback = fallbackScopeJson && typeof fallbackScopeJson === 'object' ? fallbackScopeJson : {};
    return {
        includeLicencas: normalizeScopeFlag(nextScope.includeLicencas, fallback.includeLicencas),
        includeInspecoes: normalizeScopeFlag(nextScope.includeInspecoes, fallback.includeInspecoes),
        includeErosoes: normalizeScopeFlag(nextScope.includeErosoes, fallback.includeErosoes),
        includeEntregas: normalizeScopeFlag(nextScope.includeEntregas, fallback.includeEntregas),
        includeWorkspaces: normalizeScopeFlag(nextScope.includeWorkspaces, fallback.includeWorkspaces),
        includeFotos: normalizeScopeFlag(nextScope.includeFotos, fallback.includeFotos),
    };
}

function normalizeDossierPayload(projectId, data = {}, meta = {}, fallback = {}) {
    return {
        ...fallback,
        id: normalizeText(data.id) || normalizeText(fallback.id) || `DOS-${crypto.randomUUID()}`,
        projectId,
        nome: normalizeText(data.nome) || normalizeText(fallback.nome) || `Dossie ${projectId}`,
        status: normalizeText(data.status) || normalizeText(fallback.status) || 'draft',
        scopeJson: normalizeDossierScopeJson(data.scopeJson, fallback.scopeJson),
        draftState: data.draftState && typeof data.draftState === 'object' ? data.draftState : (fallback.draftState || {}),
        observacoes: normalizeText(data.observacoes) || normalizeText(fallback.observacoes),
        updatedAt: new Date().toISOString(),
        updatedBy: meta.updatedBy || 'API',
    };
}

router.get('/:id/dossiers', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const items = await projectDossierRepository.listByProjectId(projectId);
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createDossierResponse(req, projectId, item)),
        });
    } catch (error) {
        console.error('[project-dossiers API] Error GET /:id/dossiers:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar dossies do empreendimento' });
    }
});

router.post('/:id/dossiers', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const payload = normalizeDossierPayload(projectId, data, { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' });
        const saved = await projectDossierRepository.save(payload, { merge: true });
        return res.status(201).json({ status: 'success', data: createDossierResponse(req, projectId, saved || payload) });
    } catch (error) {
        console.error('[project-dossiers API] Error POST /:id/dossiers:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar dossie do empreendimento' });
    }
});

router.get('/:id/dossiers/:dossierId', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const dossier = await projectDossierRepository.getByProjectAndId(projectId, dossierId);
        if (!dossier) {
            return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        }
        return res.status(200).json({ status: 'success', data: createDossierResponse(req, projectId, dossier) });
    } catch (error) {
        console.error('[project-dossiers API] Error GET /:id/dossiers/:dossierId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar dossie do empreendimento' });
    }
});

router.put('/:id/dossiers/:dossierId', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const fallback = await projectDossierRepository.getById(dossierId) || {};
        const payload = normalizeDossierPayload(
            projectId,
            { ...data, id: dossierId },
            { ...meta, updatedBy: meta.updatedBy || req.user?.email || 'API' },
            fallback,
        );

        const saved = await projectDossierRepository.save(payload, { merge: true });
        return res.status(200).json({ status: 'success', data: createDossierResponse(req, projectId, saved || payload) });
    } catch (error) {
        console.error('[project-dossiers API] Error PUT /:id/dossiers/:dossierId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao atualizar dossie do empreendimento' });
    }
});

router.post('/:id/dossiers/:dossierId/preflight', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const dossier = await projectDossierRepository.getByProjectAndId(projectId, dossierId);

        if (!dossier) {
            return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        }

        const normalizedScope = normalizeDossierScopeJson(dossier.scopeJson);

        const [inspectionCount, erosionCount, licenseCount, workspaceCount, photoCount, deliveryTrackingCount] = await Promise.all([
            inspectionRepository.countByProject(projectId),
            erosionRepository.countByProject(projectId),
            operatingLicenseRepository.countByProject(projectId),
            reportWorkspaceRepository.countByProject(projectId),
            reportPhotoRepository.countByProject(projectId),
            reportDeliveryTrackingRepository.countByProject(projectId),
        ]);

        const warnings = [];
        const selectedSectionCount = Object.values(normalizedScope).filter(Boolean).length;
        if (selectedSectionCount === 0) {
            warnings.push('O escopo do dossie esta vazio. Selecione ao menos uma secao editorial.');
        }
        if (normalizedScope.includeWorkspaces && workspaceCount === 0) warnings.push('Nenhum workspace vinculado ao empreendimento foi encontrado.');
        if (normalizedScope.includeFotos && photoCount === 0) warnings.push('Nenhuma foto agregada ao empreendimento foi encontrada.');
        if (normalizedScope.includeLicencas && licenseCount === 0) warnings.push('Nenhuma licenca vinculada ao empreendimento foi encontrada.');
        if (normalizedScope.includeInspecoes && inspectionCount === 0) warnings.push('Nenhuma inspecao vinculada ao empreendimento foi encontrada.');
        if (normalizedScope.includeErosoes && erosionCount === 0) warnings.push('Nenhuma erosao vinculada ao empreendimento foi encontrada.');
        if (normalizedScope.includeEntregas && deliveryTrackingCount === 0) warnings.push('Nenhum registro de entrega vinculado ao empreendimento foi encontrado.');

        return res.status(200).json({
            status: 'success',
            data: {
                dossierId,
                projectId,
                scope: normalizedScope,
                summary: {
                    inspectionCount,
                    erosionCount,
                    licenseCount,
                    workspaceCount,
                    photoCount,
                    deliveryTrackingCount,
                },
                warnings,
                errors: [],
                canGenerate: selectedSectionCount > 0,
                _links: {
                    self: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}`, method: 'GET' },
                    generate: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}/dossiers/${dossierId}/generate`, method: 'POST' },
                },
            },
        });
    } catch (error) {
        console.error('[project-dossiers API] Error POST /:id/dossiers/:dossierId/preflight:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao executar preflight do dossie' });
    }
});

router.post('/:id/dossiers/:dossierId/generate', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const dossier = await projectDossierRepository.getByProjectAndId(projectId, dossierId);

        if (!dossier) {
            return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        }

        const now = new Date().toISOString();
        const jobId = `JOB-${crypto.randomUUID()}`;
        await reportJobRepository.save({
            id: jobId,
            kind: 'project_dossier',
            projectId,
            dossierId,
            statusExecucao: 'queued',
            createdAt: now,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        }, { merge: true });

        const nextDossier = {
            ...dossier,
            status: 'queued',
            lastJobId: jobId,
            updatedAt: now,
            updatedBy: req.user?.email || 'API',
        };
        const saved = await projectDossierRepository.save(nextDossier, { merge: true });

        triggerWorkerRun();

        return res.status(202).json({
            status: 'success',
            data: createDossierResponse(req, projectId, saved || nextDossier),
        });
    } catch (error) {
        console.error('[project-dossiers API] Error POST /:id/dossiers/:dossierId/generate:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao enfileirar geracao do dossie' });
    }
});

router.post('/:id/dossiers/:dossierId/trash', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const current = await projectDossierRepository.getByProjectAndId(projectId, dossierId);
        if (!current) return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        const saved = await projectDossierRepository.save(
            { ...current, deletedAt: new Date().toISOString(), updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createDossierResponse(req, projectId, saved || current) });
    } catch (error) {
        console.error('[project-dossiers API] Error POST /:id/dossiers/:dossierId/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao mover dossie para lixeira' });
    }
});

router.post('/:id/dossiers/:dossierId/restore', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const current = await projectDossierRepository.getByProjectAndId(projectId, dossierId);
        if (!current) return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        const { deletedAt, ...rest } = current;
        const saved = await projectDossierRepository.save(
            { ...rest, deletedAt: null, updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createDossierResponse(req, projectId, saved || rest) });
    } catch (error) {
        console.error('[project-dossiers API] Error POST /:id/dossiers/:dossierId/restore:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao restaurar dossie da lixeira' });
    }
});

router.delete('/:id/dossiers/:dossierId', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const dossierId = normalizeText(req.params.dossierId);
        const current = await projectDossierRepository.getByProjectAndId(projectId, dossierId);
        if (!current) return res.status(404).json({ status: 'error', message: 'Dossie nao encontrado' });
        await projectDossierRepository.remove(dossierId);
        return res.status(204).send();
    } catch (error) {
        console.error('[project-dossiers API] Error DELETE /:id/dossiers/:dossierId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover dossie' });
    }
});

module.exports = router;
