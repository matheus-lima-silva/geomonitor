const crypto = require('crypto');

let poolInstance = null;

function normalizeEnv(value) {
    return String(value || '').trim();
}

function deepClone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function buildPgConnectionOptions() {
    const connectionString = normalizeEnv(process.env.DATABASE_URL || process.env.POSTGRES_URL);
    if (!connectionString) {
        throw new Error('DATABASE_URL nao configurada para DATA_BACKEND=postgres');
    }

    const sslMode = normalizeEnv(process.env.POSTGRES_SSL || process.env.PGSSLMODE).toLowerCase();
    const shouldDisableSsl = ['false', '0', 'disable', 'disabled', 'off'].includes(sslMode);

    return {
        connectionString,
        ssl: shouldDisableSsl ? false : { rejectUnauthorized: false },
        max: Number.isFinite(Number(process.env.POSTGRES_POOL_MAX)) ? Number(process.env.POSTGRES_POOL_MAX) : 10,
        idleTimeoutMillis: Number.isFinite(Number(process.env.POSTGRES_IDLE_TIMEOUT_MS)) ? Number(process.env.POSTGRES_IDLE_TIMEOUT_MS) : 30000,
        application_name: normalizeEnv(process.env.POSTGRES_APP_NAME) || 'geomonitor-backend',
    };
}

function getPool() {
    if (poolInstance) return poolInstance;
    const { Pool } = require('pg');
    poolInstance = new Pool(buildPgConnectionOptions());
    return poolInstance;
}

async function query(text, params = []) {
    return getPool().query(text, params);
}

function wrapDoc(docId, payload) {
    return {
        exists: payload !== undefined,
        id: String(docId),
        data: () => deepClone(payload),
    };
}

async function listDocs(collectionName) {
    const result = await query(
        `
            SELECT doc_id, payload
            FROM document_store
            WHERE collection_name = $1
            ORDER BY doc_id ASC
        `,
        [collectionName],
    );

    return result.rows.map((row) => ({
        id: row.doc_id,
        data: () => deepClone(row.payload),
    }));
}

async function getDoc(collectionName, docId) {
    const result = await query(
        `
            SELECT payload
            FROM document_store
            WHERE collection_name = $1
              AND doc_id = $2
            LIMIT 1
        `,
        [collectionName, docId],
    );

    if (result.rows.length === 0) {
        return wrapDoc(docId, undefined);
    }

    return wrapDoc(docId, result.rows[0].payload);
}

async function setDoc(collectionName, docId, payload, options = {}) {
    let nextPayload = deepClone(payload);

    if (options && options.merge) {
        const existingDoc = await getDoc(collectionName, docId);
        const current = existingDoc.exists ? existingDoc.data() : {};
        nextPayload = {
            ...(current && typeof current === 'object' ? current : {}),
            ...(nextPayload && typeof nextPayload === 'object' ? nextPayload : {}),
        };
    }

    await query(
        `
            INSERT INTO document_store (collection_name, doc_id, payload, created_at, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW(), NOW())
            ON CONFLICT (collection_name, doc_id)
            DO UPDATE
              SET payload = EXCLUDED.payload,
                  updated_at = NOW()
        `,
        [collectionName, docId, JSON.stringify(nextPayload || {})],
    );
}

async function deleteDoc(collectionName, docId) {
    await query(
        `
            DELETE FROM document_store
            WHERE collection_name = $1
              AND doc_id = $2
        `,
        [collectionName, docId],
    );
}

async function closePool() {
    if (!poolInstance) return;
    await poolInstance.end();
    poolInstance = null;
}

function buildMigrationRecord(filename, checksum) {
    return {
        id: `migration-${crypto.randomUUID()}`,
        filename,
        checksum,
    };
}

module.exports = {
    buildMigrationRecord,
    buildPgConnectionOptions,
    query,
    listDocs,
    getDoc,
    setDoc,
    deleteDoc,
    closePool,
    __getPool: getPool,
};
