const firestoreStore = require('./firestoreStore');

function getConfiguredDataBackend() {
    return String(process.env.DATA_BACKEND || 'firestore').trim().toLowerCase();
}

function getDataStore() {
    const backend = getConfiguredDataBackend();

    if (backend === 'firestore') {
        return firestoreStore;
    }

    if (backend === 'postgres') {
        return require('./postgresStore');
    }

    throw new Error(`DATA_BACKEND nao suportado nesta fase: ${backend}`);
}

module.exports = {
    getConfiguredDataBackend,
    getDataStore,
};
