// Defesa em profundidade: mesmo que o userRepository hoje NAO grave credenciais
// (senhas ficam em auth_credentials), qualquer response que devolve um perfil de
// usuario passa por aqui para garantir que campos sensiveis nunca vazem caso um
// dia escapem para o payload (legado, import, bug).

const SENSITIVE_KEY_PATTERNS = [
    /^password/i,
    /password_?hash$/i,
    /^reset_?token/i,
    /^reset_?token_?expires/i,
    /^refresh_?token/i,
    /^access_?token/i,
    /^migration_?pending/i,
    /secret/i,
];

function isSensitiveKey(key) {
    const k = String(key || '');
    return SENSITIVE_KEY_PATTERNS.some((re) => re.test(k));
}

/**
 * Remove campos sensiveis de um objeto de usuario. Retorna um NOVO objeto,
 * nao mutando o original. Aceita null/undefined sem lancar.
 */
function sanitizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    const clean = {};
    for (const [key, value] of Object.entries(user)) {
        if (isSensitiveKey(key)) continue;
        clean[key] = value;
    }
    return clean;
}

/**
 * Variante para listas.
 */
function sanitizeUsers(users) {
    if (!Array.isArray(users)) return [];
    return users.map(sanitizeUser);
}

module.exports = {
    sanitizeUser,
    sanitizeUsers,
    isSensitiveKey,
};
