const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireAdmin } = require('../utils/authMiddleware');
const profissaoRepository = require('../repositories/profissaoRepository');
const { createHateoasResponse } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { profissaoCreateSchema } = require('../schemas/profissaoSchemas');

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const items = (await profissaoRepository.list())
        .map((item) => createHateoasResponse(req, item, 'profissoes', item.id));
    return res.status(200).json({ status: 'success', data: items });
}));

router.post('/', verifyToken, ...adminGuards, validateBody(profissaoCreateSchema), asyncHandler(async (req, res) => {
    const { id, nome } = req.body;
    const created = await profissaoRepository.create({ id, nome });
    return res.status(201).json({
        status: 'success',
        data: createHateoasResponse(req, created, 'profissoes', created.id),
    });
}));

router.delete('/:id', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    await profissaoRepository.remove(req.params.id);
    return res.status(204).send();
}));

module.exports = router;
