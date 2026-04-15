// Wrapper para handlers async que encaminha rejeicoes ao middleware global
// de erro em server.js. Elimina o padrao repetitivo try/catch/500 que
// aparecia em ~99 handlers espalhados pelas rotas.
//
// Uso:
//   router.get('/', asyncHandler(async (req, res) => {
//       const items = await repo.list();
//       res.json({ status: 'success', data: items });
//   }));

function asyncHandler(fn) {
    return function asyncHandlerWrapper(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Lista de headers e campos que nunca devem aparecer em logs de erro.
const SENSITIVE_HEADER_KEYS = new Set([
    'authorization',
    'cookie',
    'x-worker-token',
    'proxy-authorization',
    'x-api-key',
]);

const SENSITIVE_BODY_KEYS = new Set([
    'password',
    'newpassword',
    'currentpassword',
    'passwordhash',
    'password_hash',
    'token',
    'refreshtoken',
    'refresh_token',
    'accesstoken',
    'access_token',
    'resettoken',
    'reset_token',
    'secret',
]);

function redactObject(source, sensitiveKeys) {
    if (!source || typeof source !== 'object') return source;
    const clean = {};
    for (const [key, value] of Object.entries(source)) {
        if (sensitiveKeys.has(String(key).toLowerCase())) {
            clean[key] = '[REDACTED]';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            clean[key] = redactObject(value, sensitiveKeys);
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

/**
 * Loga um erro de forma segura. Em producao, nao imprime stack traces completos
 * nem req.body/headers. Em dev, imprime o erro inteiro para facilitar debug.
 */
function logError(context, error, extra = {}) {
    const isProd = process.env.NODE_ENV === 'production';
    const payload = {
        context,
        message: error?.message || String(error),
        code: error?.code,
        name: error?.name,
    };

    if (!isProd) {
        payload.stack = error?.stack;
    }

    if (extra && typeof extra === 'object') {
        if (extra.headers) {
            payload.headers = redactObject(extra.headers, SENSITIVE_HEADER_KEYS);
        }
        if (extra.body) {
            payload.body = redactObject(extra.body, SENSITIVE_BODY_KEYS);
        }
        if (extra.userId) payload.userId = extra.userId;
        if (extra.route) payload.route = extra.route;
    }

    console.error(`[${context}]`, payload);
}

module.exports = {
    asyncHandler,
    logError,
    redactObject,
    SENSITIVE_HEADER_KEYS,
    SENSITIVE_BODY_KEYS,
};
