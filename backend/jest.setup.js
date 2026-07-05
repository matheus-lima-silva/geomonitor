// Jest setup — define variaveis de ambiente minimas para que rotas que
// dependem de JWT/bancos possam ser importadas em testes de integracao sem
// crashar na carga do modulo.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Fallbacks de secret existem SO para permitir importar rotas em teste sem
// configurar env real. Nunca aplicar fora de NODE_ENV=test: em qualquer outro
// ambiente a ausencia do secret deve falhar alto (utils/jwt.js lanca), evitando
// que um deploy suba com um secret fraco e conhecido.
if (process.env.NODE_ENV === 'test') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-please-change';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-please-change';
}

