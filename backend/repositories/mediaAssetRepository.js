const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
    deleteFirestoreDoc,
    buildMetadata,
} = require('./common');

function toSafeInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

const MEDIA_SELECT = `
    SELECT id, purpose, linked_resource_type, linked_resource_id, storage_key,
           content_type, size_bytes, sha256, status_execucao, source_kind,
           legacy_url, manual_review, payload, created_at, updated_at, updated_by
    FROM media_assets
`;

function hydrateRow(row) {
    return buildMetadata(
        {
            ...(row.payload || {}),
            purpose: row.purpose,
            linkedResourceType: row.linked_resource_type,
            linkedResourceId: row.linked_resource_id,
            storageKey: row.storage_key,
            contentType: row.content_type,
            sizeBytes: toSafeInteger(row.size_bytes),
            sha256: row.sha256,
            statusExecucao: row.status_execucao,
            sourceKind: row.source_kind,
            legacyUrl: row.legacy_url,
            manualReview: Boolean(row.manual_review),
        },
        row,
    );
}

async function list() {
    if (!isPostgresBackend()) {
        return listFirestoreDocs('mediaAssets');
    }

    const result = await postgresStore.query(`${MEDIA_SELECT} ORDER BY updated_at DESC, id ASC`);
    return result.rows.map((row) => hydrateRow(row));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('mediaAssets', normalizedId);
    }

    const result = await postgresStore.query(`${MEDIA_SELECT} WHERE id = $1 LIMIT 1`, [normalizedId]);
    return result.rows.length > 0 ? hydrateRow(result.rows[0]) : null;
}

async function listByLinkedResource(resourceType, resourceId) {
    const normalizedType = normalizeText(resourceType);
    const normalizedId = normalizeText(resourceId);

    if (!isPostgresBackend()) {
        const all = await listFirestoreDocs('mediaAssets');
        return all.filter(
            (item) => normalizeText(item.linkedResourceType) === normalizedType
                && normalizeText(item.linkedResourceId) === normalizedId,
        );
    }

    const result = await postgresStore.query(
        `${MEDIA_SELECT} WHERE linked_resource_type = $1 AND linked_resource_id = $2 ORDER BY updated_at DESC, id ASC`,
        [normalizedType, normalizedId],
    );
    return result.rows.map((row) => hydrateRow(row));
}

async function listByPurpose(purpose) {
    const normalizedPurpose = normalizeText(purpose);

    if (!isPostgresBackend()) {
        const all = await listFirestoreDocs('mediaAssets');
        return all.filter((item) => normalizeText(item.purpose) === normalizedPurpose);
    }

    const result = await postgresStore.query(
        `${MEDIA_SELECT} WHERE purpose = $1 ORDER BY updated_at DESC, id ASC`,
        [normalizedPurpose],
    );
    return result.rows.map((row) => hydrateRow(row));
}

async function markReady(id, sha256, sizeBytes) {
    const normalizedId = normalizeText(id);
    const asset = await getById(normalizedId);
    if (!asset) return null;

    return save({
        ...asset,
        id: normalizedId,
        statusExecucao: 'ready',
        sha256: normalizeText(sha256) || asset.sha256,
        sizeBytes: toSafeInteger(sizeBytes) || asset.sizeBytes,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}

async function markFailed(id, errorLog) {
    const normalizedId = normalizeText(id);
    const asset = await getById(normalizedId);
    if (!asset) return null;

    return save({
        ...asset,
        id: normalizedId,
        statusExecucao: 'failed',
        errorLog: String(errorLog || ''),
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}

async function save(payload, options = {}) {
    const normalizedId = normalizeText(payload?.id);
    const current = options.merge ? await getById(normalizedId) : null;
    const nextPayload = {
        ...(current || {}),
        ...(payload || {}),
        id: normalizedId,
    };

    if (!isPostgresBackend()) {
        return saveFirestoreDoc('mediaAssets', normalizedId, nextPayload, options);
    }

    await postgresStore.query(
        `
            INSERT INTO media_assets (
                id,
                purpose,
                linked_resource_type,
                linked_resource_id,
                storage_key,
                content_type,
                size_bytes,
                sha256,
                status_execucao,
                source_kind,
                legacy_url,
                manual_review,
                payload,
                created_at,
                updated_at,
                updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW(), NOW(), $14)
            ON CONFLICT (id)
            DO UPDATE SET
                purpose = EXCLUDED.purpose,
                linked_resource_type = EXCLUDED.linked_resource_type,
                linked_resource_id = EXCLUDED.linked_resource_id,
                storage_key = EXCLUDED.storage_key,
                content_type = EXCLUDED.content_type,
                size_bytes = EXCLUDED.size_bytes,
                sha256 = EXCLUDED.sha256,
                status_execucao = EXCLUDED.status_execucao,
                source_kind = EXCLUDED.source_kind,
                legacy_url = EXCLUDED.legacy_url,
                manual_review = EXCLUDED.manual_review,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            normalizeText(nextPayload.purpose),
            normalizeText(nextPayload.linkedResourceType),
            normalizeText(nextPayload.linkedResourceId),
            normalizeText(nextPayload.storageKey),
            normalizeText(nextPayload.contentType),
            toSafeInteger(nextPayload.sizeBytes),
            normalizeText(nextPayload.sha256 || nextPayload.contentSha256),
            normalizeText(nextPayload.statusExecucao),
            normalizeText(nextPayload.sourceKind),
            normalizeText(nextPayload.legacyUrl),
            Boolean(nextPayload.manualReview),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return deleteFirestoreDoc('mediaAssets', normalizedId);
    }

    await postgresStore.query('DELETE FROM media_assets WHERE id = $1', [normalizedId]);
}

module.exports = {
    list,
    getById,
    listByLinkedResource,
    listByPurpose,
    save,
    remove,
    markReady,
    markFailed,
};
