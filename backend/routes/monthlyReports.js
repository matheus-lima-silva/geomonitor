const express = require('express');
const { verifyToken, requireActiveUser } = require('../utils/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody, validateQuery } = require('../middleware/validate');
const { createResourceHateoasResponse, generateHateoasLinks } = require('../utils/hateoas');
const { monthlyReportRepository } = require('../repositories');
const { saveMonthlyReportSchema, byPeriodQuerySchema } = require('../schemas/monthlyReportSchemas');

const router = express.Router();

function reportResource(req, report) {
    return createResourceHateoasResponse(req, report, `monthly-reports/${report.id}`, {
        collectionPath: 'monthly-reports',
    });
}

// GET / — lista resumida (sem filhos) dos relatorios do usuario autenticado.
router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const items = await monthlyReportRepository.listByOwner(req.user.uid);
    const data = items.map((item) => ({
        ...item,
        _links: generateHateoasLinks(req, 'monthly-reports', item.id),
    }));
    return res.status(200).json({ status: 'success', data });
}));

// GET /by-period?year=&month= — garante o relatorio do mes (cria vazio se nao
// existir). Registrado ANTES de /:id para nao colidir.
router.get('/by-period', verifyToken, requireActiveUser, validateQuery(byPeriodQuerySchema), asyncHandler(async (req, res) => {
    const { year, month } = req.query;
    const report = await monthlyReportRepository.ensureForPeriod(req.user.uid, year, month, req.user.email);
    return res.status(200).json({ status: 'success', data: reportResource(req, report) });
}));

// GET /:id
router.get('/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const report = await monthlyReportRepository.getFull(req.params.id, req.user.uid);
    if (!report) {
        return res.status(404).json({ status: 'error', message: 'Relatorio nao encontrado.' });
    }
    return res.status(200).json({ status: 'success', data: reportResource(req, report) });
}));

// POST / — cria a partir de dados completos (periodo unico por dono).
router.post('/', verifyToken, requireActiveUser, validateBody(saveMonthlyReportSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    try {
        const report = await monthlyReportRepository.create({
            ...data,
            ownerUserId: req.user.uid,
            updatedBy: req.user.email,
        });
        return res.status(201).json({ status: 'success', data: reportResource(req, report) });
    } catch (err) {
        if (err && err.code === '23505') {
            return res.status(409).json({ status: 'error', code: 'PERIOD_EXISTS', message: 'Ja existe um relatorio para este mes.' });
        }
        throw err;
    }
}));

// PUT /:id — full-sync transacional com concorrencia otimista (version).
router.put('/:id', verifyToken, requireActiveUser, validateBody(saveMonthlyReportSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    const result = await monthlyReportRepository.saveFull(
        req.params.id,
        req.user.uid,
        { ...data, updatedBy: req.user.email },
        data.version,
    );
    if (result.notFound) {
        return res.status(404).json({ status: 'error', message: 'Relatorio nao encontrado.' });
    }
    if (result.conflict) {
        return res.status(409).json({
            status: 'error',
            code: 'VERSION_CONFLICT',
            message: 'O relatorio foi alterado em outra sessao. Recarregue antes de salvar.',
            currentVersion: result.currentVersion,
        });
    }
    return res.status(200).json({ status: 'success', data: reportResource(req, result.report) });
}));

// DELETE /:id
router.delete('/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    await monthlyReportRepository.remove(req.params.id, req.user.uid);
    return res.status(204).send();
}));

module.exports = router;
