const {
    normalizeText,
    getFirestoreDoc,
} = require('./common');

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!normalizedId) return null;
    return getFirestoreDoc('reports', normalizedId);
}

module.exports = {
    getById,
};
