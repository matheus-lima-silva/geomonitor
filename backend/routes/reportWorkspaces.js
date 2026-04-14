const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createHateoasResponse, createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const {
    reportWorkspaceRepository,
    reportPhotoRepository,
    reportJobRepository,
    workspaceImportRepository,
    workspaceKmzRequestRepository,
    mediaAssetRepository,
} = require('../repositories');
const { processKmzImport } = require('../utils/kmzProcessor');
const { removeStoredMedia } = require('../utils/mediaStorage');
const { triggerWorkerRun } = require('../utils/workerTrigger');
const { sortPhotosByMode } = require('../utils/reportJobContext');

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeSlot(slot = {}) {
    return {
        id: normalizeText(slot.id) || crypto.randomUUID(),
        label: normalizeText(slot.label),
        projectId: normalizeText(slot.projectId),
        status: normalizeText(slot.status) || 'draft',
        assetCount: Number.isFinite(Number(slot.assetCount)) ? Number(slot.assetCount) : 0,
    };
}

function normalizeWorkspacePayload(data = {}, fallback = {}) {
    return {
        ...fallback,
        id: normalizeText(data.id) || normalizeText(fallback.id) || `RW-${crypto.randomUUID()}`,
        nome: normalizeText(data.nome) || normalizeText(fallback.nome),
        descricao: normalizeText(data.descricao) || normalizeText(fallback.descricao),
        projectId: normalizeText(data.projectId || fallback.projectId).toUpperCase(),
        status: normalizeText(data.status) || normalizeText(fallback.status) || 'draft',
        slots: Array.isArray(data.slots) ? data.slots.map((slot) => normalizeSlot(slot)) : (fallback.slots || []),
        draftState: data.draftState && typeof data.draftState === 'object' ? data.draftState : (fallback.draftState || {}),
        photoSortMode: normalizeText(data.photoSortMode) || normalizeText(fallback.photoSortMode) || '',
        importedAt: normalizeText(data.importedAt) || normalizeText(fallback.importedAt),
        lastGeneratedAt: normalizeText(data.lastGeneratedAt) || normalizeText(fallback.lastGeneratedAt),
    };
}

function normalizePhoto(photo = {}, workspaceId = '', fallbackProjectId = '') {
    return {
        id: normalizeText(photo.id) || `RPH-${crypto.randomUUID()}`,
        workspaceId,
        projectId: normalizeText(photo.projectId) || fallbackProjectId,
        mediaAssetId: normalizeText(photo.mediaAssetId),
        towerId: normalizeText(photo.towerId),
        towerSource: normalizeText(photo.towerSource) || 'manual',
        includeInReport: Boolean(photo.includeInReport),
        caption: normalizeText(photo.caption),
        captureAt: normalizeText(photo.captureAt),
        gpsLat: Number.isFinite(Number(photo.gpsLat)) ? Number(photo.gpsLat) : null,
        gpsLon: Number.isFinite(Number(photo.gpsLon)) ? Number(photo.gpsLon) : null,
        insideRightOfWay: photo.insideRightOfWay === true,
        insideTowerRadius: photo.insideTowerRadius === true,
        distanceToAxisM: Number.isFinite(Number(photo.distanceToAxisM)) ? Number(photo.distanceToAxisM) : null,
        distanceToTowerM: Number.isFinite(Number(photo.distanceToTowerM)) ? Number(photo.distanceToTowerM) : null,
        curationStatus: normalizeText(photo.curationStatus) || 'draft',
        manualOverride: photo.manualOverride === true,
        sortOrder: Number.isFinite(Number(photo.sortOrder)) ? Number(photo.sortOrder) : 0,
        importSource: normalizeText(photo.importSource) || 'manual',
        updatedAt: new Date().toISOString(),
    };
}

function createWorkspacePhotoResponse(req, workspaceId, photo) {
    const photoId = normalizeText(photo.id);
    const extraLinks = {
        workspace: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}`, method: 'GET' },
    };

    if (photo.projectId) {
        extraLinks.projectPhoto = {
            href: `${resolveApiBaseUrl(req)}/projects/${photo.projectId}/photos/${photoId}`,
            method: 'GET',
        };
    }

    return createResourceHateoasResponse(
        req,
        photo,
        `report-workspaces/${workspaceId}/photos/${photoId}`,
        {
            allowDelete: false,
            collectionPath: `report-workspaces/${workspaceId}/photos`,
            extraLinks,
        },
    );
}

function buildWorkspaceKmzLinks(req, workspaceId, requestEntry) {
    const links = {
        workspace: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}`, method: 'GET' },
    };

    const lastJobId = normalizeText(requestEntry?.lastJobId);
    if (lastJobId) {
        links.job = {
            href: `${resolveApiBaseUrl(req)}/report-jobs/${lastJobId}`,
            method: 'GET',
        };
    }

    const outputKmzMediaId = normalizeText(requestEntry?.outputKmzMediaId);
    if (outputKmzMediaId) {
        links.download = {
            href: `${resolveApiBaseUrl(req)}/media/${outputKmzMediaId}/access-url`,
            method: 'GET',
        };
        links.media = {
            href: `${resolveApiBaseUrl(req)}/media/${outputKmzMediaId}`,
            method: 'GET',
        };
    }

    return links;
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const workspaces = await reportWorkspaceRepository.list();
        return res.status(200).json({
            status: 'success',
            data: workspaces.map((workspace) => createHateoasResponse(req, workspace, 'report-workspaces', workspace.id)),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar workspaces de relatorio' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const workspace = await reportWorkspaceRepository.getById(req.params.id);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, workspace, 'report-workspaces', workspace.id),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar workspace de relatorio' });
    }
});

router.post('/', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const payload = normalizeWorkspacePayload(data);
        const saved = await reportWorkspaceRepository.save({
            ...payload,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, saved || payload, 'report-workspaces', payload.id),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar workspace de relatorio' });
    }
});

router.put('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const current = await reportWorkspaceRepository.getById(req.params.id) || {};
        const payload = normalizeWorkspacePayload({ ...data, id: req.params.id }, current);
        const saved = await reportWorkspaceRepository.save({
            ...payload,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, saved || payload, 'report-workspaces', req.params.id),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error PUT /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao atualizar workspace de relatorio' });
    }
});

router.post('/:id/trash', verifyToken, requireEditor, async (req, res) => {
    try {
        const current = await reportWorkspaceRepository.getById(req.params.id);
        if (!current) return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        const saved = await reportWorkspaceRepository.save(
            { ...current, deletedAt: new Date().toISOString(), updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createHateoasResponse(req, saved || current, 'report-workspaces', req.params.id) });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao mover workspace para lixeira' });
    }
});

router.post('/:id/restore', verifyToken, requireEditor, async (req, res) => {
    try {
        const current = await reportWorkspaceRepository.getById(req.params.id);
        if (!current) return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        const { deletedAt, ...rest } = current;
        const saved = await reportWorkspaceRepository.save(
            { ...rest, deletedAt: null, updatedBy: req.user?.email || 'API' },
            { merge: true },
        );
        return res.status(200).json({ status: 'success', data: createHateoasResponse(req, saved || rest, 'report-workspaces', req.params.id) });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/restore:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao restaurar workspace da lixeira' });
    }
});

router.delete('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        await reportWorkspaceRepository.remove(req.params.id);
        return res.status(200).json({ status: 'success', message: 'Registro deletado' });
    } catch (error) {
        console.error('[report-workspaces API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar workspace de relatorio' });
    }
});

router.post('/:id/import', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        if (!workspaceId) {
            return res.status(400).json({ status: 'error', message: 'Workspace invalido.' });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const existingData = await reportWorkspaceRepository.getById(workspaceId) || {};

        const nextData = {
            ...normalizeWorkspacePayload({ ...existingData, ...data, id: workspaceId }, existingData),
            importedAt: new Date().toISOString(),
            importSource: normalizeText(data.importSource) || normalizeText(data.sourceType) || 'manual',
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        const saved = await reportWorkspaceRepository.save(nextData, { merge: true });
        const workspaceImportId = `WIM-${crypto.randomUUID()}`;
        await workspaceImportRepository.save({
            id: workspaceImportId,
            workspaceId,
            sourceType: normalizeText(data.sourceType) || 'manual',
            status: 'completed',
            warnings: Array.isArray(data.warnings) ? data.warnings : [],
            summaryJson: data.summaryJson && typeof data.summaryJson === 'object' ? data.summaryJson : {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, saved || nextData, 'report-workspaces', workspaceId),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/import:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao importar workspace de relatorio' });
    }
});

router.get('/:id/photos', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photos = await reportPhotoRepository.listByWorkspace(workspaceId);

        return res.status(200).json({
            status: 'success',
            data: photos.map((photo) => createWorkspacePhotoResponse(req, workspaceId, photo)),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error GET /:id/photos:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar fotos do workspace' });
    }
});

router.get('/:id/photos/trash', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photos = await reportPhotoRepository.listTrashedByWorkspace(workspaceId);

        return res.status(200).json({
            status: 'success',
            data: photos.map((photo) => createWorkspacePhotoResponse(req, workspaceId, photo)),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error GET /:id/photos/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar fotos na lixeira' });
    }
});

router.post('/:id/photos/:photoId/trash', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photoId = normalizeText(req.params.photoId);

        const photo = await reportPhotoRepository.getById(photoId);
        if (!photo || photo.workspaceId !== workspaceId) {
            return res.status(404).json({ status: 'error', message: 'Foto nao vinculada a este workspace ou nao encontrada' });
        }

        await reportPhotoRepository.softDelete(photoId);

        return res.status(200).json({
            status: 'success',
            message: 'Foto movida para lixeira',
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/photos/:photoId/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao mover foto para lixeira' });
    }
});

router.post('/:id/photos/:photoId/restore', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photoId = normalizeText(req.params.photoId);

        const photo = await reportPhotoRepository.getById(photoId);
        if (!photo || photo.workspaceId !== workspaceId) {
            return res.status(404).json({ status: 'error', message: 'Foto nao vinculada a este workspace ou nao encontrada' });
        }

        await reportPhotoRepository.restore(photoId);

        return res.status(200).json({
            status: 'success',
            message: 'Foto restaurada da lixeira',
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/photos/:photoId/restore:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao restaurar foto da lixeira' });
    }
});

router.delete('/:id/photos/trash', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);

        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const removed = await reportPhotoRepository.removeAllTrashed(workspaceId);

        for (const item of removed) {
            if (item.mediaAssetId) {
                try {
                    const asset = await mediaAssetRepository.getById(item.mediaAssetId);
                    if (asset) {
                        await removeStoredMedia(asset);
                        await mediaAssetRepository.remove(item.mediaAssetId);
                    }
                } catch (cleanupError) {
                    console.error('[report-workspaces API] Falha ao limpar media asset', item.mediaAssetId, cleanupError);
                }
            }
        }

        return res.status(200).json({
            status: 'success',
            message: `${removed.length} foto(s) removida(s) permanentemente`,
            data: { count: removed.length },
        });
    } catch (error) {
        console.error('[report-workspaces API] Error DELETE /:id/photos/trash:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao esvaziar lixeira de fotos' });
    }
});

router.delete('/:id/photos/:photoId', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photoId = normalizeText(req.params.photoId);

        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const photo = await reportPhotoRepository.getById(photoId);
        if (!photo || photo.workspaceId !== workspaceId) {
            return res.status(404).json({ status: 'error', message: 'Foto nao vinculada a este workspace ou nao encontrada' });
        }

        await reportPhotoRepository.remove(photoId);

        if (photo.mediaAssetId) {
            const asset = await mediaAssetRepository.getById(photo.mediaAssetId);
            if (asset) {
                await removeStoredMedia(asset);
                await mediaAssetRepository.remove(photo.mediaAssetId);
            }
        }

        return res.status(200).json({
            status: 'success',
            message: 'Foto removida do workspace com sucesso',
        });
    } catch (error) {
        console.error('[report-workspaces API] Error DELETE /:id/photos/:photoId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar foto do workspace' });
    }
});

router.put('/:id/photos/:photoId', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const photoId = normalizeText(req.params.photoId);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const workspace = await reportWorkspaceRepository.getById(workspaceId);

        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const currentData = await reportPhotoRepository.getById(photoId) || {};
        const nextData = {
            ...normalizePhoto({ ...currentData, ...data, id: photoId }, workspaceId, normalizeText(workspace.projectId).toUpperCase()),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        const saved = await reportPhotoRepository.save(nextData, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createWorkspacePhotoResponse(req, workspaceId, saved || nextData),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error PUT /:id/photos/:photoId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar foto do workspace' });
    }
});

router.post('/:id/photos/organize', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const workspace = await reportWorkspaceRepository.getById(workspaceId);

        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const summary = {
            totalReceived: Number.isFinite(Number(data.totalReceived)) ? Number(data.totalReceived) : 0,
            withGps: Number.isFinite(Number(data.withGps)) ? Number(data.withGps) : 0,
            withSuggestedTower: Number.isFinite(Number(data.withSuggestedTower)) ? Number(data.withSuggestedTower) : 0,
            pendingLinkage: Number.isFinite(Number(data.pendingLinkage)) ? Number(data.pendingLinkage) : 0,
            mode: normalizeText(data.mode) || 'manual',
        };

        await reportWorkspaceRepository.save({
            ...workspace,
            organizationSummary: summary,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        return res.status(202).json({
            status: 'success',
            data: {
                workspaceId,
                summary,
                _links: {
                    self: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}`, method: 'GET' },
                    photos: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}/photos`, method: 'GET' },
                },
            },
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/photos/organize:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao organizar fotos do workspace' });
    }
});

const PHOTO_SORT_MODES = ['tower_asc', 'tower_desc', 'capture_date_asc', 'capture_date_desc', 'sort_order_asc', 'caption_asc'];

router.post('/:id/photos/reorder', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const photoSortMode = normalizeText(data.photoSortMode);

        if (!PHOTO_SORT_MODES.includes(photoSortMode)) {
            return res.status(400).json({ status: 'error', message: `Modo de ordenacao invalido. Use: ${PHOTO_SORT_MODES.join(', ')}` });
        }

        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const photos = await reportPhotoRepository.listByWorkspace(workspaceId);
        const sorted = sortPhotosByMode(photos, photoSortMode);
        const updates = sorted.map((photo, index) => ({ id: photo.id, sortOrder: index + 1 }));

        await reportPhotoRepository.batchUpdateSortOrder(updates);

        await reportWorkspaceRepository.save({
            ...workspace,
            photoSortMode,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        const updatedPhotos = await reportPhotoRepository.listByWorkspace(workspaceId);

        return res.status(200).json({
            status: 'success',
            data: {
                workspaceId,
                photoSortMode,
                photoCount: updatedPhotos.length,
                photos: updatedPhotos.map((photo) => createWorkspacePhotoResponse(req, workspaceId, photo)),
            },
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/photos/reorder:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao reordenar fotos do workspace' });
    }
});

router.post('/:id/photos/manual-order', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};

        const rawIds = Array.isArray(data.photoIds) ? data.photoIds : null;
        if (!rawIds) {
            return res.status(400).json({ status: 'error', message: 'photoIds deve ser um array.' });
        }
        const photoIds = rawIds.map((id) => normalizeText(id)).filter(Boolean);
        if (photoIds.length === 0) {
            return res.status(400).json({ status: 'error', message: 'photoIds vazio.' });
        }

        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const existing = await reportPhotoRepository.listByWorkspace(workspaceId);
        const existingIds = new Set(existing.map((p) => normalizeText(p.id)));
        const seen = new Set();
        for (const id of photoIds) {
            if (!existingIds.has(id)) {
                return res.status(400).json({ status: 'error', message: `Foto ${id} nao pertence ao workspace.` });
            }
            if (seen.has(id)) {
                return res.status(400).json({ status: 'error', message: `Foto ${id} duplicada em photoIds.` });
            }
            seen.add(id);
        }

        // Fotos ausentes em photoIds (ex.: filtro de torre no cliente) mantem posicao relativa no final.
        const missing = existing
            .map((p) => normalizeText(p.id))
            .filter((id) => !seen.has(id));
        const fullOrder = [...photoIds, ...missing];
        const updates = fullOrder.map((id, index) => ({ id, sortOrder: index + 1 }));

        await reportPhotoRepository.batchUpdateSortOrder(updates);

        await reportWorkspaceRepository.save({
            ...workspace,
            photoSortMode: 'sort_order_asc',
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        }, { merge: true });

        const updatedPhotos = await reportPhotoRepository.listByWorkspace(workspaceId);

        return res.status(200).json({
            status: 'success',
            data: {
                workspaceId,
                photoSortMode: 'sort_order_asc',
                photoCount: updatedPhotos.length,
                photos: updatedPhotos.map((photo) => createWorkspacePhotoResponse(req, workspaceId, photo)),
            },
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/photos/manual-order:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao aplicar ordem manual das fotos' });
    }
});

router.post('/:id/kmz/process', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const mediaAssetId = normalizeText(data.mediaAssetId);

        if (!mediaAssetId) {
            return res.status(400).json({ status: 'error', message: 'mediaAssetId obrigatorio.' });
        }

        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const mediaAsset = await mediaAssetRepository.getById(mediaAssetId);
        if (!mediaAsset) {
            return res.status(404).json({ status: 'error', message: 'Media asset nao encontrado' });
        }

        const updatedBy = meta.updatedBy || req.user?.email || 'API';

        const result = await processKmzImport({
            workspaceId,
            projectId: normalizeText(workspace.projectId).toUpperCase(),
            mediaAsset,
            updatedBy,
            mediaAssetRepository,
            reportPhotoRepository,
        });

        const workspaceImportId = `WIM-${crypto.randomUUID()}`;
        await workspaceImportRepository.save({
            id: workspaceImportId,
            workspaceId,
            sourceType: 'organized_kmz',
            status: 'completed',
            warnings: result.warnings,
            summaryJson: {
                photosCreated: result.photosCreated,
                photosSkipped: result.photosSkipped,
                towersInferred: result.towersInferred,
                pendingLinkage: result.pendingLinkage,
                placemarkCount: result.placemarkCount,
                photoIds: result.photoIds,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy,
        }, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: {
                workspaceId,
                summary: {
                    photosCreated: result.photosCreated,
                    photosSkipped: result.photosSkipped,
                    towersInferred: result.towersInferred,
                    pendingLinkage: result.pendingLinkage,
                    placemarkCount: result.placemarkCount,
                    warnings: result.warnings,
                },
                _links: {
                    self: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}`, method: 'GET' },
                    photos: { href: `${resolveApiBaseUrl(req)}/report-workspaces/${workspaceId}/photos`, method: 'GET' },
                },
            },
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/kmz/process:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao processar KMZ do workspace' });
    }
});

router.post('/:id/kmz', verifyToken, requireEditor, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ status: 'error', message: 'Workspace nao encontrado' });
        }

        const token = `kmz-${crypto.randomUUID()}`;
        const jobId = `JOB-${crypto.randomUUID()}`;
        const now = new Date();
        const updatedBy = meta.updatedBy || req.user?.email || 'API';
        const payload = {
            id: `WKMZ-${crypto.randomUUID()}`,
            token,
            workspaceId,
            projectId: normalizeText(workspace.projectId).toUpperCase(),
            statusExecucao: 'queued',
            lastJobId: jobId,
            outputKmzMediaId: '',
            lastError: '',
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + (15 * 60 * 1000)).toISOString(),
            updatedAt: now.toISOString(),
            updatedBy,
        };

        await reportJobRepository.save({
            id: jobId,
            kind: 'workspace_kmz',
            workspaceId,
            projectId: normalizeText(workspace.projectId).toUpperCase(),
            workspaceKmzToken: token,
            statusExecucao: 'queued',
            updatedAt: now.toISOString(),
            updatedBy,
        }, { merge: true });
        const savedRequest = await workspaceKmzRequestRepository.save(token, payload, { merge: true });

        triggerWorkerRun();

        return res.status(202).json({
            status: 'success',
            data: createResourceHateoasResponse(
                req,
                savedRequest || payload,
                `report-workspaces/${workspaceId}/kmz/${token}`,
                {
                    allowUpdate: false,
                    allowDelete: false,
                    collectionPath: `report-workspaces/${workspaceId}`,
                    extraLinks: buildWorkspaceKmzLinks(req, workspaceId, savedRequest || payload),
                },
            ),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error POST /:id/kmz:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao solicitar KMZ do workspace' });
    }
});

router.get('/:id/kmz/:token', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const workspaceId = normalizeText(req.params.id);
        const token = normalizeText(req.params.token);
        const requestEntry = await workspaceKmzRequestRepository.getByWorkspaceAndToken(workspaceId, token);
        if (!requestEntry) {
            return res.status(404).json({ status: 'error', message: 'Solicitacao de KMZ nao encontrada' });
        }

        return res.status(200).json({
            status: 'success',
            data: createResourceHateoasResponse(
                req,
                requestEntry,
                `report-workspaces/${workspaceId}/kmz/${token}`,
                {
                    allowUpdate: false,
                    allowDelete: false,
                    collectionPath: `report-workspaces/${workspaceId}`,
                    extraLinks: buildWorkspaceKmzLinks(req, workspaceId, requestEntry),
                },
            ),
        });
    } catch (error) {
        console.error('[report-workspaces API] Error GET /:id/kmz/:token:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao consultar KMZ do workspace' });
    }
});

module.exports = router;
