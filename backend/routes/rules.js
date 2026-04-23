const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('../utils/authMiddleware');
const { rulesConfigRepository } = require('../repositories');
const { createResourceHateoasResponse } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { rulesUpdateSchema } = require('../schemas/rulesSchemas');

const BRASIL_API_FERIADOS_URL = 'https://brasilapi.com.br/api/feriados/v1';
const IMPORT_TIMEOUT_MS = 5000;

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

function buildRulesResponse(req, data) {
    return createResourceHateoasResponse(req, data, 'rules', {
        allowDelete: false,
        extraLinks: {
            importarFeriados: {
                href: `${process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}/api`}/rules/feriados/importar`,
                method: 'GET',
            },
        },
    });
}

router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const config = await rulesConfigRepository.get();
    if (!config) {
        return res.status(200).json({ status: 'success', data: null });
    }

    return res.status(200).json({
        status: 'success',
        data: buildRulesResponse(req, config),
    });
}));

router.put('/', verifyToken, requireEditor, validateBody(rulesUpdateSchema), asyncHandler(async (req, res) => {
    const { data, meta = {} } = req.body;

    const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: meta.updatedBy || req.user?.email || 'API',
    };

    const saved = await rulesConfigRepository.save(payload, { merge: true });

    return res.status(200).json({
        status: 'success',
        data: buildRulesResponse(req, saved || payload),
    });
}));

router.get('/feriados/importar', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    const rawAno = req.query?.ano;
    const ano = Number.parseInt(String(rawAno || ''), 10);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
        return res.status(400).json({
            status: 'error',
            message: 'Parametro "ano" invalido. Informe um inteiro entre 2000 e 2100.',
        });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(`${BRASIL_API_FERIADOS_URL}/${ano}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            return res.status(504).json({
                status: 'error',
                message: 'Timeout ao consultar BrasilAPI de feriados.',
            });
        }
        return res.status(502).json({
            status: 'error',
            message: 'Falha ao consultar BrasilAPI de feriados.',
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        return res.status(502).json({
            status: 'error',
            message: `BrasilAPI respondeu com status ${response.status}.`,
        });
    }

    let payload;
    try {
        payload = await response.json();
    } catch (_err) {
        return res.status(502).json({
            status: 'error',
            message: 'Resposta invalida da BrasilAPI (JSON malformado).',
        });
    }

    const feriados = Array.isArray(payload)
        ? payload
            .filter((item) => item && typeof item.date === 'string' && typeof item.name === 'string')
            .map((item) => ({
                data: item.date,
                nome: item.name,
                tipo: 'nacional',
            }))
        : [];

    return res.status(200).json({
        status: 'success',
        data: createResourceHateoasResponse(req, { ano, feriados }, 'rules/feriados/importar', {
            allowUpdate: false,
            allowDelete: false,
            collectionPath: 'rules',
        }),
    });
}));

module.exports = router;
