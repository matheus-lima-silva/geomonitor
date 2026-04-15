const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { verifyToken, requireAdmin, getCachedProfile, setCachedProfile, invalidateCachedProfile } = require('../utils/authMiddleware');
const { createHateoasResponse, createPaginatedHateoasResponse } = require('../utils/hateoas');
const { sanitizeUser, sanitizeUsers } = require('../utils/sanitizeUser');
const { asyncHandler } = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validate');
const {
    userCreateSchema,
    userUpdateSchema,
    userBootstrapSchema,
    signatorySchema,
    signatoryUpdateSchema,
} = require('../schemas/userSchemas');
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
    // Body ja validado por validateBody no middleware (userCreateSchema/userUpdateSchema).
    const { data, meta = {} } = req.body;

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
        data: createHateoasResponse(req, sanitizeUser(nextData), 'users', id),
    });
}

router.get('/', verifyToken, asyncHandler(async (req, res) => {
    const requesterProfile = await loadRequesterProfile(req);
    if (!canManageUsers(requesterProfile)) {
        return res.status(403).json(buildUserAuthorizationError());
    }

    const { items, total, page, limit } = await userRepository.listPaginated({
        page: req.query.page,
        limit: req.query.limit,
    });

    const sanitized = sanitizeUsers(items);
    const envelope = createPaginatedHateoasResponse(req, sanitized, {
        entityType: 'users',
        page,
        limit,
        total,
    });

    return res.status(200).json({ status: 'success', ...envelope });
}));

router.get('/me', verifyToken, asyncHandler(async (req, res) => {
    const profile = await loadRequesterProfile(req);
    if (!profile) {
        return res.status(404).json({ status: 'error', message: 'Perfil nao encontrado' });
    }

    return res.status(200).json({
        status: 'success',
        data: createHateoasResponse(req, sanitizeUser(profile), 'users', profile.id || req.user?.uid),
    });
}));

// --- Signatarios do usuario autenticado ---

router.get('/me/signatarios', verifyToken, asyncHandler(async (req, res) => {
    const userId = String(req.user?.uid || '').trim();
    const items = await userSignatoryRepository.listByUser(userId);
    return res.status(200).json({ status: 'success', data: items });
}));

router.post('/me/signatarios', verifyToken, validateBody(signatorySchema), asyncHandler(async (req, res) => {
    const userId = String(req.user?.uid || '').trim();
    const { nome, profissao_id, registro_conselho, registro_estado, registro_numero, registro_sufixo } = req.body;
    const created = await userSignatoryRepository.create({
        userId,
        nome,
        profissaoId: profissao_id || null,
        registroConselho: registro_conselho || '',
        registroEstado: registro_estado || '',
        registroNumero: registro_numero || '',
        registroSufixo: registro_sufixo || '',
    });
    return res.status(201).json({ status: 'success', data: created });
}));

router.put('/me/signatarios/:sigId', verifyToken, validateBody(signatoryUpdateSchema), asyncHandler(async (req, res) => {
    const userId = String(req.user?.uid || '').trim();
    const existing = await userSignatoryRepository.getById(req.params.sigId);
    if (!existing || existing.user_id !== userId) {
        return res.status(404).json({ status: 'error', message: 'Signatario nao encontrado.' });
    }
    const { nome, profissao_id, registro_conselho, registro_estado, registro_numero, registro_sufixo } = req.body;
    const updated = await userSignatoryRepository.update(req.params.sigId, {
        nome: (nome && nome.trim()) || existing.nome,
        profissaoId: profissao_id !== undefined ? profissao_id : existing.profissao_id,
        registroConselho: registro_conselho !== undefined ? registro_conselho : existing.registro_conselho,
        registroEstado: registro_estado !== undefined ? registro_estado : existing.registro_estado,
        registroNumero: registro_numero !== undefined ? registro_numero : existing.registro_numero,
        registroSufixo: registro_sufixo !== undefined ? registro_sufixo : existing.registro_sufixo,
    });
    return res.status(200).json({ status: 'success', data: updated });
}));

router.delete('/me/signatarios/:sigId', verifyToken, asyncHandler(async (req, res) => {
    const userId = String(req.user?.uid || '').trim();
    const existing = await userSignatoryRepository.getById(req.params.sigId);
    if (!existing || existing.user_id !== userId) {
        return res.status(404).json({ status: 'error', message: 'Signatario nao encontrado.' });
    }
    await userSignatoryRepository.remove(req.params.sigId);
    return res.status(204).send();
}));

router.post('/bootstrap', verifyToken, validateBody(userBootstrapSchema), asyncHandler(async (req, res) => {
    const { data = {}, meta = {} } = req.body;
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
            data: createHateoasResponse(req, sanitizeUser(existingProfile), 'users', userId),
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
        data: createHateoasResponse(req, sanitizeUser(profile), 'users', userId),
    });
}));

router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
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
        data: createHateoasResponse(req, sanitizeUser(user), 'users', user.id),
    });
}));

router.post('/', verifyToken, validateBody(userCreateSchema), asyncHandler((req, res) => saveUserHandler(req, res, false)));

router.put('/:id', verifyToken, validateBody(userUpdateSchema), asyncHandler(async (req, res) => {
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
}));

router.post('/:id/send-reset', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
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
}));

router.delete('/:id', verifyToken, ...adminGuards, asyncHandler(async (req, res) => {
    await userRepository.remove(req.params.id);
    return res.status(204).send();
}));

module.exports = router;
