const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { rulesConfigRepository } = require('../repositories');
const { createSingletonHateoasResponse } = require('../utils/hateoas');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { rulesUpdateSchema } = require('../schemas/rulesSchemas');

router.get('/', verifyToken, requireActiveUser, asyncHandler(async (req, res) => {
    const config = await rulesConfigRepository.get();
    if (!config) {
        return res.status(200).json({ status: 'success', data: null });
    }

    return res.status(200).json({
        status: 'success',
        data: createSingletonHateoasResponse(req, config, 'rules'),
    });
}));

router.put('/', verifyToken, requireEditor, validateBody(rulesUpdateSchema), asyncHandler(async (req, res) => {
    const { data, meta = {} } = req.body;

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
}));

module.exports = router;
