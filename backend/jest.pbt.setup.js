// setupFilesAfterEnv para os testes PBT. Roda em cada processo de teste,
// antes que server.js / repositories / postgresStore carreguem constantes
// dependentes de env.
require('./jest.setup');

const pbtUrl = process.env.PBT_POSTGRES_URL;
if (pbtUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = pbtUrl;
}

if (!process.env.POSTGRES_SSL && !process.env.PGSSLMODE) {
    process.env.POSTGRES_SSL = 'disable';
}

// Cada property run faz ~5 queries; 25 runs facilmente passam de 15 (threshold
// default). Sem isso, middleware/queryCounter emite warn e insere em
// system_alerts a cada request — ruido desnecessario no teste.
if (!process.env.QUERY_COUNT_ALERT_THRESHOLD) {
    process.env.QUERY_COUNT_ALERT_THRESHOLD = '9999';
}
