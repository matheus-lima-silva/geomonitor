const {
    runInRequestContext,
    getRequestStore,
    getAlertThreshold,
    runWithoutCounting,
} = require('../utils/queryCounter');

// Peso maximo aceitavel de url que gravamos na tabela de alertas.
// Protege contra URLs patologicas com query string gigante.
const MAX_URL_LENGTH = 1024;

function truncate(value, max) {
    if (typeof value !== 'string') return value;
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function safeEmit(level, payload) {
    const line = JSON.stringify(payload);
    if (level === 'warn') {
        console.warn(line);
    } else {
        console.log(line);
    }
}

function resolveUserId(req) {
    return req?.user?.email || req?.user?.uid || null;
}

/**
 * Middleware Express que conta quantas queries Postgres uma request produz.
 *
 * - Wrapper de next() dentro de um AsyncLocalStorage garante que cada request
 *   tenha o proprio contador isolado.
 * - Ao fim da response (res.on('finish')), se a contagem passou do threshold,
 *   loga um alerta JSON e, se injetado, persiste em `system_alerts` via
 *   `systemAlertsRepository`.
 * - O repo e injetavel pra facilitar teste; em producao usamos a dependencia
 *   real.
 */
function createQueryCounterMiddleware(options = {}) {
    const repository = options.repository;
    const debug = options.debug ?? process.env.DEBUG_QUERY_COUNT === '1';

    return function queryCounterMiddleware(req, res, next) {
        runInRequestContext(() => {
            const finalize = () => {
                res.removeListener('finish', finalize);
                res.removeListener('close', finalize);

                const store = getRequestStore();
                if (!store) return;

                const threshold = getAlertThreshold();
                const count = store.count;
                const durationMs = Date.now() - store.startedAt;
                const method = req.method;
                const url = truncate(req.originalUrl || req.url || '', MAX_URL_LENGTH);
                const status = res.statusCode;
                const userId = resolveUserId(req);
                const exceeded = count > threshold;

                const payload = {
                    level: exceeded ? 'warn' : 'info',
                    type: exceeded ? 'query_count_alert' : 'query_count',
                    method,
                    url,
                    status,
                    count,
                    threshold,
                    durationMs,
                    userId,
                };

                if (exceeded) {
                    safeEmit('warn', payload);
                    if (repository && typeof repository.insert === 'function') {
                        runWithoutCounting(async () => {
                            try {
                                await repository.insert({
                                    type: 'query_count_exceeded',
                                    payload: {
                                        method,
                                        url,
                                        status,
                                        count,
                                        threshold,
                                        durationMs,
                                        userId,
                                    },
                                });
                            } catch (err) {
                                console.error('[queryCounter] falha ao persistir alerta:', err?.message || err);
                            }
                        });
                    }
                } else if (debug) {
                    safeEmit('info', payload);
                }
            };

            res.on('finish', finalize);
            res.on('close', finalize);
            next();
        });
    };
}

module.exports = {
    createQueryCounterMiddleware,
};
