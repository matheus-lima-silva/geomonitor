// Acessos por torre e rotas-guia do empreendimento (Fase 1b,
// docs/plans/erosao-acessos-geodados.md). Montado em /api/projects.
const crypto = require('crypto');
const express = require('express');
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { projectRepository, osmRoadRepository, towerAccessRepository } = require('../repositories');
const {
    towerAccessPreviewSchema,
    towerAccessCreateSchema,
    towerAccessUpdateSchema,
} = require('../schemas/towerAccessSchemas');
const { buildAccessPreview } = require('../utils/towerAccessPreview');
const { lineLength } = require('../utils/accessClassification');

const router = express.Router();

function projectIdOf(req) {
    return String(req.params.id || '').trim().toUpperCase();
}

function collectionLinks(req, projectId) {
    const base = `${resolveApiBaseUrl(req)}/projects/${encodeURIComponent(projectId)}/accesses`;
    return {
        self: { href: base, method: 'GET' },
        preview: { href: `${base}/preview`, method: 'POST' },
        create: { href: base, method: 'POST' },
        project: { href: `${resolveApiBaseUrl(req)}/projects/${encodeURIComponent(projectId)}`, method: 'GET' },
    };
}

function accessResponse(req, projectId, access) {
    return createResourceHateoasResponse(
        req,
        access,
        `projects/${encodeURIComponent(projectId)}/accesses/${encodeURIComponent(access.id)}`,
        { collectionPath: `projects/${encodeURIComponent(projectId)}/accesses` },
    );
}

async function loadProjectOr404(req, res) {
    const projectId = projectIdOf(req);
    const project = await projectRepository.getById(projectId);
    if (!project) {
        res.status(404).json({ status: 'error', message: 'Empreendimento nao encontrado.' });
        return null;
    }
    return project;
}

router.get('/:id/accesses', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const projectId = projectIdOf(req);
    const items = await towerAccessRepository.listByProject(projectId);
    return res.status(200).json({
        status: 'success',
        data: items.map((item) => accessResponse(req, projectId, item)),
        _links: collectionLinks(req, projectId),
    });
}));

router.post('/:id/accesses/preview', verifyToken, requireEditor, validateBody(towerAccessPreviewSchema), asyncHandler(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return undefined;
    const { features } = req.body.data;
    const preview = await buildAccessPreview({
        features,
        torresCoordenadas: project.torresCoordenadas,
        osmRoadRepository,
    });
    return res.status(200).json({
        status: 'success',
        data: preview,
        _links: collectionLinks(req, projectIdOf(req)),
    });
}));

router.post('/:id/accesses', verifyToken, requireEditor, validateBody(towerAccessCreateSchema), asyncHandler(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return undefined;
    const projectId = projectIdOf(req);
    const { items, replaceIds = [] } = req.body.data;
    const now = new Date().toISOString();
    const rows = items.map((item) => ({
        id: `ACC-${crypto.randomUUID()}`,
        towerNumber: item.kind === 'acesso' ? String(item.towerNumber).trim() : (item.towerNumber ? String(item.towerNumber).trim() : null),
        kind: item.kind,
        name: item.name || '',
        geometry: item.geometry,
        lengthM: Math.round(lineLength(item.geometry.coordinates) * 10) / 10,
        segments: item.segments,
        source: { importadoEm: now, ...(item.source || {}) },
    }));
    const saved = await towerAccessRepository.insertMany(projectId, rows, {
        updatedBy: req.user?.email || null,
        replaceIds,
    });
    return res.status(201).json({
        status: 'success',
        data: saved.map((item) => accessResponse(req, projectId, item)),
        _links: collectionLinks(req, projectId),
    });
}));

router.get('/:id/accesses/:accessId', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const projectId = projectIdOf(req);
    const access = await towerAccessRepository.getById(projectId, req.params.accessId);
    if (!access) return res.status(404).json({ status: 'error', message: 'Acesso nao encontrado.' });
    return res.status(200).json({ status: 'success', data: accessResponse(req, projectId, access) });
}));

router.put('/:id/accesses/:accessId', verifyToken, requireEditor, validateBody(towerAccessUpdateSchema), asyncHandler(async (req, res) => {
    const projectId = projectIdOf(req);
    const updated = await towerAccessRepository.update(projectId, req.params.accessId, req.body.data, {
        updatedBy: req.user?.email || null,
    });
    if (!updated) return res.status(404).json({ status: 'error', message: 'Acesso nao encontrado.' });
    return res.status(200).json({ status: 'success', data: accessResponse(req, projectId, updated) });
}));

router.delete('/:id/accesses/:accessId', verifyToken, requireEditor, asyncHandler(async (req, res) => {
    const removed = await towerAccessRepository.remove(projectIdOf(req), req.params.accessId);
    if (!removed) return res.status(404).json({ status: 'error', message: 'Acesso nao encontrado.' });
    return res.status(204).send();
}));

module.exports = router;
