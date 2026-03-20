const { getDb } = require('../utils/firebaseSetup');
const {
    CRITICALITY_DEFAULTS,
    calculateCriticality,
    mergeCriticalityConfig,
} = require('../utils/criticality_dist');
const {
    buildCriticalityInputFromErosion,
    isHistoricalErosionRecord,
} = require('../utils/erosionUtils_dist');

const BATCH_LIMIT = 200;

function normalizeCriticalityPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const source = payload.criticalidade
        || payload.criticalidadeV2
        || payload.criticidadeV2
        || payload.criticalityV2
        || payload.criticality
        || payload;

    if (!source || typeof source !== 'object') return null;

    const nestedCandidates = [
        source.breakdown,
        source.campos_calculados,
        source.calculation,
        source.resultado,
    ];

    for (let i = 0; i < nestedCandidates.length; i += 1) {
        const candidate = nestedCandidates[i];
        if (candidate && typeof candidate === 'object') return candidate;
    }

    return source;
}

function hasOwnCriticality(documentData) {
    return Boolean(
        documentData
        && typeof documentData === 'object'
        && documentData.criticalidade
        && typeof documentData.criticalidade === 'object',
    );
}

async function commitBatch(batch, operations, dryRun) {
    if (operations.count === 0) return;
    if (!dryRun) {
        await batch.commit();
    }
    operations.count = 0;
}

async function backfillErosions({ db, dryRun }) {
    const snapshot = await db.collection('shared').doc('geomonitor').collection('erosions').get();
    let batch = db.batch();
    const operations = { count: 0 };
    const counters = {
        migrated: 0,
        skipped: 0,
        errors: 0,
    };

    for (const doc of snapshot.docs) {
        const data = doc.data() || {};

        if (hasOwnCriticality(data)) {
            counters.skipped += 1;
            continue;
        }

        let nextCriticality = normalizeCriticalityPayload(data);
        let estimated = false;

        if (!nextCriticality && !isHistoricalErosionRecord(data)) {
            try {
                nextCriticality = calculateCriticality(buildCriticalityInputFromErosion(data));
                estimated = true;
            } catch (error) {
                counters.errors += 1;
                console.error(`[backfill] Falha ao recalcular criticidade para ${doc.id}:`, error.message);
                continue;
            }
        }

        if (!nextCriticality) {
            counters.skipped += 1;
            continue;
        }

        batch.set(doc.ref, {
            criticalidade: nextCriticality,
            ...(estimated ? { backfillEstimado: true } : {}),
            ultimaAtualizacao: data.ultimaAtualizacao || new Date().toISOString(),
        }, { merge: true });
        operations.count += 1;
        counters.migrated += 1;

        if (operations.count >= BATCH_LIMIT) {
            await commitBatch(batch, operations, dryRun);
            batch = db.batch();
        }
    }

    await commitBatch(batch, operations, dryRun);
    return counters;
}

async function backfillRules({ db, dryRun }) {
    const ref = db.collection('config').doc('rules');
    const snap = await ref.get();
    const current = snap.exists ? (snap.data() || {}) : {};

    if (current.criticalidade && typeof current.criticalidade === 'object') {
        return { migrated: 0, skipped: 1, errors: 0 };
    }

    const criticalidade = mergeCriticalityConfig(
        current.criticalidade
            ? { criticalidade: current.criticalidade }
            : (current.criticalityV2
                ? { criticalityV2: current.criticalityV2 }
                : { criticalidade: CRITICALITY_DEFAULTS }),
    );

    if (!dryRun) {
        await ref.set({
            criticalidade,
            updatedAt: new Date().toISOString(),
            updatedBy: 'backfill:criticalidade',
        }, { merge: true });
    }

    return { migrated: 1, skipped: 0, errors: 0 };
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const db = getDb();

    if (!db) {
        console.error('[backfill] Firebase nao foi inicializado. Verifique as credenciais antes de executar.');
        process.exitCode = 1;
        return;
    }

    console.log(`[backfill] Iniciando backfill canonico de criticidade${dryRun ? ' (dry-run)' : ''}...`);

    const erosionCounters = await backfillErosions({ db, dryRun });
    const rulesCounters = await backfillRules({ db, dryRun });

    console.log('[backfill] Resultado erosoes:', erosionCounters);
    console.log('[backfill] Resultado regras:', rulesCounters);
    console.log('[backfill] Concluido.');
}

main().catch((error) => {
    console.error('[backfill] Erro inesperado:', error);
    process.exitCode = 1;
});
