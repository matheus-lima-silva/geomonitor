const { getConfiguredDataBackend, getDataStore } = require('../data');
const postgresStore = require('../data/postgresStore');

function isPostgresBackend() {
    return getConfiguredDataBackend() === 'postgres';
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalizeText(value).toUpperCase();
}

function clone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

async function getFirestoreDoc(collectionName, docId) {
    const doc = await getDataStore().getDoc(collectionName, docId);
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function listFirestoreDocs(collectionName) {
    const docs = await getDataStore().listDocs(collectionName);
    return docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function saveFirestoreDoc(collectionName, docId, payload, options = {}) {
    if (options.merge) {
        const current = await getFirestoreDoc(collectionName, docId);
        const nextPayload = {
            ...(current && typeof current === 'object' ? current : {}),
            ...(payload && typeof payload === 'object' ? payload : {}),
        };
        await getDataStore().setDoc(collectionName, docId, nextPayload, { merge: false });
        return nextPayload;
    }

    await getDataStore().setDoc(collectionName, docId, payload, { merge: false });
    return payload;
}

function buildMetadata(payload, row = {}) {
    return {
        ...(payload && typeof payload === 'object' ? clone(payload) : {}),
        ...(row.id ? { id: row.id } : {}),
        ...(row.created_at ? { createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at } : {}),
        ...(row.updated_at ? { updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at } : {}),
        ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    };
}

module.exports = {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    normalizeKey,
    clone,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
    buildMetadata,
};
