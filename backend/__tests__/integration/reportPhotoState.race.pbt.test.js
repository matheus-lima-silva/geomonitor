/**
 * PBT: invariante "uma foto nunca esta simultaneamente na lixeira E arquivada".
 *
 * O modelo de estado usa dois nulaveis: ativo (ambos NULL), lixeira (deleted_at
 * set), arquivado (archived_at set). Antes do fix, softDelete/restore eram
 * INCONDICIONAIS: um softDelete concorrente sobre uma foto ARQUIVADA gravava
 * deleted_at deixando archived_at tambem set — estado incoerente
 * (deleted_at AND archived_at) que nenhuma transicao valida produz. Este teste
 * reproduz a race partindo de estados/transicoes aleatorios e deve FALHAR nesse
 * estado.
 *
 * Apos o fix (softDelete guardado por archived_at IS NULL e restore por
 * deleted_at IS NOT NULL — cada UPDATE single-statement e atomico por linha), as
 * transicoes concorrentes nunca atingem o estado incoerente.
 *
 * Rodar:
 *   PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test \
 *   POSTGRES_SSL=disable \
 *   npm run test:pbt
 */
const fc = require('fast-check');

const { getPbtPool, truncateAllPbtTables, closePbtPool } = require('../helpers/pbtDb');
const { seedPhoto } = require('../helpers/workspaceFactory');
const { runConcurrent } = require('../helpers/concurrencyRunner');
const { photoStateArb, photoTransitionsArb } = require('../helpers/pbtArbitraries');
const fcDefaults = require('../helpers/fcDefaults');

const describeIfPg = process.env.PBT_POSTGRES_URL || process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeIfPg('PBT: foto nunca fica lixeira E arquivada ao mesmo tempo', () => {
    let reportPhotoRepository;

    beforeAll(async () => {
        reportPhotoRepository = require('../../repositories/reportPhotoRepository');
        await truncateAllPbtTables();
    });

    afterAll(async () => {
        await truncateAllPbtTables();
        await closePbtPool();
    });

    test('transicoes concorrentes nunca produzem deleted_at AND archived_at', async () => {
        const pool = getPbtPool();

        await fc.assert(
            fc.asyncProperty(
                photoStateArb,
                photoTransitionsArb(2, 4),
                async (initialState, transitions) => {
                    const { photoId } = await seedPhoto(pool, { state: initialState });

                    const opByName = {
                        trash: () => reportPhotoRepository.softDelete(photoId),
                        restore: () => reportPhotoRepository.restore(photoId),
                        archive: () => reportPhotoRepository.archive(photoId),
                        unarchive: () => reportPhotoRepository.unarchiveToTrash(photoId),
                    };

                    const fns = transitions.map((name) => () => opByName[name]());
                    await runConcurrent(fns);

                    const res = await pool.query(
                        'SELECT deleted_at, archived_at FROM report_photos WHERE id = $1',
                        [photoId],
                    );
                    const row = res.rows[0];
                    // Invariante: nunca os dois nulaveis simultaneamente set.
                    return !(row.deleted_at !== null && row.archived_at !== null);
                },
            ),
            fcDefaults,
        );
    });
});
