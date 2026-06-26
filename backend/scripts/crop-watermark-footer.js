#!/usr/bin/env node
// Corta uma faixa inferior ("rodape") das fotos de UM workspace, in-place, para
// remover a ultima linha de uma marca d'agua queimada nos pixels (ex.: numero de
// torre errado). Preserva TODA a curadoria: legenda, torre, include_in_report e
// GPS vivem na linha report_photos e NAO sao tocados — so o binario do
// media_asset (mesmo storage_key) eh sobrescrito.
//
// Fluxo:
//   1. lista report_photos ativas do workspace (listByWorkspace)
//   2. para cada foto: le o binario -> corta a faixa -> (apply) backup + sobrescreve
//      o mesmo storage_key + atualiza sha256/size do media_asset
//
// Uso:
//   DRY-RUN / PREVIEW (nao grava nada; escreve pares antes/depois p/ calibrar):
//     node backend/scripts/crop-watermark-footer.js --workspace=WS-XXX --percent=6 --limit=3
//   APPLY (sobrescreve no MinIO, com backup local dos originais):
//     node backend/scripts/crop-watermark-footer.js --workspace=WS-XXX --pixels=80 --apply
//
// Flags:
//   --workspace=WS-ID   (obrigatorio) workspace alvo
//   --percent=N         faixa a cortar em % da altura (ex.: 6 = 6%)
//   --pixels=N          faixa a cortar em pixels absolutos (precede --percent)
//   --apply             persiste (sobrescreve binario + atualiza media_asset)
//   --backup-dir=PATH   pasta de backup/preview (default: backend/.backup-watermark/<workspaceId>)
//   --limit=N           processa apenas as N primeiras fotos (default no preview: 3)
//   --only=PHOTO-ID     processa apenas essa foto
//   --verbose           imprime detalhe por foto

const path = require('path');
const fs = require('fs/promises');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { reportPhotoRepository, mediaAssetRepository } = require('../repositories');
const { readStoredMediaContent, writeStoredContent } = require('../utils/mediaStorage');
const { cropBottomBand } = require('../utils/imageCrop');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}
function argNumber(name) {
    const raw = argValue(name);
    if (!raw) return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
}

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const WORKSPACE_ID = argValue('workspace');
const ONLY = argValue('only');
const PIXELS = argNumber('pixels');
const PERCENT_RAW = argNumber('percent'); // em % (6 => 0.06)
const LIMIT = (() => {
    const n = argNumber('limit');
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    return APPLY ? 0 : 3; // preview default = 3; apply default = todas
})();
const BACKUP_DIR = argValue('backup-dir')
    || path.resolve(__dirname, '..', '.backup-watermark', WORKSPACE_ID || 'sem-workspace');

function sanitizeSegment(value, fallback) {
    const s = String(value || '').replace(/[^\w.\-]+/g, '_');
    return s || fallback;
}

function resolveCropOptions() {
    if (Number.isFinite(PIXELS) && PIXELS > 0) return { pixels: PIXELS };
    if (Number.isFinite(PERCENT_RAW) && PERCENT_RAW > 0) return { percent: PERCENT_RAW / 100 };
    return null;
}

async function main() {
    if (!WORKSPACE_ID) {
        console.error('ERRO: informe --workspace=WS-ID.');
        process.exit(2);
    }
    const cropOptions = resolveCropOptions();
    if (!cropOptions) {
        console.error('ERRO: informe --pixels=N (>0) ou --percent=N (>0).');
        process.exit(2);
    }

    let photos = await reportPhotoRepository.listByWorkspace(WORKSPACE_ID);
    if (ONLY) photos = photos.filter((p) => p.id === ONLY);
    const total = photos.length;
    if (LIMIT > 0) photos = photos.slice(0, LIMIT);

    const previewDir = path.join(BACKUP_DIR, 'preview');
    await fs.mkdir(APPLY ? BACKUP_DIR : previewDir, { recursive: true });

    console.log('=== crop-watermark-footer ===');
    console.log(`  workspace:  ${WORKSPACE_ID}`);
    console.log(`  modo:       ${APPLY ? 'APPLY (sobrescreve)' : 'PREVIEW (nao grava)'}`);
    console.log(`  corte:      ${cropOptions.pixels ? `${cropOptions.pixels}px` : `${PERCENT_RAW}%`}`);
    console.log(`  fotos:      ${photos.length} processadas (total ativas no workspace: ${total}${ONLY ? `, filtro=${ONLY}` : ''})`);
    console.log(`  ${APPLY ? 'backup' : 'preview'}:     ${APPLY ? BACKUP_DIR : previewDir}`);
    console.log('');

    const summary = { ok: 0, skipped: [], errors: [] };
    let i = 0;
    for (const photo of photos) {
        i += 1;
        const tag = `[${i}/${photos.length}] ${photo.id}`;
        const mediaAssetId = String(photo.mediaAssetId || '').trim();
        if (!mediaAssetId) {
            summary.skipped.push(`${photo.id}: sem mediaAssetId`);
            console.log(`${tag} SKIP (sem mediaAssetId)`);
            continue;
        }

        try {
            const asset = await mediaAssetRepository.getById(mediaAssetId);
            if (!asset) {
                summary.skipped.push(`${photo.id}: media ${mediaAssetId} nao encontrada`);
                console.log(`${tag} SKIP (media ${mediaAssetId} ausente)`);
                continue;
            }

            const original = await readStoredMediaContent(asset);
            const cropped = await cropBottomBand(original.buffer, cropOptions);

            const baseName = sanitizeSegment(original.fileName || `${photo.id}.jpg`, `${photo.id}.jpg`);

            if (!APPLY) {
                const stem = sanitizeSegment(photo.id, 'foto');
                await fs.writeFile(path.join(previewDir, `${stem}__antes_${baseName}`), original.buffer);
                await fs.writeFile(path.join(previewDir, `${stem}__depois_${baseName}`), cropped);
                summary.ok += 1;
                console.log(`${tag} torre=${photo.towerId || '-'} antes=${original.buffer.byteLength}B depois=${cropped.byteLength}B`);
                if (VERBOSE) console.log(`      legenda="${String(photo.caption || '').slice(0, 60)}"`);
                continue;
            }

            // APPLY: backup do original antes de sobrescrever (rollback local).
            await fs.writeFile(path.join(BACKUP_DIR, `${sanitizeSegment(photo.id, 'foto')}__${baseName}`), original.buffer);

            const storageResult = await writeStoredContent(asset, cropped);
            await mediaAssetRepository.save({
                ...asset,
                sha256: storageResult.sha256,
                contentSha256: storageResult.sha256,
                sizeBytes: storageResult.storedSizeBytes,
                storedSizeBytes: storageResult.storedSizeBytes,
                storedAt: storageResult.storedAt,
                filePath: storageResult.filePath || asset.filePath || '',
                etag: storageResult.etag || asset.etag || '',
                updatedAt: new Date().toISOString(),
                updatedBy: 'script:crop-watermark-footer',
            }, { merge: true });

            summary.ok += 1;
            console.log(`${tag} OK torre=${photo.towerId || '-'} ${original.buffer.byteLength}B -> ${cropped.byteLength}B (legenda preservada)`);
        } catch (err) {
            summary.errors.push(`${photo.id}: ${err?.message || err}`);
            console.log(`${tag} ERRO: ${err?.message || err}`);
        }
    }

    console.log('');
    console.log('=== Resumo ===');
    console.log(`  processadas OK: ${summary.ok}`);
    console.log(`  puladas:        ${summary.skipped.length}`);
    for (const s of summary.skipped) console.log(`    - ${s}`);
    console.log(`  erros:          ${summary.errors.length}`);
    for (const e of summary.errors) console.log(`    - ${e}`);
    if (APPLY) {
        console.log(`\n  backup dos originais em: ${BACKUP_DIR}`);
        console.log('DONE.');
    } else {
        console.log(`\n  pares antes/depois em: ${previewDir}`);
        console.log('(preview — revise o corte e rode com --apply para persistir)');
    }
}

main().then(() => process.exit(0)).catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
});
