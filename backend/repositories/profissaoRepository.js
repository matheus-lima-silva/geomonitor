const postgresStore = require('../data/postgresStore');

async function list() {
    const result = await postgresStore.query(
        'SELECT * FROM profissoes ORDER BY nome',
    );
    return result.rows;
}

async function create({ id, nome }) {
    const result = await postgresStore.query(
        `INSERT INTO profissoes (id, nome)
         VALUES ($1, $2)
         RETURNING *`,
        [id, nome],
    );
    return result.rows[0];
}

async function remove(id) {
    await postgresStore.query('DELETE FROM profissoes WHERE id = $1', [id]);
}

module.exports = { list, create, remove };
