// Aplica migracoes uma vez antes dos testes PBT. Pool local, encerrada no
// final — nao interfere com o pool do postgresStore que o app usa nos testes.
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

module.exports = async function globalSetup() {
    const url = process.env.PBT_POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) {
        throw new Error(
            '[pbt] PBT_POSTGRES_URL (ou DATABASE_URL) nao setada.\n'
            + 'Exemplo:\n'
            + '  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=geomonitor_test postgres:16-alpine\n'
            + '  export PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test\n'
            + '  export POSTGRES_SSL=disable\n'
            + '  npm run test:pbt',
        );
    }

    if (!process.env.DATABASE_URL) {
        process.env.DATABASE_URL = url;
    }
    if (!process.env.POSTGRES_SSL && !process.env.PGSSLMODE) {
        process.env.POSTGRES_SSL = 'disable';
    }

    const { Pool } = require('pg');
    const { buildPgConnectionOptions } = require('./data/postgresStore');
    const pool = new Pool(buildPgConnectionOptions());

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        const migrationsDir = path.join(__dirname, 'migrations');
        const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b));

        const applied = await pool.query('SELECT filename, checksum FROM schema_migrations');
        const appliedMap = new Map(applied.rows.map((row) => [row.filename, row.checksum]));

        for (const filename of files) {
            const migrationPath = path.join(migrationsDir, filename);
            const contents = await fs.readFile(migrationPath, 'utf8');
            const checksum = crypto.createHash('sha256').update(contents).digest('hex');
            if (appliedMap.get(filename) === checksum) continue;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(contents);
                await client.query(
                    `INSERT INTO schema_migrations (filename, checksum, applied_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (filename)
                     DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
                    [filename, checksum],
                );
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }
    } finally {
        await pool.end();
    }
};
