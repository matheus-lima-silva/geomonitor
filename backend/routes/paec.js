const crypto = require('crypto');
const express = require('express');
const {
    verifyToken,
    requireActiveUser,
    requireEditor,
    requireAdmin,
    requireAdminOrWorker,
} = require('../utils/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { paecTemplateRepository, paecPlantRepository, reportJobRepository } = require('../repositories');
const { triggerWorkerRun } = require('../utils/workerTrigger');
const { computePendencies, computeStats } = require('../utils/paecPendencies');
const { savePaecPlantSchema, registerPaecTemplateSchema } = require('../schemas/paecSchemas');

// Modulo PAEC (portal relat): fichas "titulo chave -> texto valor" por usina
// e revisoes do modelo canonico tokenizado. Geracao de DOCX via report_jobs
// (kind paec_report) + worker Python (worker/paec_renderer.py).

const router = express.Router();

function templateResource(req, template) {
    return createResourceHateoasResponse(req, template, `paec/templates/${template.id}`, {
        collectionPath: 'paec/templates',
        allowUpdate: false,
        allowDelete: false,
        extraLinks: {
            activate: { href: `${resolveApiBaseUrl(req)}/paec/templates/${template.id}/activate`, method: 'POST' },
        },
    });
}

function plantResource(req, plant) {
    return createResourceHateoasResponse(req, plant, `paec/plants/${plant.id}`, {
        collectionPath: 'paec/plants',
        extraLinks: {
            generate: { href: `${resolveApiBaseUrl(req)}/paec/plants/${plant.id}/generate`, method: 'POST' },
        },
    });
}

// ---------------------------------------------------------------------------
// Templates (revisoes do modelo canonico)
// ---------------------------------------------------------------------------

// GET /templates — lista resumida (sem manifest).
router.get('/templates', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const items = await paecTemplateRepository.list();
    return res.status(200).json({
        status: 'success',
        data: items.map((item) => templateResource(req, item)),
    });
}));

// GET /templates/:id — inclui o manifest (o frontend monta a ficha a partir dele).
router.get('/templates/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const template = await paecTemplateRepository.getById(req.params.id);
    if (!template) {
        return res.status(404).json({ status: 'error', message: 'Template PAEC nao encontrado.' });
    }
    return res.status(200).json({ status: 'success', data: templateResource(req, template) });
}));

// POST /templates — registra uma revisao (draft). Admin ou script interno
// com WORKER_API_TOKEN (registerPaecTemplate.js).
router.post('/templates', requireAdminOrWorker, validateBody(registerPaecTemplateSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    try {
        const template = await paecTemplateRepository.create({
            ...data,
            updatedBy: req.user.email,
        });
        return res.status(201).json({ status: 'success', data: templateResource(req, template) });
    } catch (err) {
        if (err && err.code === '23505') {
            return res.status(409).json({
                status: 'error',
                code: 'REVISION_EXISTS',
                message: 'Ja existe um template com este nome e revisao.',
            });
        }
        throw err;
    }
}));

// POST /templates/:id/activate — ativa a revisao (retira a ativa anterior).
router.post('/templates/:id/activate', requireAdminOrWorker, asyncHandler(async (req, res) => {
    const template = await paecTemplateRepository.activate(req.params.id, { updatedBy: req.user.email });
    if (!template) {
        return res.status(404).json({ status: 'error', message: 'Template PAEC nao encontrado.' });
    }
    return res.status(200).json({ status: 'success', data: templateResource(req, template) });
}));

// ---------------------------------------------------------------------------
// Fichas por usina
// ---------------------------------------------------------------------------

// GET /plants — resumo com completude (campos preenchidos x total do manifest).
router.get('/plants', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const [plants, templates] = await Promise.all([
        paecPlantRepository.list(),
        paecTemplateRepository.list(),
    ]);
    const manifestTotals = new Map();
    for (const t of templates) {
        manifestTotals.set(t.id, null); // total vem do manifest, carregado sob demanda abaixo
    }

    const data = [];
    for (const plant of plants) {
        let total = manifestTotals.get(plant.templateId);
        if (total == null) {
            const template = await paecTemplateRepository.getById(plant.templateId);
            total = Array.isArray(template?.manifest?.fields) ? template.manifest.fields.length : 0;
            manifestTotals.set(plant.templateId, total);
        }
        data.push(plantResource(req, {
            ...plant,
            completeness: { fieldsFilled: plant.filledFields, fieldsTotal: total },
        }));
    }
    return res.status(200).json({ status: 'success', data });
}));

// POST /plants — cria ficha (opcionalmente copiando os campos de outra usina).
router.post('/plants', verifyToken, requireEditor, validateBody(savePaecPlantSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    const template = await paecTemplateRepository.getActive('PAEC AXIA');
    if (!template) {
        return res.status(422).json({
            status: 'error',
            code: 'NO_ACTIVE_TEMPLATE',
            message: 'Nenhuma revisao ativa do modelo PAEC. Registre e ative um template antes.',
        });
    }
    try {
        const plant = await paecPlantRepository.create({
            ...data,
            templateId: template.id,
            updatedBy: req.user.email,
        });
        return res.status(201).json({ status: 'success', data: plantResource(req, plant) });
    } catch (err) {
        if (err && err.code === '23505') {
            return res.status(409).json({
                status: 'error',
                code: 'NAME_EXISTS',
                message: 'Ja existe uma ficha PAEC para esta usina.',
            });
        }
        throw err;
    }
}));

// GET /plants/:id — ficha completa + pendencias computadas server-side.
router.get('/plants/:id', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const plant = await paecPlantRepository.getFull(req.params.id);
    if (!plant) {
        return res.status(404).json({ status: 'error', message: 'Ficha PAEC nao encontrada.' });
    }
    const template = await paecTemplateRepository.getById(plant.templateId);
    const manifest = template?.manifest || {};
    return res.status(200).json({
        status: 'success',
        data: plantResource(req, {
            ...plant,
            templateRevisionLabel: template?.revisionLabel || null,
            pendencies: computePendencies(manifest, plant.fields),
            stats: computeStats(manifest, plant.fields),
        }),
    });
}));

// PUT /plants/:id — full-sync transacional com concorrencia otimista (version).
router.put('/plants/:id', verifyToken, requireEditor, validateBody(savePaecPlantSchema), asyncHandler(async (req, res) => {
    const { data } = req.body;
    const result = await paecPlantRepository.saveFull(
        req.params.id,
        { ...data, updatedBy: req.user.email },
        data.version,
    );
    if (result.notFound) {
        return res.status(404).json({ status: 'error', message: 'Ficha PAEC nao encontrada.' });
    }
    if (result.conflict) {
        return res.status(409).json({
            status: 'error',
            code: 'VERSION_CONFLICT',
            message: 'A ficha foi alterada em outra sessao. Recarregue antes de salvar.',
            currentVersion: result.currentVersion,
        });
    }
    return res.status(200).json({ status: 'success', data: plantResource(req, result.plant) });
}));

// DELETE /plants/:id
router.delete('/plants/:id', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
    await paecPlantRepository.remove(req.params.id);
    return res.status(204).send();
}));

// POST /plants/:id/generate — enfileira a geracao do DOCX (kind paec_report).
// O id do template PAEC viaja no payload do job (a coluna report_jobs.template_id
// tem FK para report_templates e NAO pode ser reusada).
router.post('/plants/:id/generate', verifyToken, requireEditor, asyncHandler(async (req, res) => {
    const plant = await paecPlantRepository.getFull(req.params.id);
    if (!plant) {
        return res.status(404).json({ status: 'error', message: 'Ficha PAEC nao encontrada.' });
    }
    const template = await paecTemplateRepository.getById(plant.templateId);
    if (!template || !template.tokenizedDocxMediaId) {
        return res.status(422).json({
            status: 'error',
            code: 'TEMPLATE_UNAVAILABLE',
            message: 'O template desta ficha nao tem DOCX tokenizado registrado.',
        });
    }

    const jobId = `JOB-${crypto.randomUUID()}`;
    const job = await reportJobRepository.save({
        id: jobId,
        kind: 'paec_report',
        statusExecucao: 'queued',
        paecPlantId: plant.id,
        paecTemplateId: template.id,
        ownerUserId: req.user.uid,
        createdAt: new Date().toISOString(),
        updatedBy: req.user.email,
    });

    triggerWorkerRun();

    const apiBaseUrl = resolveApiBaseUrl(req);
    return res.status(202).json({
        status: 'success',
        data: {
            ...job,
            _links: {
                self: { href: `${apiBaseUrl}/report-jobs/${jobId}`, method: 'GET' },
                plant: { href: `${apiBaseUrl}/paec/plants/${plant.id}`, method: 'GET' },
            },
        },
    });
}));

module.exports = router;
