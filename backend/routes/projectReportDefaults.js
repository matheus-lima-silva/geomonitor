const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { normalizeText } = require('../utils/projectScope');
const { reportDefaultsRepository } = require('../repositories');

function buildDefaultPayload(projectId, data = {}) {
    return {
        projectId,
        faixaBufferMetersSide: Number.isFinite(Number(data.faixaBufferMetersSide))
            ? Number(data.faixaBufferMetersSide)
            : 200,
        towerSuggestionRadiusMeters: Number.isFinite(Number(data.towerSuggestionRadiusMeters))
            ? Number(data.towerSuggestionRadiusMeters)
            : 300,
        baseTowerRadiusMeters: Number.isFinite(Number(data.baseTowerRadiusMeters))
            ? Number(data.baseTowerRadiusMeters)
            : 30,
        textosBase: data.textosBase && typeof data.textosBase === 'object' ? data.textosBase : {},
        preferencias: data.preferencias && typeof data.preferencias === 'object' ? data.preferencias : {},
    };
}

function createDefaultsResponse(req, projectId, payload) {
    return createResourceHateoasResponse(
        req,
        payload,
        `projects/${projectId}/report-defaults`,
        {
            allowDelete: false,
            collectionPath: `projects/${projectId}`,
            extraLinks: {
                project: { href: `${resolveApiBaseUrl(req)}/projects/${projectId}`, method: 'GET' },
            },
        },
    );
}

router.get('/:id/report-defaults', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const current = await reportDefaultsRepository.getByProjectId(projectId);
        const payload = buildDefaultPayload(projectId, current || {});

        return res.status(200).json({
            status: 'success',
            data: createDefaultsResponse(req, projectId, payload),
        });
    } catch (error) {
        console.error('[project-report-defaults API] Error GET /:id/report-defaults:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar defaults de relatorio do empreendimento' });
    }
});

router.put('/:id/report-defaults', verifyToken, requireEditor, async (req, res) => {
    try {
        const projectId = normalizeText(req.params.id).toUpperCase();
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const payload = {
            ...buildDefaultPayload(projectId, data),
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        const saved = await reportDefaultsRepository.save(projectId, payload, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createDefaultsResponse(req, projectId, saved || payload),
        });
    } catch (error) {
        console.error('[project-report-defaults API] Error PUT /:id/report-defaults:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar defaults de relatorio do empreendimento' });
    }
});

module.exports = router;
