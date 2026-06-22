const express = require('express');
const { verifyToken, requireActiveUser } = require('../utils/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { createSingletonHateoasResponse } = require('../utils/hateoas');
const { monthlyReportSettingsRepository } = require('../repositories');
const { saveMonthlyReportSettingsSchema } = require('../schemas/monthlyReportSettingsSchemas');

// Config global do Relatorio Mensal (equipe + contrato) — singleton por
// usuario autenticado. GET devolve default vazio se nunca foi salva.

const router = express.Router();

const RESOURCE_PATH = 'monthly-report-settings';

// GET / — settings do usuario (default vazio quando inexistente).
router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const settings = await monthlyReportSettingsRepository.getByOwner(req.user.uid);
    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, settings, RESOURCE_PATH),
    });
}));

// PUT / — upsert das settings do usuario.
router.put('/', verifyToken, requireActiveUser, validateBody(saveMonthlyReportSettingsSchema), asyncHandler(async (req, res) => {
    const { data, meta } = req.body;
    const updatedBy = (meta && meta.updatedBy) || req.user.email;
    const settings = await monthlyReportSettingsRepository.saveByOwner(req.user.uid, data, updatedBy);
    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, settings, RESOURCE_PATH),
    });
}));

module.exports = router;
