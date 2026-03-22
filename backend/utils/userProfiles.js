const userRepository = require('../repositories/userRepository');

const DEFAULT_PROFILE = 'Utilizador';
const DEFAULT_STATUS = 'Pendente';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeOptionalBoolean(value, fallback = false) {
    if (value === true || value === false) return value;
    return fallback;
}

function sanitizeUserProfileInput(payload = {}) {
    return {
        nome: normalizeText(payload.nome),
        email: normalizeText(payload.email),
        cargo: normalizeText(payload.cargo),
        departamento: normalizeText(payload.departamento),
        telefone: normalizeText(payload.telefone),
        perfil: normalizeText(payload.perfil),
        status: normalizeText(payload.status),
        perfilAtualizadoPrimeiroLogin: normalizeOptionalBoolean(
            payload.perfilAtualizadoPrimeiroLogin,
            false,
        ),
    };
}

function buildBootstrapProfile(authUser = {}, payload = {}, meta = {}) {
    const input = sanitizeUserProfileInput(payload);
    const now = new Date().toISOString();

    return {
        id: normalizeText(authUser.uid),
        nome: input.nome || normalizeText(authUser.name) || normalizeText(authUser.displayName),
        email: input.email || normalizeText(authUser.email),
        cargo: input.cargo,
        departamento: input.departamento,
        telefone: input.telefone,
        perfil: input.perfil || DEFAULT_PROFILE,
        status: input.status || DEFAULT_STATUS,
        perfilAtualizadoPrimeiroLogin: input.perfilAtualizadoPrimeiroLogin === true,
        createdAt: now,
        updatedAt: now,
        updatedBy: normalizeText(meta.updatedBy) || normalizeText(authUser.email) || 'API',
    };
}

async function loadUserProfile(userId) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) return null;
    return userRepository.getById(normalizedUserId);
}

async function saveUserProfile(userId, payload, options = {}) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) {
        throw new Error('userId obrigatorio para salvar perfil.');
    }

    const data = {
        ...payload,
        id: normalizedUserId,
    };

    return userRepository.save(data, options);
}

module.exports = {
    DEFAULT_PROFILE,
    DEFAULT_STATUS,
    sanitizeUserProfileInput,
    buildBootstrapProfile,
    loadUserProfile,
    saveUserProfile,
};
