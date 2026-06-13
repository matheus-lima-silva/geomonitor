const { buildPgConnectionOptions } = require('../postgresStore');

describe('postgresStore helpers', () => {
    const originalEnv = {
        DATABASE_URL: process.env.DATABASE_URL,
        POSTGRES_URL: process.env.POSTGRES_URL,
        POSTGRES_SSL: process.env.POSTGRES_SSL,
        PGSSLMODE: process.env.PGSSLMODE,
        POSTGRES_STATEMENT_TIMEOUT_MS: process.env.POSTGRES_STATEMENT_TIMEOUT_MS,
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

    describe('statement_timeout', () => {
        beforeEach(() => {
            process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/geomonitor';
            delete process.env.POSTGRES_STATEMENT_TIMEOUT_MS;
        });

        it('aplica o default de 15000ms', () => {
            expect(buildPgConnectionOptions().statement_timeout).toBe(15000);
        });

        it('respeita POSTGRES_STATEMENT_TIMEOUT_MS', () => {
            process.env.POSTGRES_STATEMENT_TIMEOUT_MS = '30000';
            expect(buildPgConnectionOptions().statement_timeout).toBe(30000);
        });

        it('permite desabilitar com 0', () => {
            process.env.POSTGRES_STATEMENT_TIMEOUT_MS = '0';
            expect(buildPgConnectionOptions().statement_timeout).toBe(0);
        });

        it('cai no default quando o valor nao e numerico', () => {
            process.env.POSTGRES_STATEMENT_TIMEOUT_MS = 'abc';
            expect(buildPgConnectionOptions().statement_timeout).toBe(15000);
        });
    });
});
