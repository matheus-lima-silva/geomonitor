const { buildPgConnectionOptions } = require('../postgresStore');

describe('postgresStore helpers', () => {
    const originalEnv = {
        DATABASE_URL: process.env.DATABASE_URL,
        POSTGRES_URL: process.env.POSTGRES_URL,
        POSTGRES_SSL: process.env.POSTGRES_SSL,
        PGSSLMODE: process.env.PGSSLMODE,
    };

    afterEach(() => {
        Object.entries(originalEnv).forEach(([key, value]) => {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        });
    });

    it('falha sem DATABASE_URL ou POSTGRES_URL', () => {
        delete process.env.DATABASE_URL;
        delete process.env.POSTGRES_URL;

        expect(() => buildPgConnectionOptions()).toThrow('DATABASE_URL nao configurada');
    });

    it('desliga SSL quando a configuracao pedir disable', () => {
        process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/geomonitor';
        process.env.POSTGRES_SSL = 'false';

        expect(buildPgConnectionOptions()).toEqual(expect.objectContaining({
            connectionString: 'postgres://postgres:postgres@localhost:5432/geomonitor',
            ssl: false,
        }));
    });
});
