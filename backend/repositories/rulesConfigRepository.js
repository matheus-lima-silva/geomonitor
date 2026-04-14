const {
    postgresStore,
    buildMetadata,
} = require('./common');

const SINGLETON_ID = 'default';

async function get() {
    const result = await postgresStore.query(
        `
            SELECT id, payload, created_at, updated_at, updated_by
            FROM rules_config
            WHERE id = $1
            LIMIT 1
        `,
        [SINGLETON_ID],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return buildMetadata(row.payload || {}, row);
}

async function save(payload, options = {}) {
    const current = options.merge ? await get() : null;
    const nextPayload = {
        ...(current && typeof current === 'object' ? current : {}),
        ...(payload && typeof payload === 'object' ? payload : {}),
    };

    await postgresStore.query(
        `
            INSERT INTO rules_config (id, payload, created_at, updated_at, updated_by)
            VALUES ($1, $2::jsonb, NOW(), NOW(), $3)
            ON CONFLICT (id)
            DO UPDATE SET
                payload = $2::jsonb,
                updated_at = NOW(),
                updated_by = $3
        `,
        [
            SINGLETON_ID,
            JSON.stringify(nextPayload),
            nextPayload.updatedBy || null,
        ],
    );

    return get();
}

module.exports = {
    get,
    save,
};
