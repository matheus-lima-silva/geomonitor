// Pool do postgresStore e encerrada no afterAll da suite via closePbtPool.
// Nada a fazer globalmente — mantido para simetria com globalSetup.
module.exports = async function globalTeardown() {
    // noop
};
