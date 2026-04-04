const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { verifyToken, requireAdmin, getCachedProfile, setCachedProfile, invalidateCachedProfile } = require('../utils/authMiddleware');
const { createHateoasResponse } = require('../utils/hateoas');
const { buildBootstrapProfile, loadUserProfile, sanitizeUserProfileInput } = require('../utils/userProfiles');
const { userRepository } = require('../repositories');
const authCredentials = require('../repositories/authCredentialsRepository');
const userSignatoryRepository = require('../repositories/userSignatoryRepository');
const { getMailTransport, sendResetEmail } = require('../utils/mailer');

const ADMIN_RESET_TOKEN_EXPIRY_HOURS = 48;

const MANAGER_ROLES = new Set(['Admin', 'Administrador', 'Editor', 'Gerente']);
const adminGuards = Array.isArray(requireAdmin) ? requireAdmin : [requireAdmin];

async function loadRequesterProfile(req) {
    if (req.userProfile) return req.userProfile;

    const userId = String(req.user?.uid || '').trim();
    if (!userId) return null;

    const cached = getCachedProfile(userId);
    if (cached) {
        req.userProfile = cached;
        return req.userProfile;
    }

    req.userProfile = await loadUserProfile(userId);
    if (req.userProfile) setCachedProfile(userId, req.userProfile);
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

        const existingData = await userRepository.getById(id);

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

        await userRepository.save(nextData, { merge: true });
        invalidateCachedProfile(id);

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

        const items = (await userRepository.list()).map((item) => createHateoasResponse(req, item, 'users', item.id));
        return res.status(200).json({ status: 'success', data: items });
    } catch (error) {
        console.error('[users API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar utilizadores' });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const profile = await loadRequesterProfile(req);
        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Perfil nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, profile, 'users', profile.id || req.user?.uid),
        });
    } catch (error) {
        console.error('[users API] Error GET /me:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar perfil do utilizador autenticado' });
    }
});

// --- Signatarios do usuario autenticado ---

router.get('/me/signatarios', verifyToken, async (req, res) => {
    try {
        const userId = String(req.user?.uid || '').trim();
        const items = await userSignatoryRepository.listByUser(userId);
        return res.status(200).json({ status: 'success', data: items });
    } catch (error) {
        console.error('[users API] Error GET /me/signatarios:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar signatarios.' });
    }
});

router.post('/me/signatarios', verifyToken, async (req, res) => {
    try {
        const userId = String(req.user?.uid || '').trim();
        const { nome, profissao_id, registro_conselho, registro_estado, registro_numero, registro_sufixo } = req.body || {};
        if (!nome || !String(nome).trim()) {
            return res.status(400).json({ status: 'error', message: 'Nome e obrigatorio.' });
        }
        const created = await userSignatoryRepository.create({
            userId,
            nome: String(nome).trim(),
            profissaoId: profissao_id || null,
            registroConselho: registro_conselho || '',
            registroEstado: registro_estado || '',
            registroNumero: registro_numero || '',
            registroSufixo: registro_sufixo || '',
        });
        return res.status(201).json({ status: 'success', data: created });
    } catch (error) {
        console.error('[users API] Error POST /me/signatarios:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao criar signatario.' });
    }
});

router.put('/me/signatarios/:sigId', verifyToken, async (req, res) => {
    try {
        const userId = String(req.user?.uid || '').trim();
        const existing = await userSignatoryRepository.getById(req.params.sigId);
        if (!existing || existing.user_id !== userId) {
            return res.status(404).json({ status: 'error', message: 'Signatario nao encontrado.' });
        }
        const { nome, profissao_id, registro_conselho, registro_estado, registro_numero, registro_sufixo } = req.body || {};
        const updated = await userSignatoryRepository.update(req.params.sigId, {
            nome: String(nome || existing.nome).trim(),
            profissaoId: profissao_id !== undefined ? profissao_id : existing.profissao_id,
            registroConselho: registro_conselho !== undefined ? registro_conselho : existing.registro_conselho,
            registroEstado: registro_estado !== undefined ? registro_estado : existing.registro_estado,
            registroNumero: registro_numero !== undefined ? registro_numero : existing.registro_numero,
            registroSufixo: registro_sufixo !== undefined ? registro_sufixo : existing.registro_sufixo,
        });
        return res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
        console.error('[users API] Error PUT /me/signatarios/:sigId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao atualizar signatario.' });
    }
});

router.delete('/me/signatarios/:sigId', verifyToken, async (req, res) => {
    try {
        const userId = String(req.user?.uid || '').trim();
        const existing = await userSignatoryRepository.getById(req.params.sigId);
        if (!existing || existing.user_id !== userId) {
            return res.status(404).json({ status: 'error', message: 'Signatario nao encontrado.' });
        }
        await userSignatoryRepository.remove(req.params.sigId);
        return res.status(200).json({ status: 'success', message: 'Signatario removido.' });
    } catch (error) {
        console.error('[users API] Error DELETE /me/signatarios/:sigId:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao remover signatario.' });
    }
});

router.post('/bootstrap', verifyToken, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
        const userId = String(req.user?.uid || '').trim();

        if (!userId) {
            return res.status(400).json({ status: 'error', message: 'Utilizador autenticado invalido' });
        }

        const allUsers = await userRepository.list();
        const hasActiveAdmin = allUsers.some(
            (u) => u.perfil === 'Administrador' && u.status === 'Ativo',
        );

        const existingProfile = await loadUserProfile(userId);
        if (existingProfile) {
            if (!hasActiveAdmin && existingProfile.perfil !== 'Administrador') {
                existingProfile.perfil = 'Administrador';
                existingProfile.status = 'Ativo';
                existingProfile.updatedAt = new Date().toISOString();
                await userRepository.save(existingProfile, { merge: true });
                invalidateCachedProfile(userId);
            }
            return res.status(200).json({
                status: 'success',
                data: createHateoasResponse(req, existingProfile, 'users', userId),
            });
        }

        const isFirstUser = allUsers.length === 0;

        const profile = buildBootstrapProfile(req.user, sanitizeUserProfileInput(data), {
            updatedBy: meta.updatedBy || req.user?.email || 'API',
        });

        if (isFirstUser) {
            profile.perfil = 'Administrador';
            profile.status = 'Ativo';
        }

        await userRepository.save(profile, { merge: true });
        invalidateCachedProfile(userId);

        return res.status(201).json({
            status: 'success',
            data: createHateoasResponse(req, profile, 'users', userId),
        });
    } catch (error) {
        console.error('[users API] Error POST /bootstrap:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao inicializar perfil do utilizador' });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        const requesterProfile = await loadRequesterProfile(req);
        const isSelf = String(req.user?.uid || '').trim() === String(req.params.id || '').trim();
        if (!isSelf && !canManageUsers(requesterProfile)) {
            return res.status(403).json(buildUserAuthorizationError());
        }

        const user = await userRepository.getById(req.params.id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Registro nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, user, 'users', user.id),
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

router.post('/:id/send-reset', verifyToken, ...adminGuards, async (req, res) => {
    try {
        const targetId = String(req.params.id || '').trim();

        const profile = await userRepository.getById(targetId);
        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
        }

        const creds = await authCredentials.getByUserId(targetId);
        if (!creds) {
            return res.status(404).json({ status: 'error', message: 'Credenciais não encontradas para este usuário. O usuário pode ainda não ter sido migrado.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + ADMIN_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await authCredentials.setResetToken(creds.email, resetToken, expiresAt);

        const transport = getMailTransport();
        if (transport) {
            await sendResetEmail(transport, creds.email, resetToken, ADMIN_RESET_TOKEN_EXPIRY_HOURS);
        } else {
            console.warn(`[users API] SMTP não configurado. Reset token gerado para ${creds.email} mas email não enviado.`);
        }

        return res.status(200).json({ status: 'success', message: 'Email de reset enviado.' });
    } catch (error) {
        console.error('[users API] Error POST /:id/send-reset:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao enviar email de reset.' });
    }
});

router.delete('/:id', verifyToken, ...adminGuards, async (req, res) => {
    try {
        await userRepository.remove(req.params.id);
        return res.status(200).json({ status: 'success', message: 'Registro deletado' });
    } catch (error) {
        console.error('[users API] Error DELETE /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar utilizador' });
    }
});

module.exports = router;
