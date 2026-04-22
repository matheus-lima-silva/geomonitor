const postgresStore = require('../data/postgresStore');

function mapRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        type: row.type,
        payload: row.payload || {},
        createdAt: row.created_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
    };
}

async function insert({ type, payload }) {
    const result = await postgresStore.query(
        `INSERT INTO system_alerts (type, payload)
         VALUES ($1, $2::jsonb)
         RETURNING id, type, payload, created_at, acknowledged_at, acknowledged_by`,
        [String(type || ''), JSON.stringify(payload || {})],
    );
    return mapRow(result.rows[0]);
}

async function listRecent({ page = 1, limit = 20, onlyPending = false } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClause = onlyPending ? 'WHERE acknowledged_at IS NULL' : '';

    const [itemsRes, totalRes] = await Promise.all([
        postgresStore.query(
            `SELECT id, type, payload, created_at, acknowledged_at, acknowledged_by
             FROM system_alerts
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [limitNum, offset],
        ),
        postgresStore.query(
            `SELECT COUNT(*)::int AS n FROM system_alerts ${whereClause}`,
        ),
    ]);

    return {
        items: itemsRes.rows.map(mapRow),
        total: totalRes.rows[0]?.n || 0,
        page: pageNum,
        limit: limitNum,
    };
}

async function acknowledge(id, userEmail) {
    const result = await postgresStore.query(
        `UPDATE system_alerts
         SET acknowledged_at = NOW(),
             acknowledged_by = $2
         WHERE id = $1
           AND acknowledged_at IS NULL
         RETURNING id, type, payload, created_at, acknowledged_at, acknowledged_by`,
        [Number(id), String(userEmail || '')],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
}

async function getById(id) {
    const result = await postgresStore.query(
        `SELECT id, type, payload, created_at, acknowledged_at, acknowledged_by
         FROM system_alerts
         WHERE id = $1
         LIMIT 1`,
        [Number(id)],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
}

module.exports = {
    insert,
    listRecent,
    acknowledge,
    getById,
};
