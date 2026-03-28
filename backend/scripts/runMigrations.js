const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { buildPgConnectionOptions } = require('../data/postgresStore');

async function createPool() {
    const { Pool } = require('pg');
    return new Pool(buildPgConnectionOptions());
}

async function ensureMigrationsTable(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function getMigrationFiles(migrationsDir) {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations(pool) {
    const result = await pool.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename ASC');
    return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

function buildChecksum(contents) {
    return crypto.createHash('sha256').update(contents).digest('hex');
}

async function applyMigration(pool, migrationPath, filename, checksum) {
    const sql = await fs.readFile(migrationPath, 'utf8');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
            `
                INSERT INTO schema_migrations (filename, checksum, applied_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (filename)
                DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
            `,
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

async function main() {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const pool = await createPool();

    try {
        await ensureMigrationsTable(pool);
        const files = await getMigrationFiles(migrationsDir);
        const applied = await getAppliedMigrations(pool);
        let appliedCount = 0;

        for (const filename of files) {
            const migrationPath = path.join(migrationsDir, filename);
            const contents = await fs.readFile(migrationPath, 'utf8');
            const checksum = buildChecksum(contents);
            const previousChecksum = applied.get(filename);

            if (previousChecksum && previousChecksum === checksum) {
                console.log(`[migrate] skipping ${filename}`);
                continue;
            }

            console.log(`[migrate] applying ${filename}`);
            await applyMigration(pool, migrationPath, filename, checksum);
            appliedCount += 1;
        }

        console.log(`[migrate] finished with ${appliedCount} migration(s) applied`);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('[migrate] failed:', error);
        process.exitCode = 1;
    });
}

module.exports = {
    buildChecksum,
    getMigrationFiles,
};
