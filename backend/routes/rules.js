const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { getDocRef } = require('../utils/firebaseSetup');
const { createSingletonHateoasResponse } = require('../utils/hateoas');

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const doc = await getDocRef('config', 'rules').get();
        if (!doc.exists) {
            return res.status(200).json({ status: 'success', data: null });
        }

        return res.status(200).json({
            status: 'success',
            data: createSingletonHateoasResponse(req, doc.data(), 'rules'),
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

        await getDocRef('config', 'rules').set(payload, { merge: true });

        return res.status(200).json({
            status: 'success',
            data: createSingletonHateoasResponse(req, payload, 'rules'),
        });
    } catch (error) {
        console.error('[rules API] Error PUT /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar configuracao de regras' });
    }
});

module.exports = router;