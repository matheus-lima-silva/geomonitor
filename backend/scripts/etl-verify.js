/**
 * ETL: Verifica contagens Firestore vs Postgres por colecao.
 *
 * Para cada colecao, compara o numero de documentos no Firestore com o numero
 * de linhas na tabela Postgres correspondente. Reporta OK ou MISMATCH.
 * Em caso de MISMATCH, lista ate 5 IDs presentes no Firestore mas ausentes
 * no Postgres para facilitar investigacao.
 *
 * Uso:
 *   DATA_BACKEND=postgres DATABASE_URL=... FIREBASE_SERVICE_ACCOUNT_JSON='...' \
 *     node scripts/etl-verify.js [--collection <nome>]
 *
 * Opcoes:
 *   --collection <X>   Verifica apenas a colecao com nome X
 *
 * Execute apos etl-extract-load.js e antes do cutover.
 */

'use strict';

process.env.DATA_BACKEND = 'postgres';

const { getDb, getCollection } = require('../utils/firebaseSetup');
const postgresStore = require('../data/postgresStore');

// --------------------------------------------------------------------------
// Mapa colecao Firestore -> tabela Postgres
// --------------------------------------------------------------------------

const COLLECTION_TABLE_MAP = [
    { collection: 'users',                 table: 'users',                    pkCol: 'id' },
    { collection: 'projects',              table: 'projects',                 pkCol: 'id' },
    { collection: 'operatingLicenses',      table: 'operating_licenses',       pkCol: 'id' },
    { collection: 'inspections',           table: 'inspections',              pkCol: 'id' },
    { collection: 'reportTemplates',       table: 'report_templates',         pkCol: 'id' },
    { collection: 'erosions',              table: 'erosions',                 pkCol: 'id' },
    { collection: 'reportWorkspaces',      table: 'report_workspaces',        pkCol: 'id' },
    { collection: 'projectDossiers',       table: 'project_dossiers',         pkCol: 'id' },
    { collection: 'projectReportDefaults', table: 'project_report_defaults',  pkCol: 'project_id' },
    { collection: 'reportCompounds',       table: 'report_compounds',         pkCol: 'id' },
    { collection: 'mediaAssets',           table: 'media_assets',             pkCol: 'id' },
    { collection: 'reportPhotos',          table: 'report_photos',            pkCol: 'id' },
    { collection: 'workspaceImports',      table: 'workspace_imports',        pkCol: 'id' },
    { collection: 'reportJobs',            table: 'report_jobs',              pkCol: 'id' },
    { collection: 'reportDeliveryTracking',table: 'report_delivery_tracking', pkCol: 'id' },
    { collection: 'projectPhotoExports',   table: 'project_photo_exports',    pkCol: 'token' },
    { collection: 'workspaceKmzRequests',  table: 'workspace_kmz_requests',   pkCol: 'token' },
];

// --------------------------------------------------------------------------
// Verifica rulesConfig (path especial)
// --------------------------------------------------------------------------

async function verifyRulesConfig({ db }) {
    const doc = await db.collection('config').doc('rules').get();
    const firestoreCount = doc.exists ? 1 : 0;

    const pgResult = await postgresStore.query(`SELECT COUNT(*) FROM rules_config`);
    const postgresCount = Number(pgResult.rows[0].count);

    const status = firestoreCount === postgresCount ? 'OK' : 'MISMATCH';
    console.log(`[verify] rulesConfig (rules_config): Firestore=${firestoreCount} Postgres=${postgresCount} ${status}`);

    if (status === 'MISMATCH' && firestoreCount > 0 && postgresCount === 0) {
        console.log(`[verify]   -> ID ausente no Postgres: default`);
    }

    return { status, firestoreCount, postgresCount };
}

// --------------------------------------------------------------------------
// Verifica uma colecao generica
// --------------------------------------------------------------------------

async function verifyCollection(entry) {
    const { collection, table, pkCol } = entry;

    let snapshot;
    try {
        snapshot = await getCollection(collection).get();
    } catch (err) {
        console.error(`[verify] ${collection}: erro ao buscar Firestore: ${err.message}`);
        return { status: 'ERROR', firestoreCount: 0, postgresCount: 0 };
    }

    const firestoreCount = snapshot.docs.length;

    const pgResult = await postgresStore.query(`SELECT COUNT(*) FROM ${table}`);
    const postgresCount = Number(pgResult.rows[0].count);

    const status = firestoreCount === postgresCount ? 'OK' : 'MISMATCH';
    console.log(`[verify] ${collection} (${table}): Firestore=${firestoreCount} Postgres=${postgresCount} ${status}`);

    if (status === 'MISMATCH' && firestoreCount > postgresCount) {
        // Listar ate 5 IDs no Firestore que estao ausentes no Postgres
        const firestoreIds = snapshot.docs.map((d) => d.id);
        const sample = firestoreIds.slice(0, 200); // limitar para nao explodir a query

        const placeholders = sample.map((_, i) => `$${i + 1}`).join(', ');
        const pgIds = await postgresStore.query(
            `SELECT ${pkCol} AS id FROM ${table} WHERE ${pkCol} IN (${placeholders})`,
            sample,
        );
        const foundSet = new Set(pgIds.rows.map((r) => r.id));
        const missing = firestoreIds.filter((id) => !foundSet.has(id)).slice(0, 5);

        if (missing.length > 0) {
            console.log(`[verify]   -> IDs ausentes no Postgres (ate 5): ${missing.join(', ')}`);
        }
    }

    return { status, firestoreCount, postgresCount };
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

async function main() {
    const collectionFlagIdx = process.argv.indexOf('--collection');
    const onlyCollection = collectionFlagIdx !== -1 ? process.argv[collectionFlagIdx + 1] : null;

    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        console.error('[verify] ERRO: DATABASE_URL nao definida.');
        process.exitCode = 1;
        return;
    }

    const db = getDb();
    if (!db) {
        console.error('[verify] ERRO: Firebase nao inicializado. Verifique FIREBASE_SERVICE_ACCOUNT_JSON ou serviceAccountKey.json.');
        process.exitCode = 1;
        return;
    }

    console.log('[verify] Verificando contagens Firestore vs Postgres...\n');

    const results = {};
    let hasError = false;

    // rulesConfig (caso especial)
    if (!onlyCollection || onlyCollection === 'rulesConfig') {
        const r = await verifyRulesConfig({ db });
        results['rulesConfig'] = r;
        if (r.status !== 'OK') hasError = true;
    }

    // colecoes genericas
    const toCheck = onlyCollection
        ? COLLECTION_TABLE_MAP.filter((e) => e.collection === onlyCollection)
        : COLLECTION_TABLE_MAP;

    for (const entry of toCheck) {
        const r = await verifyCollection(entry);
        results[entry.collection] = r;
        if (r.status !== 'OK') hasError = true;
    }

    // Resumo
    console.log('\n[verify] ===== RESUMO =====');
    const mismatches = Object.entries(results).filter(([, r]) => r.status !== 'OK');
    if (mismatches.length === 0) {
        console.log('[verify] Todas as colecoes estao em sincronia. Pronto para cutover de dados.');
    } else {
        console.warn(`[verify] ${mismatches.length} colecao(oes) com MISMATCH:`);
        for (const [col, r] of mismatches) {
            console.warn(`[verify]   ${col}: Firestore=${r.firestoreCount} Postgres=${r.postgresCount}`);
        }
        console.warn('[verify] Execute etl-extract-load.js novamente antes do cutover.');
        process.exitCode = 1;
    }

    await postgresStore.closePool();
}

main().catch((err) => {
    console.error('[verify] Erro inesperado:', err);
    process.exitCode = 1;
    postgresStore.closePool().catch(() => {});
});
