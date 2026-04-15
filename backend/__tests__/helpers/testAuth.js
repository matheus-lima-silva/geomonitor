const { signAccessToken } = require('../../utils/jwt');

/**
 * Cria um Bearer token valido para testes. Usa o mesmo signAccessToken que o
 * /login usa, entao passa sem modificar a verificacao JWT.
 *
 * Nao fornece perfil ativo — para isso os testes precisam mockar
 * authMiddleware.setCachedProfile ou userRepository.getById.
 */
function createTestAuthHeader({ userId = 'test-user', email = 'test@test.local' } = {}) {
    const token = signAccessToken({ userId, email });
    return { Authorization: `Bearer ${token}` };
}

module.exports = {
    createTestAuthHeader,
};
