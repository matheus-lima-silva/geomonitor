// Meio fisico por torre (Fases 3/4, docs/plans/erosao-acessos-geodados.md).
// Montado em /api/projects. Calculo em lote: scripts/computeTowerEnvironment.js.
const express = require('express');
const { verifyToken, requireActiveUser } = require('../utils/authMiddleware');
const { resolveApiBaseUrl } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { towerEnvironmentRepository } = require('../repositories');

const router = express.Router();

router.get('/:id/tower-environment', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const projectId = String(req.params.id || '').trim().toUpperCase();
    const items = await towerEnvironmentRepository.listByProject(projectId);
    const base = `${resolveApiBaseUrl(req)}/projects/${encodeURIComponent(projectId)}`;
    return res.status(200).json({
        status: 'success',
        data: items,
        _links: {
            self: { href: `${base}/tower-environment`, method: 'GET' },
            project: { href: base, method: 'GET' },
        },
    });
}));

module.exports = router;
