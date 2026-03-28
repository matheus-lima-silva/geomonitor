/**
 * ETL: Backfill de media — faz upload dos arquivos locais para o Tigris.
 *
 * Para cada media_asset no Postgres onde source_kind != 'tigris',
 * le o arquivo em .storage/media/{id}/{fileName}, faz upload para o Tigris
 * e atualiza o registro com sourceKind='tigris' e storageKey.
 *
 * Uso:
 *   DATA_BACKEND=postgres DATABASE_URL=... \
 *   MEDIA_BACKEND=tigris BUCKET_NAME=... \
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *   AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev AWS_REGION=auto \
 *     node scripts/etl-backfill-media.js [--dry-run] [--limit <n>]
 *
 * Opcoes:
 *   --dry-run       Lista o que seria feito sem gravar nem fazer upload
 *   --limit <n>     Processa no maximo N assets (util para testes parciais)
 *
 * Rerunavel: a query exclui automaticamente assets ja com source_kind='tigris'.
 */

'use strict';

process.env.DATA_BACKEND = 'postgres';

const fsNode = require('fs/promises');
const postgresStore = require('../data/postgresStore');
const mediaAssetRepository = require('../repositories/mediaAssetRepository');
const {
    writeStoredContent,
    buildLocalContentPath,
    sanitizeFileName,
} = require('../utils/mediaStorage');

const BATCH_LIMIT = 50; // menor que etl-extract-load: cada item faz I/O de arquivo

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function getFileName(asset) {
    const p = asset.payload || {};
    return p.fileName || p.originalFileName || null;
}

async function findLocalFile(mediaId, fileName) {
    if (fileName) {
        const candidate = buildLocalContentPath(mediaId, fileName);
        try {
            await fsNode.access(candidate);
            return { path: candidate, name: fileName };
        } catch {
            // nao encontrou com o nome esperado — tenta listar o diretorio
        }
    }

    // fallback: listar primeiro arquivo no diretorio do asset
    const mediaStorage = require('../utils/mediaStorage');
    const dir = require('path').join(
        process.env.MEDIA_STORAGE_ROOT
            ? require('path').resolve(process.env.MEDIA_STORAGE_ROOT)
            : require('path').join(__dirname, '..', '.storage', 'media'),
        String(mediaId || ''),
    );

    try {
        const entries = await fsNode.readdir(dir);
        const files = entries.filter((e) => !e.startsWith('.'));
        if (files.length > 0) {
            return { path: require('path').join(dir, files[0]), name: files[0] };
        }
    } catch {
        // diretorio nao existe
    }

    return null;
}

// --------------------------------------------------------------------------
// Processa um asset
// --------------------------------------------------------------------------

async function processAsset(asset, { dryRun }, counters) {
    const fileName = getFileName(asset);
    const localFile = await findLocalFile(asset.id, fileName);

    if (!localFile) {
        console.warn(`[backfill-media] ${asset.id}: arquivo local nao encontrado (fileName=${fileName || 'desconhecido'}), pulando.`);
        counters.missing++;
        return;
    }

    const effectiveFileName = localFile.name;
    const storageKey = asset.storage_key
        || `media/${asset.id}/${sanitizeFileName(effectiveFileName)}`;

    if (dryRun) {
        console.log(`[backfill-media] [dry-run] ${asset.id}: ${localFile.path} -> ${storageKey}`);
        counters.migrated++;
        return;
    }

    try {
        const buffer = await fsNode.readFile(localFile.path);

        // sourceKind: 'tigris' instrui writeStoredContent a rotear para S3
        const assetForUpload = {
            ...asset,
            id: asset.id,
            sourceKind: 'tigris',
            storageKey,
            contentType: asset.content_type || asset.payload?.contentType || 'application/octet-stream',
        };

        const result = await writeStoredContent(assetForUpload, buffer);

        await mediaAssetRepository.save({
            ...(asset.payload || {}),
            id: asset.id,
            purpose: asset.purpose,
            linkedResourceType: asset.linked_resource_type,
            linkedResourceId: asset.linked_resource_id,
            contentType: asset.content_type,
            sourceKind: 'tigris',
            storageKey,
            sha256: result.sha256,
            sizeBytes: result.storedSizeBytes,
            statusExecucao: 'ready',
            updatedBy: 'etl:backfill-media',
        });

        console.log(`[backfill-media] ${asset.id}: ok (${result.storedSizeBytes} bytes) -> ${storageKey}`);
        counters.migrated++;
    } catch (err) {
        console.error(`[backfill-media] ${asset.id}: ERRO — ${err.message}`);
        counters.errors++;
        // nao relanca — continua com proximo asset
    }
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const limitFlagIdx = process.argv.indexOf('--limit');
    const limit = limitFlagIdx !== -1 ? Number(process.argv[limitFlagIdx + 1]) : null;

    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        console.error('[backfill-media] ERRO: DATABASE_URL nao definida.');
        process.exitCode = 1;
        return;
    }

    if (!dryRun) {
        const bucket = process.env.BUCKET_NAME || process.env.TIGRIS_BUCKET_NAME;
        const key = process.env.AWS_ACCESS_KEY_ID;
        const secret = process.env.AWS_SECRET_ACCESS_KEY;
        const endpoint = process.env.AWS_ENDPOINT_URL_S3;
        if (!bucket || !key || !secret || !endpoint) {
            console.error('[backfill-media] ERRO: credenciais Tigris incompletas (BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3).');
            process.exitCode = 1;
            return;
        }
    }

    console.log(`[backfill-media] Iniciando backfill de media${dryRun ? ' (dry-run)' : ''}${limit ? ` (limite: ${limit})` : ''}...`);

    // Buscar assets pendentes diretamente — mediaAssetRepository nao tem listAll
    const queryResult = await postgresStore.query(
        `SELECT id, purpose, storage_key, source_kind, content_type,
                linked_resource_type, linked_resource_id, payload,
                created_at, updated_at
         FROM media_assets
         WHERE source_kind IS DISTINCT FROM 'tigris'
         ORDER BY created_at ASC`,
    );

    let assets = queryResult.rows;

    if (limit && limit > 0) {
        assets = assets.slice(0, limit);
    }

    console.log(`[backfill-media] ${assets.length} asset(s) pendente(s) encontrado(s).`);

    const counters = { migrated: 0, missing: 0, errors: 0 };

    for (let i = 0; i < assets.length; i += BATCH_LIMIT) {
        const chunk = assets.slice(i, i + BATCH_LIMIT);
        for (const asset of chunk) {
            await processAsset(asset, { dryRun }, counters);
        }
        console.log(`[backfill-media] progresso: ${Math.min(i + BATCH_LIMIT, assets.length)}/${assets.length}`);
    }

    console.log('\n[backfill-media] ===== RESUMO =====');
    console.log(`[backfill-media]   migrated : ${counters.migrated}`);
    console.log(`[backfill-media]   missing  : ${counters.missing}  (arquivo local ausente)`);
    console.log(`[backfill-media]   errors   : ${counters.errors}`);

    if (counters.errors > 0) {
        console.warn('[backfill-media] AVISO: ha erros. Verifique os logs acima antes do cutover.');
        process.exitCode = 1;
    } else if (counters.missing > 0) {
        console.warn('[backfill-media] AVISO: ha arquivos locais ausentes. Esses assets nao foram migrados.');
    } else {
        console.log('[backfill-media] Concluido com sucesso.');
    }

    await postgresStore.closePool();
}

main().catch((err) => {
    console.error('[backfill-media] Erro inesperado:', err);
    process.exitCode = 1;
    postgresStore.closePool().catch(() => {});
});
