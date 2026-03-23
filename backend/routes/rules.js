const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createSingletonHateoasResponse } = require('../utils/hateoas');
const { rulesConfigRepository } = require('../repositories');

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const config = await rulesConfigRepository.get();
        if (!config) {
            return res.status(200).json({ status: 'success', data: null });
        }

        return res.status(200).json({
            status: 'success',
            data: createSingletonHateoasResponse(req, config, 'rules'),
        });
    } catch (error) {
        console.error('[rules API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar configuracao de regras' });
    }
});

router.put('/', verifyToken, requireEditor, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { data, meta = {} } = body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ status: 'error', message: 'Dados sao obrigatorios' });
        }

        const payload = {
            ...data,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        const saved = await rulesConfigRepository.save(payload, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createSingletonHateoasResponse(req, saved || payload, 'rules'),
        });
    } catch (error) {
        console.error('[rules API] Error PUT /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar configuracao de regras' });
    }
});

module.exports = router;
