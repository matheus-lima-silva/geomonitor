const {
    postgresStore,
    isPostgresBackend,
    normalizeText,
    normalizeKey,
    getFirestoreDoc,
    listFirestoreDocs,
    saveFirestoreDoc,
    deleteFirestoreDoc,
    buildMetadata,
} = require('./common');

function assertSafeIdentifier(identifier, kind) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(String(identifier || ''))) {
        throw new Error(`${kind} invalido para repositorio: ${identifier}`);
    }
    return identifier;
}

function createDocumentTableRepository(config = {}) {
    const firestoreCollection = assertSafeIdentifier(config.firestoreCollection, 'collection');
    const tableName = assertSafeIdentifier(config.tableName, 'table');
    const projectIdFields = Array.isArray(config.projectIdFields) && config.projectIdFields.length > 0
        ? config.projectIdFields
        : ['projectId', 'projetoId'];

    function hydrateRow(row) {
        return buildMetadata(row.payload, row);
    }

    async function list() {
        if (!isPostgresBackend()) {
            return listFirestoreDocs(firestoreCollection);
        }

        const result = await postgresStore.query(
            `
                SELECT id, payload, created_at, updated_at, updated_by
                FROM ${tableName}
                ORDER BY updated_at DESC, id ASC
            `,
        );

        return result.rows.map((row) => hydrateRow(row));
    }

    async function getById(id) {
        const normalizedId = normalizeText(id);
        if (!isPostgresBackend()) {
            return getFirestoreDoc(firestoreCollection, normalizedId);
        }

        const result = await postgresStore.query(
            `
                SELECT id, payload, created_at, updated_at, updated_by
                FROM ${tableName}
                WHERE id = $1
                LIMIT 1
            `,
            [normalizedId],
        );

        if (result.rows.length === 0) return null;
        return hydrateRow(result.rows[0]);
    }

    async function listByProject(projectId) {
        const normalizedProjectId = normalizeKey(projectId);

        if (!isPostgresBackend()) {
            const rows = await list();
            return rows.filter((row) => (
                projectIdFields.some((fieldName) => normalizeKey(row?.[fieldName]) === normalizedProjectId)
            ));
        }

        const coalesceFields = projectIdFields
            .map((fieldName) => `payload->>'${fieldName}'`)
            .join(', ');

        const result = await postgresStore.query(
            `
                SELECT id, payload, created_at, updated_at, updated_by
                FROM ${tableName}
                WHERE UPPER(COALESCE(${coalesceFields}, '')) = $1
                ORDER BY updated_at DESC, id ASC
            `,
            [normalizedProjectId],
        );

        return result.rows.map((row) => hydrateRow(row));
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
            return saveFirestoreDoc(firestoreCollection, normalizedId, nextPayload, options);
        }

        await postgresStore.query(
            `
                INSERT INTO ${tableName} (
                    id, payload, created_at, updated_at, updated_by
                )
                VALUES ($1, $2::jsonb, NOW(), NOW(), $3)
                ON CONFLICT (id)
                DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_at = NOW(),
                    updated_by = EXCLUDED.updated_by
            `,
            [
                normalizedId,
                JSON.stringify(nextPayload),
                nextPayload.updatedBy || null,
            ],
        );

        return getById(normalizedId);
    }

    async function remove(id) {
        const normalizedId = normalizeText(id);
        if (!isPostgresBackend()) {
            return deleteFirestoreDoc(firestoreCollection, normalizedId);
        }

        await postgresStore.query(`DELETE FROM ${tableName} WHERE id = $1`, [normalizedId]);
    }

    async function countByProject(projectId) {
        const normalizedProjectId = normalizeKey(projectId);

        if (!isPostgresBackend()) {
            const rows = await list();
            return rows.filter((row) => (
                projectIdFields.some((fieldName) => normalizeKey(row?.[fieldName]) === normalizedProjectId)
            )).length;
        }

        const coalesceFields = projectIdFields
            .map((fieldName) => `payload->>'${fieldName}'`)
            .join(', ');

        const result = await postgresStore.query(
            `
                SELECT COUNT(*)::int AS count
                FROM ${tableName}
                WHERE UPPER(COALESCE(${coalesceFields}, '')) = $1
            `,
            [normalizedProjectId],
        );

        return result.rows[0]?.count || 0;
    }

    return {
        list,
        getById,
        listByProject,
        save,
        remove,
        countByProject,
    };
}

module.exports = createDocumentTableRepository;
