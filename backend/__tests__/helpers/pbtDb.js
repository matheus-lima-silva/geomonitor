// Helpers de DB para testes property-based. Compartilha o pool instrumentado
// do postgresStore com o app — assim, efeitos de requests HTTP sao observaveis
// pelas queries de seed/assert do teste na mesma sessao logica do Postgres.
// getPool e exportado como __getPool para desencorajar uso fora de infra.
const postgresStore = require('../../data/postgresStore');

function getPbtPool() {
    return postgresStore.__getPool();
}

async function truncateAllPbtTables() {
    const pool = getPbtPool();
    await pool.query(`
        TRUNCATE
            workspace_members,
            report_workspaces,
            users
        RESTART IDENTITY CASCADE
    `);
}

async function closePbtPool() {
    try {
        if (typeof postgresStore.closePool === 'function') {
            await postgresStore.closePool();
        }
    } catch (_) {
        // Noop — pool ja encerrada ou nunca criada.
    }
}

module.exports = {
    getPbtPool,
    truncateAllPbtTables,
    closePbtPool,
};
