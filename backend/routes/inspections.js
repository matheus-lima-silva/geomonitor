const express = require('express');
const router = express.Router();
const { getCollection, getDocRef } = require('../utils/firebaseSetup');
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('../utils/authMiddleware');
const { createHateoasResponse, generateHateoasLinks } = require('../utils/hateoas');

const COLLECTION_NAME = 'inspections';

async function saveInspectionHandler(req, res) {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { data, meta = {} } = body;

        if (!data) {
            return res.status(400).json({ status: 'error', message: 'Dados sao obrigatorios' });
        }

        const id = String(data.id || '').trim() || `VS-${Date.now()}`;
        const mergedData = {
            ...data,
            id,
            _links: generateHateoasLinks(req, 'inspections', id),
            dataFim: data.dataFim || data.dataInicio,
            detalhesDias: Array.isArray(data.detalhesDias) ? data.detalhesDias : [],
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        await getDocRef(COLLECTION_NAME, id).set(mergedData, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, { id }, 'inspections', id),
        });
    } catch (error) {
        console.error('[Inspection API] Error POST:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar vistoria' });
    }
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const snapshot = await getCollection(COLLECTION_NAME).get();
        const inspections = snapshot.docs.map((doc) => createHateoasResponse(req, doc.data(), 'inspections', doc.id));
        return res.status(200).json({ status: 'success', data: inspections });
    } catch (error) {
        console.error('[Inspection API] Error GET:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar vistorias' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await getDocRef(COLLECTION_NAME, id).get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Vistoria nao encontrada' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'inspections', doc.id),
        });
    } catch (error) {
        console.error(`[Inspection API] Error GET /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar vistoria' });
    }
});

router.post('/', verifyToken, requireEditor, saveInspectionHandler);

router.put('/:id', verifyToken, requireEditor, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    req.body = {
        ...body,
        data: {
            ...data,
            id: req.params.id,
        },
    };
    return saveInspectionHandler(req, res);
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await getDocRef(COLLECTION_NAME, id).delete();
        return res.status(200).json({ status: 'success', message: 'Vistoria deletada' });
    } catch (error) {
        console.error(`[Inspection API] Error DELETE /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar vistoria' });
    }
});

module.exports = router;
