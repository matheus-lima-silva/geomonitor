const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/authMiddleware');
const {
    createPaginatedHateoasResponse,
    createResourceHateoasResponse,
} = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const systemAlertsRepository = require('../repositories/systemAlertsRepository');

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

// =============================================================================
// Listagem e acknowledgment de alertas do sistema.
//
// Alimenta o painel "Alertas do sistema" dentro da aba Estatisticas do
// gerenciamento. Por enquanto so ha um tipo (query_count_exceeded) gerado
// pelo middleware em backend/middleware/queryCounter.js, mas a tabela e
// generica — podemos adicionar novos tipos no futuro sem mudar schema.
// =============================================================================

router.get(
    '/',
    verifyToken,
    ...adminGuards,
    asyncHandler(async (req, res) => {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 20));
        const status = String(req.query.status || 'pending').toLowerCase();
        const onlyPending = status !== 'all';

        const { items, total } = await systemAlertsRepository.listRecent({
            page,
            limit,
            onlyPending,
        });

        const response = createPaginatedHateoasResponse(req, items, {
            entityType: 'admin/alerts',
            page,
            limit,
            total,
        });

        return res.status(200).json({
            status: 'success',
            ...response,
        });
    }),
);

router.post(
    '/:id/ack',
    verifyToken,
    ...adminGuards,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_ALERT_ID',
                message: 'ID de alerta invalido.',
            });
        }

        const userEmail = req.user?.email || req.user?.uid || 'unknown';
        const updated = await systemAlertsRepository.acknowledge(id, userEmail);

        if (!updated) {
            const existing = await systemAlertsRepository.getById(id);
            if (!existing) {
                return res.status(404).json({
                    status: 'error',
                    code: 'ALERT_NOT_FOUND',
                    message: 'Alerta nao encontrado.',
                });
            }
            return res.status(409).json({
                status: 'error',
                code: 'ALERT_ALREADY_ACKNOWLEDGED',
                message: 'Alerta ja foi marcado como revisado.',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: createResourceHateoasResponse(
                req,
                updated,
                `admin/alerts/${updated.id}`,
                { allowUpdate: false, allowDelete: false },
            ),
        });
    }),
);

module.exports = router;
