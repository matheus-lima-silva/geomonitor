const express = require('express');
const { getCollection, getDocRef } = require('./firebaseSetup');
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('./authMiddleware');
const { createHateoasResponse, generateHateoasLinks } = require('./hateoas');

function createCrudRouter(collectionName, options = {}) {
    const router = express.Router();
    const routerName = options.routerName || collectionName;

    const prepareData = options.prepareData || ((data) => data);
    const generateId = options.generateId || ((data) => String(data.id || '').trim());

    async function saveHandler(req, res, isUpdate = false) {
        try {
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const { data, meta = {} } = body;

            if (!data) {
                return res.status(400).json({ status: 'error', message: 'Dados sao obrigatorios' });
            }

            const id = isUpdate ? req.params.id : generateId(data);
            
            if (!id) {
                return res.status(400).json({ status: 'error', message: 'ID é obrigatorio' });
            }

            const preparedData = prepareData(data);
            
            const mergedData = {
                ...preparedData,
                id,
                _links: generateHateoasLinks(req, routerName, id),
                updatedAt: new Date().toISOString(),
                updatedBy: meta.updatedBy || req.user?.email || 'API',
            };

            await getDocRef(collectionName, id).set(mergedData, { merge: true });

            return res.status(201).json({
                status: 'success',
                data: createHateoasResponse(req, { id }, routerName, id),
            });
        } catch (error) {
            console.error(`[${collectionName} API] Error POST/PUT:`, error);
            return res.status(500).json({ status: 'error', message: 'Erro ao salvar registro' });
        }
    }

    router.get('/', verifyToken, requireActiveUser, async (req, res) => {
        try {
            const snapshot = await getCollection(collectionName).get();
            const items = snapshot.docs.map((doc) => createHateoasResponse(req, doc.data(), routerName, doc.id));
            return res.status(200).json({ status: 'success', data: items });
        } catch (error) {
            console.error(`[${collectionName} API] Error GET:`, error);
            return res.status(500).json({ status: 'error', message: 'Erro ao buscar registros' });
        }
    });

    router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await getDocRef(collectionName, id).get();

            if (!doc.exists) {
                return res.status(404).json({ status: 'error', message: 'Registro nao encontrado' });
            }

            return res.status(200).json({
                status: 'success',
                data: createHateoasResponse(req, doc.data(), routerName, doc.id),
            });
        } catch (error) {
            console.error(`[${collectionName} API] Error GET /:id:`, error);
            return res.status(500).json({ status: 'error', message: 'Erro ao buscar registro' });
        }
    });

    router.post('/', verifyToken, requireEditor, (req, res) => saveHandler(req, res, false));

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
        return saveHandler(req, res, true);
    });

    router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            await getDocRef(collectionName, id).delete();
            return res.status(200).json({ status: 'success', message: 'Registro deletado' });
        } catch (error) {
            console.error(`[${collectionName} API] Error DELETE /:id:`, error);
            return res.status(500).json({ status: 'error', message: 'Erro ao deletar registro' });
        }
    });

    return router;
}

module.exports = createCrudRouter;
