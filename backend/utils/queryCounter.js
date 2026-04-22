const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

const DEFAULT_THRESHOLD = 15;

function getAlertThreshold() {
    const raw = process.env.QUERY_COUNT_ALERT_THRESHOLD;
    if (raw == null || raw === '') return DEFAULT_THRESHOLD;
    const parsed = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_THRESHOLD;
    return parsed;
}

function runInRequestContext(fn) {
    const store = {
        count: 0,
        startedAt: Date.now(),
        skip: false,
    };
    return storage.run(store, fn);
}

function getRequestStore() {
    return storage.getStore();
}

function incrementQueryCount() {
    const store = storage.getStore();
    if (!store || store.skip) return;
    store.count += 1;
}

// Permite o middleware desligar o contador durante a gravacao do proprio alerta
// (senao o INSERT em system_alerts contamina o proximo request ou dispara loop).
async function runWithoutCounting(fn) {
    const store = storage.getStore();
    if (!store) return fn();
    const previous = store.skip;
    store.skip = true;
    try {
        return await fn();
    } finally {
        store.skip = previous;
    }
}

module.exports = {
    DEFAULT_THRESHOLD,
    getAlertThreshold,
    runInRequestContext,
    getRequestStore,
    incrementQueryCount,
    runWithoutCounting,
};
