const postgresStore = require('../data/postgresStore');

async function listByUser(userId) {
    const result = await postgresStore.query(
        `SELECT s.*, p.nome AS profissao_nome
         FROM user_signatories s
         LEFT JOIN profissoes p ON p.id = s.profissao_id
         WHERE s.user_id = $1
         ORDER BY s.created_at`,
        [userId],
    );
    return result.rows;
}

async function getById(id) {
    const result = await postgresStore.query(
        'SELECT * FROM user_signatories WHERE id = $1',
        [id],
    );
    return result.rows[0] || null;
}

async function create({ userId, nome, profissaoId, registroConselho, registroEstado, registroNumero, registroSufixo }) {
    const result = await postgresStore.query(
        `INSERT INTO user_signatories (user_id, nome, profissao_id, registro_conselho, registro_estado, registro_numero, registro_sufixo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, nome, profissaoId || null, registroConselho || '', registroEstado || '', registroNumero || '', registroSufixo || ''],
    );
    return result.rows[0];
}

async function update(id, { nome, profissaoId, registroConselho, registroEstado, registroNumero, registroSufixo }) {
    const result = await postgresStore.query(
        `UPDATE user_signatories
         SET nome = $1, profissao_id = $2, registro_conselho = $3, registro_estado = $4,
             registro_numero = $5, registro_sufixo = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [nome, profissaoId || null, registroConselho || '', registroEstado || '', registroNumero || '', registroSufixo || '', id],
    );
    return result.rows[0] || null;
}

async function remove(id) {
    await postgresStore.query('DELETE FROM user_signatories WHERE id = $1', [id]);
}

module.exports = { listByUser, getById, create, update, remove };
