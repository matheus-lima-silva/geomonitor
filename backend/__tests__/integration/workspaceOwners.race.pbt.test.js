/**
 * PBT: invariante "workspace nunca fica sem owner".
 *
 * Hoje este teste DEVE FALHAR com contra-exemplo (ownerCount=2, ambos
 * deletados em paralelo). Ele e documentacao executavel da race em
 * backend/routes/reportWorkspaces.js:1122-1144 — countOwners() e
 * removeMember() executam fora de transacao, entao dois DELETEs concorrentes
 * ambos podem passar no check "ownerCount > 1" antes de qualquer um deletar
 * sua row, zerando owners.
 *
 * Apos o fix (countOwners + removeMember embrulhados em transacao com
 * SELECT ... FOR UPDATE), este teste deve passar de forma estavel.
 *
 * Rodar:
 *   PBT_POSTGRES_URL=postgres://postgres:test@localhost:5432/geomonitor_test \
 *   POSTGRES_SSL=disable \
 *   npm run test:pbt
 */
const fc = require('fast-check');
const request = require('supertest');

const { createTestAuthHeader } = require('../helpers/testAuth');
const { getPbtPool, truncateAllPbtTables, closePbtPool } = require('../helpers/pbtDb');
const { seedWorkspaceWithOwners } = require('../helpers/workspaceFactory');
const { runConcurrent } = require('../helpers/concurrencyRunner');
const { ownerCountArb, deleteMaskArb } = require('../helpers/pbtArbitraries');
const fcDefaults = require('../helpers/fcDefaults');

const describeIfPg = process.env.PBT_POSTGRES_URL || process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeIfPg('PBT: workspace nunca fica sem owner', () => {
    let app;
    let workspaceMemberRepository;
    let authMiddleware;

    beforeAll(async () => {
        app = require('../../server');
        workspaceMemberRepository = require('../../repositories/workspaceMemberRepository');
        authMiddleware = require('../../utils/authMiddleware');
        await truncateAllPbtTables();
    });

    afterAll(async () => {
        await truncateAllPbtTables();
        await closePbtPool();
    });

    test('countOwners >= 1 apos DELETEs concorrentes', async () => {
        const pool = getPbtPool();

        await fc.assert(
            fc.asyncProperty(
                ownerCountArb.chain((n) => fc.tuple(fc.constant(n), deleteMaskArb(n))),
                async ([ownerCount, deleteFlags]) => {
                    const { workspaceId, ownerUserIds } = await seedWorkspaceWithOwners(pool, { ownerCount });
                    const actor = ownerUserIds[0];
                    // Cache de perfil e global (5 min). UserIds unicos por run
                    // ja evitam colisao, mas invalidar defensivamente nao custa.
                    authMiddleware.invalidateCachedProfile(actor);

                    // Actor pode estar em targets — a race exige DELETEs paralelos
                    // que juntos zerem os owners. Se actor for deletado por R1
                    // enquanto R2 ainda roda, R2 ja passou verifyToken antes
                    // (token foi emitido no seed, e JWT nao checa DB).
                    const targets = ownerUserIds.filter((_, i) => deleteFlags[i]);
                    if (targets.length < 2) return true; // race exige >=2 DELETEs concorrentes

                    const authHeader = createTestAuthHeader({
                        userId: actor,
                        email: `owner-0-${actor}@pbt.test`,
                    });

                    const deletes = targets.map((uid) => () => request(app)
                        .delete(`/api/report-workspaces/${workspaceId}/members/${uid}`)
                        .set(authHeader));

                    await runConcurrent(deletes);

                    const remaining = await workspaceMemberRepository.countOwners(workspaceId);
                    return remaining >= 1;
                },
            ),
            fcDefaults,
        );
    });
});
