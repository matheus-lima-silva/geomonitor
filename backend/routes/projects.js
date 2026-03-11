const express = require('express');
const router = express.Router();
const { getCollection, getDocRef } = require('../utils/firebaseSetup');
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('../utils/authMiddleware');
const { createHateoasResponse, generateHateoasLinks } = require('../utils/hateoas');

const COLLECTION_NAME = 'projects';

async function saveProjectHandler(req, res) {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { data, meta = {} } = body;

        if (!data || !data.id) {
            return res.status(400).json({ status: 'error', message: 'ID e dados sao obrigatorios' });
        }

        const id = String(data.id).trim().toUpperCase();
        const mergedData = {
            ...data,
            id,
            _links: generateHateoasLinks(req, 'projects', id),
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        await getDocRef(COLLECTION_NAME, id).set(mergedData, { merge: true });

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, { id }, 'projects', id),
        });
    } catch (error) {
        console.error('[Project API] Error POST:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar projeto' });
    }
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const snapshot = await getCollection(COLLECTION_NAME).get();
        const projects = snapshot.docs.map((doc) => createHateoasResponse(req, doc.data(), 'projects', doc.id));
        return res.status(200).json({ status: 'success', data: projects });
    } catch (error) {
        console.error('[Project API] Error GET:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar projetos' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await getDocRef(COLLECTION_NAME, id).get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Projeto nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'projects', doc.id),
        });
    } catch (error) {
        console.error(`[Project API] Error GET /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar projeto' });
    }
});

router.post('/', verifyToken, requireEditor, saveProjectHandler);

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
    return saveProjectHandler(req, res);
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await getDocRef(COLLECTION_NAME, id).delete();
        return res.status(200).json({ status: 'success', message: 'Projeto deletado' });
    } catch (error) {
        console.error(`[Project API] Error DELETE /${req.params.id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar projeto' });
    }
});

module.exports = router;
