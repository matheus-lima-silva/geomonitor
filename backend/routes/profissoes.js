const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/authMiddleware');
const profissaoRepository = require('../repositories/profissaoRepository');

const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

router.get('/', verifyToken, async (req, res) => {
    try {
        const items = await profissaoRepository.list();
        return res.status(200).json({ status: 'success', data: items });
    } catch (error) {
        console.error('[profissoes API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar profissoes.' });
    }
});

router.post('/', verifyToken, ...adminGuards, async (req, res) => {
    try {
        const { id, nome } = req.body || {};
        if (!id || !nome) {
            return res.status(400).json({ status: 'error', message: 'id e nome sao obrigatorios.' });
        }
        const created = await profissaoRepository.create({ id: String(id).trim(), nome: String(nome).trim() });
        return res.status(201).json({ status: 'success', data: created });
    } catch (error) {
        console.error('[profissoes API] Error POST /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar profissao.' });
    }
});

router.delete('/:id', verifyToken, ...adminGuards, async (req, res) => {
    try {
        await profissaoRepository.remove(req.params.id);
        return res.status(200).json({ status: 'success', message: 'Profissao removida.' });
    } catch (error) {
        console.error('[profissoes API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover profissao.' });
    }
});

module.exports = router;
