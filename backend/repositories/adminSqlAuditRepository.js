const postgresStore = require('../data/postgresStore');

async function insert({ executedBy, sqlText, rowCount, durationMs, status, errorMessage }) {
    const result = await postgresStore.query(
        `INSERT INTO admin_sql_audit (executed_by, sql_text, row_count, duration_ms, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, executed_by, sql_text, row_count, duration_ms, status, error_message, executed_at`,
        [
            String(executedBy || ''),
            String(sqlText || ''),
            rowCount == null ? null : Number(rowCount),
            durationMs == null ? null : Number(durationMs),
            String(status || ''),
            errorMessage == null ? null : String(errorMessage),
        ],
    );
    return mapRow(result.rows[0]);
}

async function list({ page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [itemsRes, totalRes] = await Promise.all([
        postgresStore.query(
            `SELECT id, executed_by, sql_text, row_count, duration_ms, status, error_message, executed_at
             FROM admin_sql_audit
             ORDER BY executed_at DESC
             LIMIT $1 OFFSET $2`,
            [limitNum, offset],
        ),
        postgresStore.query(`SELECT COUNT(*)::int AS n FROM admin_sql_audit`),
    ]);

    return {
        items: itemsRes.rows.map(mapRow),
        total: totalRes.rows[0]?.n || 0,
        page: pageNum,
        limit: limitNum,
    };
}

function mapRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        executedBy: row.executed_by,
        sqlText: row.sql_text,
        rowCount: row.row_count,
        durationMs: row.duration_ms,
        status: row.status,
        errorMessage: row.error_message,
        executedAt: row.executed_at,
    };
}

module.exports = {
    insert,
    list,
};
