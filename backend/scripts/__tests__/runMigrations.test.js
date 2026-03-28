const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { buildChecksum, getMigrationFiles } = require('../runMigrations');

describe('runMigrations helpers', () => {
    it('gera checksum deterministico', () => {
        const first = buildChecksum('SELECT 1;');
        const second = buildChecksum('SELECT 1;');
        const third = buildChecksum('SELECT 2;');

        expect(first).toBe(second);
        expect(first).not.toBe(third);
    });

    it('lista apenas arquivos SQL ordenados', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'geomonitor-migrations-'));
        try {
            await fs.writeFile(path.join(tempDir, '0002_b.sql'), 'SELECT 2;');
            await fs.writeFile(path.join(tempDir, '0001_a.sql'), 'SELECT 1;');
            await fs.writeFile(path.join(tempDir, 'README.md'), 'ignore');

            const files = await getMigrationFiles(tempDir);

            expect(files).toEqual(['0001_a.sql', '0002_b.sql']);
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});
