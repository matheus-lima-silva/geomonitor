/**
 * ETL: Extrai todas as colecoes do Firestore e carrega no Postgres.
 *
 * Uso:
 *   DATA_BACKEND=postgres DATABASE_URL=... FIREBASE_SERVICE_ACCOUNT_JSON='...' \
 *     node scripts/etl-extract-load.js [--dry-run] [--collection <nome>]
 *
 * Opcoes:
 *   --dry-run          Conta documentos e simula sem gravar no Postgres
 *   --collection <X>   Processa apenas a colecao Firestore com nome X
 *
 * Variaveis obrigatorias:
 *   DATA_BACKEND=postgres
 *   DATABASE_URL
 *   FIREBASE_SERVICE_ACCOUNT_JSON (ou serviceAccountKey.json presente)
 *
 * O script e idempotente: todos os repositorios usam ON CONFLICT DO UPDATE.
 */

'use strict';

process.env.DATA_BACKEND = 'postgres';

const { getDb, getCollection } = require('../utils/firebaseSetup');
const postgresStore = require('../data/postgresStore');
const {
    userRepository,
    projectRepository,
    operatingLicenseRepository,
    inspectionRepository,
    reportTemplateRepository,
    erosionRepository,
    reportWorkspaceRepository,
    projectDossierRepository,
    reportDefaultsRepository,
    reportCompoundRepository,
    mediaAssetRepository,
    reportPhotoRepository,
    workspaceImportRepository,
    reportJobRepository,
    reportDeliveryTrackingRepository,
    projectPhotoExportRepository,
    workspaceKmzRequestRepository,
    rulesConfigRepository,
} = require('../repositories');

const BATCH_LIMIT = 200;

// --------------------------------------------------------------------------
// Dispatch table
// Cada entrada: { name, handler(doc) }
// name = nome da colecao Firestore (ou 'rulesConfig' para o caso especial)
// handler = funcao que recebe { id, ...data } e chama o repositorio correto
// --------------------------------------------------------------------------

function buildDispatch() {
    return [
        // Onda 1 — dados de referencia standalone
        {
            name: 'users',
            handler: (data) => userRepository.save(data),
        },
        {
            name: 'projects',
            handler: (data) => projectRepository.save(data),
        },
        {
            name: 'operating_licenses',
            handler: (data) => operatingLicenseRepository.save(data),
        },
        {
            name: 'inspections',
            handler: (data) => inspectionRepository.save(data),
        },
        {
            name: 'reportTemplates',
            handler: (data) => reportTemplateRepository.save(data),
        },
        // rulesConfig: tratado separadamente em migrateRulesConfig()

        // Onda 2 — entidades que referenciam projects/inspections
        {
            name: 'erosions',
            handler: (data) => erosionRepository.save(data),
        },
        {
            name: 'reportWorkspaces',
            handler: (data) => reportWorkspaceRepository.save(data),
        },
        {
            name: 'projectDossiers',
            handler: (data) => projectDossierRepository.save(data),
        },
        {
            // doc.id == projectId no Firestore
            name: 'projectReportDefaults',
            handler: (data) => reportDefaultsRepository.save(data.id, data),
        },
        {
            name: 'reportCompounds',
            handler: (data) => reportCompoundRepository.save(data),
        },

        // Onda 3 — entidades que referenciam workspaces/dossiers
        {
            name: 'mediaAssets',
            handler: (data) => mediaAssetRepository.save(data),
        },
        {
            name: 'reportPhotos',
            handler: (data) => reportPhotoRepository.save(data),
        },
        {
            name: 'workspaceImports',
            handler: (data) => workspaceImportRepository.save(data),
        },
        {
            name: 'reportJobs',
            handler: (data) => reportJobRepository.save(data),
        },
        {
            name: 'reportDeliveryTracking',
            handler: (data) => reportDeliveryTrackingRepository.save(data),
        },

        // Onda 4 — tokens efemeros
        {
            // doc.id == token no Firestore
            name: 'projectPhotoExports',
            handler: (data) => projectPhotoExportRepository.save(data.id, data),
        },
        {
            // doc.id == token no Firestore
            name: 'workspaceKmzRequests',
            handler: (data) => workspaceKmzRequestRepository.save(data.id, data),
        },
    ];
}

// --------------------------------------------------------------------------
// rulesConfig: path especial config/rules (fora de shared/geomonitor)
// --------------------------------------------------------------------------

async function migrateRulesConfig({ dryRun }) {
    const db = getDb();
    const doc = await db.collection('config').doc('rules').get();
    const counters = { migrated: 0, skipped: 0, errors: 0 };

    if (!doc.exists) {
        console.log('[etl] rulesConfig: documento nao encontrado no Firestore, pulando.');
        counters.skipped = 1;
        return counters;
    }

    try {
        if (!dryRun) {
            await rulesConfigRepository.save(doc.data());
        }
        counters.migrated = 1;
    } catch (err) {
        counters.errors = 1;
        console.error(`[etl] rulesConfig/default: ${err.message}`);
    }

    console.log(`[etl] rulesConfig: 1/1${dryRun ? ' [dry-run]' : ''}`);
    return counters;
}

// --------------------------------------------------------------------------
// Migra uma colecao generica
// --------------------------------------------------------------------------

async function migrateCollection(entry, { dryRun }) {
    const { name, handler } = entry;
    const counters = { migrated: 0, skipped: 0, errors: 0 };

    let snapshot;
    try {
        snapshot = await getCollection(name).get();
    } catch (err) {
        console.error(`[etl] ${name}: erro ao buscar colecao no Firestore: ${err.message}`);
        counters.errors = 1;
        return counters;
    }

    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const chunk = docs.slice(i, i + BATCH_LIMIT);

        for (const doc of chunk) {
            const data = { id: doc.id, ...doc.data() };

            if (!data.id) {
                counters.skipped++;
                continue;
            }

            try {
                if (!dryRun) {
                    await handler(data);
                }
                counters.migrated++;
            } catch (err) {
                counters.errors++;
                console.error(`[etl] ${name}/${doc.id}: ${err.message}`);
                // nao relanca — continua com proximo documento
            }
        }

        const processed = Math.min(i + BATCH_LIMIT, docs.length);
        console.log(`[etl] ${name}: ${processed}/${docs.length}${dryRun ? ' [dry-run]' : ''}`);
    }

    if (docs.length === 0) {
        console.log(`[etl] ${name}: 0 documentos encontrados`);
    }

    return counters;
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const collectionFlagIdx = process.argv.indexOf('--collection');
    const onlyCollection = collectionFlagIdx !== -1 ? process.argv[collectionFlagIdx + 1] : null;

    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        console.error('[etl] ERRO: DATABASE_URL nao definida. Configure e tente novamente.');
        process.exitCode = 1;
        return;
    }

    const db = getDb();
    if (!db) {
        console.error('[etl] ERRO: Firebase nao inicializado. Verifique FIREBASE_SERVICE_ACCOUNT_JSON ou serviceAccountKey.json.');
        process.exitCode = 1;
        return;
    }

    console.log(`[etl] Iniciando ETL extract-load${dryRun ? ' (dry-run — sem gravacoes)' : ''}...`);
    if (onlyCollection) {
        console.log(`[etl] Filtrando apenas colecao: ${onlyCollection}`);
    }

    const grandTotals = { migrated: 0, skipped: 0, errors: 0 };
    const results = {};

    // rulesConfig (caso especial) — incluir se nao ha filtro ou filtro bate
    if (!onlyCollection || onlyCollection === 'rulesConfig') {
        const c = await migrateRulesConfig({ dryRun });
        results['rulesConfig'] = c;
        grandTotals.migrated += c.migrated;
        grandTotals.skipped += c.skipped;
        grandTotals.errors += c.errors;
    }

    // colecoes genericas
    const dispatch = buildDispatch();
    const toRun = onlyCollection
        ? dispatch.filter((e) => e.name === onlyCollection)
        : dispatch;

    if (onlyCollection && toRun.length === 0 && onlyCollection !== 'rulesConfig') {
        console.error(`[etl] ERRO: colecao '${onlyCollection}' nao esta na dispatch table.`);
        process.exitCode = 1;
        await postgresStore.closePool();
        return;
    }

    for (const entry of toRun) {
        const c = await migrateCollection(entry, { dryRun });
        results[entry.name] = c;
        grandTotals.migrated += c.migrated;
        grandTotals.skipped += c.skipped;
        grandTotals.errors += c.errors;
    }

    // Resumo final
    console.log('\n[etl] ===== RESUMO =====');
    for (const [col, c] of Object.entries(results)) {
        console.log(`[etl]   ${col}: migrated=${c.migrated} skipped=${c.skipped} errors=${c.errors}`);
    }
    console.log(`[etl] TOTAL: migrated=${grandTotals.migrated} skipped=${grandTotals.skipped} errors=${grandTotals.errors}`);

    if (grandTotals.errors > 0) {
        console.warn(`[etl] AVISO: ${grandTotals.errors} erro(s) encontrado(s). Verifique os logs acima.`);
        process.exitCode = 1;
    } else {
        console.log('[etl] Concluido com sucesso.');
    }

    await postgresStore.closePool();
}

main().catch((err) => {
    console.error('[etl] Erro inesperado:', err);
    process.exitCode = 1;
    postgresStore.closePool().catch(() => {});
});
