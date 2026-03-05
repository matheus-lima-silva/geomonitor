const express = require('express');
const router = express.Router();
const { getCollection, getDocRef } = require('../utils/firebaseSetup');
const { verifyToken } = require('../utils/authMiddleware');
const { createHateoasResponse } = require('../utils/hateoas');

const COLLECTION_NAME = 'operatingLicenses';

async function saveLicenseHandler(req, res) {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { data, meta = {} } = body;

        if (!data || !data.id) {
            return res.status(400).json({ status: 'error', message: 'ID e dados sao obrigatorios' });
        }

        const id = String(data.id).trim();
        const mergedData = {
            ...data,
            id,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        await getDocRef(COLLECTION_NAME, id).set(mergedData, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, { id }, 'licenses', id),
        });
    } catch (error) {
        console.error('[License API] Error POST:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar licenca' });
    }
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const snapshot = await getCollection(COLLECTION_NAME).get();
        const licenses = snapshot.docs.map((doc) => createHateoasResponse(req, doc.data(), 'licenses', doc.id));
        return res.status(200).json({ status: 'success', data: licenses });
    } catch (error) {
        console.error('[License API] Error GET:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar licencas' });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await getDocRef(COLLECTION_NAME, id).get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Licenca nao encontrada' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'licenses', doc.id),
        });
    } catch (error) {
        console.error(`[License API] Error GET /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar licenca' });
    }
});

router.post('/', verifyToken, saveLicenseHandler);

router.put('/:id', verifyToken, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    req.body = {
        ...body,
        data: {
            ...data,
            id: req.params.id,
        },
    };
    return saveLicenseHandler(req, res);
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await getDocRef(COLLECTION_NAME, id).delete();
        return res.status(200).json({ status: 'success', message: 'Licenca deletada' });
    } catch (error) {
        console.error(`[License API] Error DELETE /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar licenca' });
    }
});

module.exports = router;
