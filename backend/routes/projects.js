const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/firebaseSetup');
const { verifyToken } = require('../utils/authMiddleware');
const { createHateoasResponse } = require('../utils/hateoas');

const COLLECTION_NAME = 'projects';

// GET all projects
router.get('/', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION_NAME).get();

        const projects = snapshot.docs.map(doc =>
            createHateoasResponse(req, doc.data(), 'projects', doc.id)
        );

        res.status(200).json({ status: 'success', data: projects });
    } catch (error) {
        console.error(`[Project API] Error GET:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar projetos' });
    }
});

// GET single project
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const doc = await db.collection(COLLECTION_NAME).doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Projeto não encontrado' });
        }

        res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'projects', doc.id)
        });
    } catch (error) {
        console.error(`[Project API] Error GET /${req.params.id}:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar projeto' });
    }
});

// POST / PUT - Save project
router.post('/', verifyToken, async (req, res) => {
    try {
        const { data, meta = {} } = req.body;

        if (!data || !data.id) {
            return res.status(400).json({ status: 'error', message: 'ID e dados são obrigatórios' });
        }

        const db = getDb();
        const id = String(data.id).trim().toUpperCase();

        const mergedData = {
            ...data,
            id,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API'
        };

        await db.collection(COLLECTION_NAME).doc(id).set(mergedData, { merge: true });

        res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, { id }, 'projects', id)
        });
    } catch (error) {
        console.error(`[Project API] Error POST:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
});

router.put('/:id', verifyToken, async (req, res) => {
    // Can reuse the post logic, simply extracting ID from URL
    req.body.data = req.body.data || {};
    req.body.data.id = req.params.id;

    // Forward to POST route
    return router.handle({ ...req, method: 'POST', originalUrl: req.baseUrl }, res);
});

// DELETE project
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        await db.collection(COLLECTION_NAME).doc(id).delete();

        res.status(200).json({ status: 'success', message: 'Projeto deletado' });
    } catch (error) {
        console.error(`[Project API] Error DELETE /${req.params.id}:`, error);
        res.status(500).json({ status: 'error', message: 'Erro ao deletar projeto' });
    }
});

module.exports = router;
