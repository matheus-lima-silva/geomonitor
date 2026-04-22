const postgresStore = require('../data/postgresStore');

const UNIQUE_VIOLATION = '23505';
const DUPLICATE_NAME_MESSAGE = 'Ja existe snippet com esse nome.';

function mapRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        name: row.name,
        sqlText: row.sql_text,
        description: row.description,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildDuplicateError() {
    const err = new Error(DUPLICATE_NAME_MESSAGE);
    err.status = 409;
    err.code = 'SNIPPET_NAME_CONFLICT';
    return err;
}

async function list() {
    const result = await postgresStore.query(
        `SELECT id, name, sql_text, description, created_by, updated_by, created_at, updated_at
         FROM admin_sql_snippets
         ORDER BY LOWER(name) ASC`,
    );
    return result.rows.map(mapRow);
}

async function getById(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    const result = await postgresStore.query(
        `SELECT id, name, sql_text, description, created_by, updated_by, created_at, updated_at
         FROM admin_sql_snippets WHERE id = $1 LIMIT 1`,
        [numericId],
    );
    return mapRow(result.rows[0]);
}

async function create({ name, sqlText, description, createdBy }) {
    try {
        const result = await postgresStore.query(
            `INSERT INTO admin_sql_snippets (name, sql_text, description, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $4)
             RETURNING id, name, sql_text, description, created_by, updated_by, created_at, updated_at`,
            [
                String(name || '').trim(),
                String(sqlText || ''),
                description == null ? null : String(description),
                String(createdBy || ''),
            ],
        );
        return mapRow(result.rows[0]);
    } catch (error) {
        if (error && error.code === UNIQUE_VIOLATION) throw buildDuplicateError();
        throw error;
    }
}

async function update(id, { name, sqlText, description, updatedBy }) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;

    // Build partial update: so atualiza colunas explicitamente fornecidas.
    const sets = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(String(name).trim()); }
    if (sqlText !== undefined) { sets.push(`sql_text = $${idx++}`); values.push(String(sqlText)); }
    if (description !== undefined) {
        sets.push(`description = $${idx++}`);
        values.push(description == null ? null : String(description));
    }
    sets.push(`updated_by = $${idx++}`); values.push(String(updatedBy || ''));
    sets.push(`updated_at = NOW()`);

    values.push(numericId);
    const sql = `UPDATE admin_sql_snippets SET ${sets.join(', ')}
                 WHERE id = $${idx}
                 RETURNING id, name, sql_text, description, created_by, updated_by, created_at, updated_at`;

    try {
        const result = await postgresStore.query(sql, values);
        return mapRow(result.rows[0]);
    } catch (error) {
        if (error && error.code === UNIQUE_VIOLATION) throw buildDuplicateError();
        throw error;
    }
}

async function remove(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return false;
    const result = await postgresStore.query(
        `DELETE FROM admin_sql_snippets WHERE id = $1`,
        [numericId],
    );
    return result.rowCount > 0;
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove,
    DUPLICATE_NAME_MESSAGE,
};
