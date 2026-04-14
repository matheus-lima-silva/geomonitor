const postgresStore = require('./postgresStore');

function getConfiguredDataBackend() {
    return 'postgres';
}

function getDataStore() {
    return postgresStore;
}

module.exports = {
    getConfiguredDataBackend,
    getDataStore,
};
