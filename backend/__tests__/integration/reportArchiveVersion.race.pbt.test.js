/**
 * PBT: invariante "versoes de archive de um compound sao sequenciais e unicas".
 *
 * Antes do fix (getMaxVersionForCompound + create em statements separados), N
 * deliveries concorrentes do mesmo compound liam o mesmo MAX(version) e tentavam
 * inserir a mesma versao. Como existe UNIQUE (compound_id, version) (migration
 * 0010), as colisoes viram violacao 23505 e a delivery perdedora REJEITA — em vez
 * de receber a proxima versao. Este teste reproduz a race e deve FALHAR nesse
 * estado.
 *
 * Apos o fix (reportArchiveRepository.createNextVersion com pg_advisory_xact_lock
 * por compound + MAX+1 dentro do lock), as N deliveries serializam e recebem
 * versoes exatamente {1..N}: nenhuma rejeita e nao ha duplicata.
 *
 * Rodar:
 *   PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test \
 *   POSTGRES_SSL=disable \
 *   npm run test:pbt
 */
const fc = require('fast-check');
const crypto = require('crypto');

const { getPbtPool, truncateAllPbtTables, closePbtPool } = require('../helpers/pbtDb');
const { seedCompound } = require('../helpers/workspaceFactory');
const { runConcurrent } = require('../helpers/concurrencyRunner');
const { concurrentCountArb } = require('../helpers/pbtArbitraries');
const fcDefaults = require('../helpers/fcDefaults');

const describeIfPg = process.env.PBT_POSTGRES_URL || process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeIfPg('PBT: versoes de archive sequenciais e unicas', () => {
    let reportArchiveRepository;

    beforeAll(async () => {
        reportArchiveRepository = require('../../repositories/reportArchiveRepository');
        await truncateAllPbtTables();
    });

    afterAll(async () => {
        await truncateAllPbtTables();
        await closePbtPool();
    });

    test('N deliveries concorrentes => versoes {1..N}, sem rejeicao', async () => {
        const pool = getPbtPool();

        await fc.assert(
            fc.asyncProperty(concurrentCountArb, async (n) => {
                const compoundId = await seedCompound(pool);

                const deliveries = Array.from({ length: n }, () => () => reportArchiveRepository.createNextVersion({
                    id: `RA-${crypto.randomUUID()}`,
                    compoundId,
                    deliveredBy: 'pbt',
                    generatedMediaId: `MED-${crypto.randomUUID()}`,
                    snapshotPayload: {},
                }));

                const { settled } = await runConcurrent(deliveries);

                // Invariante 1: nenhuma delivery falha (sem 23505 perdedor).
                const rejected = settled.filter((s) => s.status === 'rejected');
                if (rejected.length > 0) return false;

                // Invariante 2: as versoes resultantes sao exatamente {1..N}.
                const versions = settled
                    .map((s) => Number(s.value?.version))
                    .sort((a, b) => a - b);
                const expected = Array.from({ length: n }, (_, i) => i + 1);
                return versions.length === expected.length
                    && versions.every((v, i) => v === expected[i]);
            }),
            fcDefaults,
        );
    });
});
