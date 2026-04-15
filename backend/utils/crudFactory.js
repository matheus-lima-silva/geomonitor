const express = require('express');
const { verifyToken, requireActiveUser, requireEditor, requireAdmin } = require('./authMiddleware');
const { createHateoasResponse, generateHateoasLinks, createPaginatedHateoasResponse } = require('./hateoas');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('./asyncHandler');

function createCrudRouter(collectionName, options = {}) {
    const router = express.Router();
    const routerName = options.routerName || collectionName;
    const repository = options.repository;
    if (!repository) {
        throw new Error(`createCrudRouter(${collectionName}): options.repository e obrigatorio`);
    }
    const listGuards = options.listGuards || [verifyToken, requireActiveUser];
    const getGuards = options.getGuards || [verifyToken, requireActiveUser];
    const createGuards = options.createGuards || [verifyToken, requireEditor];
    const updateGuards = options.updateGuards || [verifyToken, requireEditor];
    const deleteGuards = options.deleteGuards || [verifyToken, requireAdmin];

    const prepareData = options.prepareData || ((data) => data);
    const generateId = options.generateId || ((data) => String(data.id || '').trim());

    // Schemas Zod opcionais — quando fornecidos, validam req.body antes do handler.
    // Esperam a forma { data: {...}, meta?: {...} } que o factory ja usa.
    const createValidator = options.createSchema ? validateBody(options.createSchema) : null;
    const updateValidator = options.updateSchema ? validateBody(options.updateSchema) : null;

    async function saveHandler(req, res, isUpdate = false) {
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

        await repository.save(mergedData, { merge: true });

        return res.status(isUpdate ? 200 : 201).json({
            status: 'success',
            data: createHateoasResponse(req, mergedData, routerName, id),
        });
    }

    router.get('/', ...listGuards, asyncHandler(async (req, res) => {
        // Opt-in: paginacao so ativa quando ?page ou ?limit presentes.
        // Mantem compat com callers legados que esperam array completo.
        const wantsPagination = req.query.page != null || req.query.limit != null;
        if (wantsPagination && typeof repository.listPaginated === 'function') {
            const { items, total, page, limit } = await repository.listPaginated({
                page: req.query.page,
                limit: req.query.limit,
            });
            const envelope = createPaginatedHateoasResponse(req, items, {
                entityType: routerName,
                page,
                limit,
                total,
            });
            return res.status(200).json({ status: 'success', ...envelope });
        }

        const items = (await repository.list()).map((item) => createHateoasResponse(req, item, routerName, item.id));
        return res.status(200).json({ status: 'success', data: items });
    }));

    router.get('/:id', ...getGuards, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const record = await repository.getById(id);

        if (!record) {
            return res.status(404).json({ status: 'error', message: 'Registro nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, record, routerName, record.id),
        });
    }));

    const postMiddlewares = [...createGuards];
    if (createValidator) postMiddlewares.push(createValidator);
    router.post('/', ...postMiddlewares, asyncHandler((req, res) => saveHandler(req, res, false)));

    const putMiddlewares = [...updateGuards];
    if (updateValidator) putMiddlewares.push(updateValidator);
    router.put('/:id', ...putMiddlewares, asyncHandler(async (req, res) => {
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
    }));

    router.delete('/:id', ...deleteGuards, asyncHandler(async (req, res) => {
        const { id } = req.params;
        await repository.remove(id);
        return res.status(204).send();
    }));

    return router;
}

module.exports = createCrudRouter;
