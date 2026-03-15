const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/authMiddleware');
const { getCollection, getDocRef } = require('../utils/firebaseSetup');
const { createHateoasResponse } = require('../utils/hateoas');

const MANAGER_ROLES = new Set(['Admin', 'Administrador', 'Editor', 'Gerente']);
const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

async function loadRequesterProfile(req) {
    if (req.userProfile) return req.userProfile;

    const userId = String(req.user?.uid || '').trim();
    if (!userId) return null;

    const doc = await getDocRef('users', userId).get();
    req.userProfile = doc.exists ? doc.data() : null;
    return req.userProfile;
}

function canManageUsers(profile) {
    return profile?.status === 'Ativo' && MANAGER_ROLES.has(String(profile?.perfil || '').trim());
}

function buildUserAuthorizationError() {
    return { status: 'error', message: 'Acesso negado. Nível de permissão insuficiente.' };
}

async function saveUserHandler(req, res, isUpdate = false) {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { data, meta = {} } = body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ status: 'error', message: 'Dados sao obrigatorios' });
        }

        const id = isUpdate ? req.params.id : String(data.id || '').trim();
        if (!id) {
            return res.status(400).json({ status: 'error', message: 'ID é obrigatorio' });
        }

        const requesterProfile = await loadRequesterProfile(req);
        const isSelf = String(req.user?.uid || '').trim() === id;
        const canManage = canManageUsers(requesterProfile);

        if (!isSelf && !canManage) {
            return res.status(403).json(buildUserAuthorizationError());
        }

        const existingDoc = await getDocRef('users', id).get();
        const existingData = existingDoc.exists ? existingDoc.data() : null;

        const nextData = {
            ...(existingData || {}),
            ...data,
            id,
            updatedAt: new Date().toISOString(),
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        };

        if (!canManage && isSelf) {
            nextData.perfil = existingData?.perfil || requesterProfile?.perfil || 'Utilizador';
            nextData.status = existingData?.status || requesterProfile?.status || 'Pendente';
        }

        await getDocRef('users', id).set(nextData, { merge: true });

        return res.status(isUpdate ? 200 : 201).json({
            status: 'success',
            data: createHateoasResponse(req, nextData, 'users', id),
        });
    } catch (error) {
        console.error('[users API] Error POST/PUT:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao salvar utilizador' });
    }
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const requesterProfile = await loadRequesterProfile(req);
        if (!canManageUsers(requesterProfile)) {
            return res.status(403).json(buildUserAuthorizationError());
        }

        const snapshot = await getCollection('users').get();
        const items = snapshot.docs.map((doc) => createHateoasResponse(req, doc.data(), 'users', doc.id));
        return res.status(200).json({ status: 'success', data: items });
    } catch (error) {
        console.error('[users API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar utilizadores' });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        const requesterProfile = await loadRequesterProfile(req);
        const isSelf = String(req.user?.uid || '').trim() === String(req.params.id || '').trim();
        if (!isSelf && !canManageUsers(requesterProfile)) {
            return res.status(403).json(buildUserAuthorizationError());
        }

        const doc = await getDocRef('users', req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Registro nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, doc.data(), 'users', doc.id),
        });
    } catch (error) {
        console.error('[users API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar utilizador' });
    }
});

router.post('/', verifyToken, (req, res) => saveUserHandler(req, res, false));

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
    return saveUserHandler(req, res, true);
});

router.delete('/:id', verifyToken, ...adminGuards, async (req, res) => {
    try {
        await getDocRef('users', req.params.id).delete();
        return res.status(200).json({ status: 'success', message: 'Registro deletado' });
    } catch (error) {
        console.error('[users API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar utilizador' });
    }
});

module.exports = router;