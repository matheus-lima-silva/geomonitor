const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const authCredentials = require('../repositories/authCredentialsRepository');
const { buildBootstrapProfile, loadUserProfile, saveUserProfile } = require('../utils/userProfiles');
const { userRepository } = require('../repositories');
const { getMailTransport, sendResetEmail } = require('../utils/mailer');

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 12;
const MIGRATION_PENDING_HASH = 'MIGRATION_PENDING';
const RESET_TOKEN_EXPIRY_HOURS = 1;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX_UPPER = /[A-Z]/;
const PASSWORD_REGEX_LOWER = /[a-z]/;
const PASSWORD_REGEX_NUMBER = /[0-9]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
    return EMAIL_REGEX.test(String(email || '').trim());
}

function validatePassword(password) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
        return 'A senha deve ter pelo menos 8 caracteres.';
    }
    if (!PASSWORD_REGEX_UPPER.test(password)) {
        return 'A senha deve conter pelo menos uma letra maiúscula.';
    }
    if (!PASSWORD_REGEX_LOWER.test(password)) {
        return 'A senha deve conter pelo menos uma letra minúscula.';
    }
    if (!PASSWORD_REGEX_NUMBER.test(password)) {
        return 'A senha deve conter pelo menos um número.';
    }
    return null;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, nome } = req.body || {};
        const trimmedEmail = String(email || '').trim();
        const trimmedNome = String(nome || '').trim();

        if (!trimmedEmail || !validateEmail(trimmedEmail)) {
            return res.status(400).json({ status: 'error', code: 'INVALID_EMAIL', message: 'Email inválido.' });
        }

        if (!trimmedNome) {
            return res.status(400).json({ status: 'error', code: 'MISSING_NAME', message: 'Nome é obrigatório.' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ status: 'error', code: 'WEAK_PASSWORD', message: passwordError });
        }

        const existing = await authCredentials.getByEmail(trimmedEmail);
        if (existing) {
            return res.status(409).json({ status: 'error', code: 'EMAIL_IN_USE', message: 'Este email já está cadastrado.' });
        }

        // Reuse existing profile if one already exists with this email (e.g. migrated from Firebase)
        const allUsers = await userRepository.list();
        const existingProfile = allUsers.find(
            (u) => String(u.email || '').trim().toLowerCase() === trimmedEmail.toLowerCase(),
        );

        const userId = existingProfile?.id || crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        await authCredentials.create({ userId, email: trimmedEmail, passwordHash });

        let profile;
        if (existingProfile) {
            profile = existingProfile;
        } else {
            profile = buildBootstrapProfile(
                { uid: userId, email: trimmedEmail },
                { nome: trimmedNome },
                { updatedBy: trimmedEmail },
            );
            await saveUserProfile(userId, profile);
        }

        return res.status(201).json({
            status: 'success',
            data: { user: profile },
        });
    } catch (error) {
        console.error('[auth] Register error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno ao registrar usuário.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const trimmedEmail = String(email || '').trim();

        if (!trimmedEmail || !password) {
            return res.status(400).json({ status: 'error', code: 'MISSING_CREDENTIALS', message: 'Email e senha são obrigatórios.' });
        }

        const creds = await authCredentials.getByEmail(trimmedEmail);
        if (!creds) {
            return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS', message: 'Email ou senha incorretos.' });
        }

        if (creds.password_hash === MIGRATION_PENDING_HASH) {
            return res.status(403).json({
                status: 'error',
                code: 'MIGRATION_RESET_REQUIRED',
                message: 'Sua conta foi migrada. Por favor, redefina sua senha.',
            });
        }

        const passwordValid = await bcrypt.compare(password, creds.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS', message: 'Email ou senha incorretos.' });
        }

        const profile = await loadUserProfile(creds.user_id);
        if (!profile) {
            return res.status(403).json({ status: 'error', code: 'PROFILE_NOT_FOUND', message: 'Perfil de usuário não encontrado.' });
        }

        const accessToken = signAccessToken({ userId: creds.user_id, email: creds.email });
        const refreshToken = signRefreshToken({ userId: creds.user_id });

        return res.status(200).json({
            status: 'success',
            data: { accessToken, refreshToken, user: profile },
        });
    } catch (error) {
        console.error('[auth] Login error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno ao autenticar.' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};

        if (!refreshToken) {
            return res.status(400).json({ status: 'error', message: 'Refresh token é obrigatório.' });
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch {
            return res.status(401).json({ status: 'error', code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token inválido ou expirado.' });
        }

        const creds = await authCredentials.getByUserId(decoded.sub);
        if (!creds) {
            return res.status(401).json({ status: 'error', message: 'Usuário não encontrado.' });
        }

        const newAccessToken = signAccessToken({ userId: creds.user_id, email: creds.email });
        const newRefreshToken = signRefreshToken({ userId: creds.user_id });

        return res.status(200).json({
            status: 'success',
            data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
        });
    } catch (error) {
        console.error('[auth] Refresh error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno ao renovar token.' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body || {};
        const trimmedEmail = String(email || '').trim();

        // Always return success to prevent email enumeration
        const successResponse = { status: 'success', message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.' };

        if (!trimmedEmail || !validateEmail(trimmedEmail)) {
            return res.status(200).json(successResponse);
        }

        const creds = await authCredentials.getByEmail(trimmedEmail);
        if (!creds) {
            return res.status(200).json(successResponse);
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await authCredentials.setResetToken(trimmedEmail, resetToken, expiresAt);

        const transport = getMailTransport();
        if (transport) {
            await sendResetEmail(transport, trimmedEmail, resetToken, RESET_TOKEN_EXPIRY_HOURS);
        } else {
            console.warn('[auth] SMTP não configurado. Reset token gerado mas email não enviado. Token:', resetToken);
        }

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('[auth] Reset password error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno ao solicitar redefinição de senha.' });
    }
});

// POST /api/auth/reset-password/confirm
router.post('/reset-password/confirm', async (req, res) => {
    try {
        const { token, newPassword } = req.body || {};

        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token é obrigatório.' });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ status: 'error', code: 'WEAK_PASSWORD', message: passwordError });
        }

        const creds = await authCredentials.getByResetToken(token);
        if (!creds) {
            return res.status(400).json({ status: 'error', code: 'INVALID_RESET_TOKEN', message: 'Token de redefinição inválido ou expirado.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        await authCredentials.updatePassword(creds.user_id, passwordHash);
        await authCredentials.clearResetToken(creds.user_id);

        return res.status(200).json({ status: 'success', message: 'Senha redefinida com sucesso.' });
    } catch (error) {
        console.error('[auth] Reset password confirm error:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno ao redefinir senha.' });
    }
});

module.exports = router;
