const postgresStore = require('../data/postgresStore');

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalizeText(value).toUpperCase();
}

function clone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
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
    normalizeText,
    normalizeKey,
    clone,
    buildMetadata,
};
