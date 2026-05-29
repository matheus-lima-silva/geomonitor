// Dispara N funcoes em paralelo via Promise.allSettled e reporta duracao.
// A intercalacao real fica a cargo do event loop + do agendador do Postgres.

async function runConcurrent(fns) {
    const started = Date.now();
    const settled = await Promise.allSettled(fns.map((fn) => fn()));
    return {
        settled,
        durationMs: Date.now() - started,
    };
}

module.exports = {
    runConcurrent,
};
