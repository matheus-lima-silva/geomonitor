const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/firebaseSetup');
const { verifyToken } = require('../utils/authMiddleware');
const { createHateoasResponse } = require('../utils/hateoas');

const COLLECTION_NAME = 'inspections';

// GET all inspections
router.get('/', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION_NAME).get();

        const inspections = snapshot.docs.map(doc =>
            createHateoasResponse(req, doc.data(), 'inspections', doc.id)
        );

        res.status(200).json({ status: 'success', data: inspections });
    } catch (error) {
        console.error(`[Inspection API] Error GET:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar vistorias' });
    }
});

// GET single inspection
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const doc = await db.collection(COLLECTION_NAME).doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Vistoria não encontrada' });
        }

        res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'inspections', doc.id)
        });
    } catch (error) {
        console.error(`[Inspection API] Error GET /${req.params.id}:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar vistoria' });
    }
});

// POST / PUT - Save inspection
router.post('/', verifyToken, async (req, res) => {
    try {
        const { data, meta = {} } = req.body;

        if (!data) {
            return res.status(400).json({ status: 'error', message: 'Dados são obrigatórios' });
        }

        const db = getDb();
        const id = String(data.id || '').trim() || `VS-${Date.now()}`;

        const mergedData = {
            ...data,
            id,
            dataFim: data.dataFim || data.dataInicio,
            detalhesDias: Array.isArray(data.detalhesDias) ? data.detalhesDias : [],
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API'
        };

        await db.collection(COLLECTION_NAME).doc(id).set(mergedData, { merge: true });

        res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, { id }, 'inspections', id)
        });
    } catch (error) {
        console.error(`[Inspection API] Error POST:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao salvar vistoria' });
    }
});

router.put('/:id', verifyToken, async (req, res) => {
    req.body.data = req.body.data || {};
    req.body.data.id = req.params.id;

    // Forward to POST route
    return router.handle({ ...req, method: 'POST', originalUrl: req.baseUrl }, res);
});

// DELETE inspection
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        await db.collection(COLLECTION_NAME).doc(id).delete();

        res.status(200).json({ status: 'success', message: 'Vistoria deletada' });
    } catch (error) {
        console.error(`[Inspection API] Error DELETE /${req.params.id}:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao deletar vistoria' });
    }
});

module.exports = router;
