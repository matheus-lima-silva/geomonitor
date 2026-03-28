const { getCollection, getDocRef } = require('../utils/firebaseSetup');

async function listDocs(collectionName) {
    const snapshot = await getCollection(collectionName).get();
    return snapshot.docs;
}

async function getDoc(collectionName, docId) {
    return getDocRef(collectionName, docId).get();
}

async function setDoc(collectionName, docId, payload, options = {}) {
    return getDocRef(collectionName, docId).set(payload, options);
}

async function deleteDoc(collectionName, docId) {
    return getDocRef(collectionName, docId).delete();
}

module.exports = {
    listDocs,
    getDoc,
    setDoc,
    deleteDoc,
};
