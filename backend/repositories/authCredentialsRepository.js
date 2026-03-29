const postgresStore = require('../data/postgresStore');

async function getByUserId(userId) {
    const result = await postgresStore.query(
        'SELECT * FROM auth_credentials WHERE user_id = $1',
        [userId],
    );
    return result.rows[0] || null;
}

async function getByEmail(email) {
    const result = await postgresStore.query(
        'SELECT * FROM auth_credentials WHERE LOWER(email) = LOWER($1)',
        [email],
    );
    return result.rows[0] || null;
}

async function create({ userId, email, passwordHash }) {
    const result = await postgresStore.query(
        `INSERT INTO auth_credentials (user_id, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, email, passwordHash],
    );
    return result.rows[0];
}

async function updatePassword(userId, passwordHash) {
    await postgresStore.query(
        `UPDATE auth_credentials
         SET password_hash = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [passwordHash, userId],
    );
}

async function updateEmail(userId, email) {
    await postgresStore.query(
        `UPDATE auth_credentials
         SET email = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [email, userId],
    );
}

async function setResetToken(email, token, expiresAt) {
    await postgresStore.query(
        `UPDATE auth_credentials
         SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW()
         WHERE LOWER(email) = LOWER($3)`,
        [token, expiresAt, email],
    );
}

async function getByResetToken(token) {
    const result = await postgresStore.query(
        `SELECT * FROM auth_credentials
         WHERE reset_token = $1 AND reset_token_expires_at > NOW()`,
        [token],
    );
    return result.rows[0] || null;
}

async function clearResetToken(userId) {
    await postgresStore.query(
        `UPDATE auth_credentials
         SET reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
    );
}

module.exports = {
    getByUserId,
    getByEmail,
    create,
    updatePassword,
    updateEmail,
    setResetToken,
    getByResetToken,
    clearResetToken,
};
