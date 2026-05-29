// Config opt-in para testes property-based que conversam com Postgres real.
// Roda apenas quando PBT_POSTGRES_URL (ou DATABASE_URL) esta setada.
// Disparar com: npm run test:pbt
const base = require('./jest.config');

module.exports = {
    ...base,
    testMatch: ['**/__tests__/**/*.pbt.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/helpers/',
        '/__tests__/fixtures/',
    ],
    setupFilesAfterEnv: ['./jest.pbt.setup.js'],
    globalSetup: './jest.pbt.globalSetup.js',
    globalTeardown: './jest.pbt.globalTeardown.js',
    testTimeout: 30000,
    // maxWorkers: 1 evita que dois workers rodem a mesma suite em paralelo
    // contra as mesmas tabelas — a concorrencia que queremos exercer acontece
    // dentro do teste via Promise.allSettled, nao entre workers do Jest.
    maxWorkers: 1,
};
