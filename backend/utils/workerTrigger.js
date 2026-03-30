const WORKER_URL = process.env.WORKER_INTERNAL_URL || process.env.WORKER_URL || '';

/**
 * Fire-and-forget: pings the worker to claim the next queued job.
 * Does not block the caller and silently swallows errors.
 */
function triggerWorkerRun() {
    if (!WORKER_URL) return;
    fetch(`${WORKER_URL}/run-once`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
    }).catch((err) => {
        console.warn('[workerTrigger] falha ao disparar worker:', err.message);
    });
}

module.exports = { triggerWorkerRun };
