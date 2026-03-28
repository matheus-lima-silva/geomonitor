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

function hydrateRow(row) {
    return buildMetadata(
        {
            ...(row.payload || {}),
            versionLabel: row.version_label,
            sourceKind: row.source_kind,
            storageKey: row.storage_key,
            sha256: row.sha256,
            isActive: Boolean(row.is_active),
            notes: row.notes,
        },
        row,
    );
}

async function list() {
    if (!isPostgresBackend()) {
        return listFirestoreDocs('reportTemplates');
    }

    const result = await postgresStore.query(
        `
            SELECT id, version_label, source_kind, storage_key, sha256,
                   is_active, notes, payload, created_at, updated_at, updated_by
            FROM report_templates
            ORDER BY updated_at DESC, id ASC
        `,
    );

    return result.rows.map((row) => hydrateRow(row));
}

async function getById(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return getFirestoreDoc('reportTemplates', normalizedId);
    }

    const result = await postgresStore.query(
        `
            SELECT id, version_label, source_kind, storage_key, sha256,
                   is_active, notes, payload, created_at, updated_at, updated_by
            FROM report_templates
            WHERE id = $1
            LIMIT 1
        `,
        [normalizedId],
    );

    return result.rows.length > 0 ? hydrateRow(result.rows[0]) : null;
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
        return saveFirestoreDoc('reportTemplates', normalizedId, nextPayload, options);
    }

    await postgresStore.query(
        `
            INSERT INTO report_templates (
                id, version_label, source_kind, storage_key, sha256,
                is_active, notes, payload, created_at, updated_at, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW(), $9)
            ON CONFLICT (id)
            DO UPDATE SET
                version_label = EXCLUDED.version_label,
                source_kind = EXCLUDED.source_kind,
                storage_key = EXCLUDED.storage_key,
                sha256 = EXCLUDED.sha256,
                is_active = EXCLUDED.is_active,
                notes = EXCLUDED.notes,
                payload = EXCLUDED.payload,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        `,
        [
            normalizedId,
            normalizeText(nextPayload.versionLabel),
            normalizeText(nextPayload.sourceKind),
            normalizeText(nextPayload.storageKey),
            normalizeText(nextPayload.sha256),
            Boolean(nextPayload.isActive),
            normalizeText(nextPayload.notes),
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return getById(normalizedId);
}

async function remove(id) {
    const normalizedId = normalizeText(id);
    if (!isPostgresBackend()) {
        return deleteFirestoreDoc('reportTemplates', normalizedId);
    }

    await postgresStore.query('DELETE FROM report_templates WHERE id = $1', [normalizedId]);
}

async function activate(id) {
    const normalizedId = normalizeText(id);
    const template = await getById(normalizedId);
    if (!template) return null;

    if (!isPostgresBackend()) {
        const all = await listFirestoreDocs('reportTemplates');
        const sameKind = all.filter(
            (item) => normalizeText(item.sourceKind) === normalizeText(template.sourceKind) && item.id !== normalizedId,
        );
        for (const item of sameKind) {
            await saveFirestoreDoc('reportTemplates', item.id, { ...item, isActive: false }, { merge: true });
        }
        return saveFirestoreDoc('reportTemplates', normalizedId, { ...template, isActive: true }, { merge: true });
    }

    await postgresStore.query(
        `UPDATE report_templates SET is_active = FALSE, updated_at = NOW() WHERE source_kind = $1 AND id != $2`,
        [normalizeText(template.sourceKind), normalizedId],
    );
    await postgresStore.query(
        `UPDATE report_templates SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
        [normalizedId],
    );

    return getById(normalizedId);
}

module.exports = {
    list,
    getById,
    save,
    remove,
    activate,
};
