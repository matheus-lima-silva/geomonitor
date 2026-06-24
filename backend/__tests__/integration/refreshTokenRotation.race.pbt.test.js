/**
 * PBT: invariante "reuse concorrente do mesmo refresh token nunca desloga
 * espuriamente e converge num unico sucessor".
 *
 * O refresh token vive num cookie httpOnly compartilhado entre abas (SSO): duas
 * abas podem dar /refresh quase simultaneo com o MESMO token. A rotacao single-use
 * (refreshTokenRepository.rotate) usa SELECT ... FOR UPDATE + janela de graca: o
 * 1o consome o token e cria o sucessor; os demais, dentro da graca, re-leem a
 * linha ja revogada e devolvem o MESMO sucessor — sem revogar a familia.
 *
 * Sem a janela de graca, o reuse concorrente legitimo deslogaria o usuario (a 2a
 * rotacao viraria "reuse" e revogaria a familia). Este teste falha se a graca/
 * convergencia regredir.
 *
 * Rodar:
 *   PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test \
 *   POSTGRES_SSL=disable \
 *   npm run test:pbt
 */
const fc = require('fast-check');

const { getPbtPool, truncateAllPbtTables, closePbtPool } = require('../helpers/pbtDb');
const { seedCredential } = require('../helpers/workspaceFactory');
const { runConcurrent } = require('../helpers/concurrencyRunner');
const { concurrentCountArb } = require('../helpers/pbtArbitraries');
const fcDefaults = require('../helpers/fcDefaults');

const describeIfPg = process.env.PBT_POSTGRES_URL || process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeIfPg('PBT: reuse concorrente de refresh token converge sem deslogar', () => {
    let refreshTokenRepository;

    beforeAll(async () => {
        refreshTokenRepository = require('../../repositories/refreshTokenRepository');
        await truncateAllPbtTables();
    });

    afterAll(async () => {
        await truncateAllPbtTables();
        await closePbtPool();
    });

    test('N rotacoes concorrentes do mesmo token => 1 sucessor, sem reuse, familia viva', async () => {
        const pool = getPbtPool();

        await fc.assert(
            fc.asyncProperty(concurrentCountArb, async (n) => {
                const userId = await seedCredential(pool);
                const { jti, familyId } = await refreshTokenRepository.issueFamily(userId);

                const rotations = Array.from({ length: n }, () => () => refreshTokenRepository.rotate(jti));
                const { settled } = await runConcurrent(rotations);

                const results = settled
                    .filter((s) => s.status === 'fulfilled')
                    .map((s) => s.value);

                // Invariante 1: nenhuma rotacao detecta reuse dentro da graca.
                if (results.some((r) => r && r.reuse)) return false;

                // Invariante 2: todas convergem para o MESMO sucessor jti.
                const successorJtis = new Set(results.map((r) => r && r.jti).filter(Boolean));
                if (successorJtis.size !== 1) return false;

                // Invariante 3: a familia segue com >= 1 token vivo (nao deslogou).
                const live = await pool.query(
                    `SELECT COUNT(*)::int AS c
                     FROM refresh_tokens
                     WHERE family_id = $1 AND revoked_at IS NULL`,
                    [familyId],
                );
                return live.rows[0].c >= 1;
            }),
            fcDefaults,
        );
    });
});
