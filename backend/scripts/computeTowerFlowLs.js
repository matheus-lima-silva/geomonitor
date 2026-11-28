#!/usr/bin/env node
// LS da RUSLE pelo fluxo acumulado por torre (Fase 6, docs/plans/erosao-acessos-geodados.md):
// le uma janela do Copernicus DEM GLO-30 em volta de cada torre (HTTP Range, so os
// blocos necessarios), preenche depressoes, acumula o fluxo e calcula o LS de
// Desmet & Govers (utils/flowLs.js). Grava em payload.lsFluxo; a RUSLE so usa
// esse LS quando computeTowerSoilErosion roda com --ls=fluxo.
//
// Uso (no homelab roda dentro do container da API):
//   node scripts/computeTowerFlowLs.js --vistoriadas --apply      # so torres vistoriadas (validacao)
//   node scripts/computeTowerFlowLs.js --all --apply
//   node scripts/computeTowerFlowLs.js --projects=ARAPCA          # dry-run
//
// Flags: --projects=A,B | --all | --vistoriadas, --apply, --refresh, --window=600 (m), --concurrency=6

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { projectRepository, towerEnvironmentRepository } = require('../repositories');
const { createRasterReader } = require('../utils/rasterSources');
const { computeFlowLs, MAX_RAMPA_M } = require('../utils/flowLs');

const RAIO_TORRE_M = 50;

/** Le a janela com ate 3 tentativas (quedas passageiras de conexao com o S3). */
async function readWindowRetry(reader, lat, lon, radiusM, tries = 3) {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await reader.readWindow('relevo', lat, lon, radiusM);
        } catch (error) {
            if (attempt >= tries) throw error;
            await new Promise((resolve) => { setTimeout(resolve, 2000 * attempt); });
        }
    }
}

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

async function main() {
    const apply = hasFlag('apply');
    const windowM = Number(argValue('window')) || 600;
    const concurrency = Math.max(1, Number(argValue('concurrency')) || 6);
    const wanted = argValue('projects').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const vistoriadas = hasFlag('vistoriadas');
    if (!hasFlag('all') && !vistoriadas && wanted.length === 0) throw new Error('Informe --projects=A,B, --all ou --vistoriadas.');

    let towers;
    if (vistoriadas) {
        const keys = new Set((await towerEnvironmentRepository.listForRusleValidation()).map((r) => `${r.projectId}|${r.towerNumber}`));
        const projectIds = [...new Set([...keys].map((k) => k.split('|')[0]))];
        towers = (await towerEnvironmentRepository.listForFlowLs(projectIds, { refresh: hasFlag('refresh') }))
            .filter((t) => keys.has(`${t.projectId}|${t.towerNumber}`));
    } else {
        const projectIds = (await projectRepository.list())
            .filter((p) => hasFlag('all') || wanted.includes(String(p.id).toUpperCase()))
            .map((p) => p.id);
        towers = await towerEnvironmentRepository.listForFlowLs(projectIds, { refresh: hasFlag('refresh') });
    }
    // Ordem geografica: torres vizinhas reaproveitam os blocos ja lidos do DEM.
    towers.sort((a, b) => (Math.floor(a.latitude) - Math.floor(b.latitude)) || (Math.floor(a.longitude) - Math.floor(b.longitude))
        || (a.latitude - b.latitude) || (a.longitude - b.longitude));
    console.log(`${towers.length} torre(s) a calcular (janela de ${windowM} m, rampa ate ${MAX_RAMPA_M} m)`);
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }

    const reader = createRasterReader();
    const startedAt = Date.now();
    const pendingWrites = [];
    let processed = 0;
    let failed = 0;
    let written = 0;
    let cursor = 0;
    const source = {
        nome: 'LS por fluxo acumulado (Desmet & Govers 1996, S de McCool 1987)',
        relevo: 'Copernicus DEM GLO-30',
        janelaM: windowM,
        rampaMaxM: MAX_RAMPA_M,
        roteamento: 'priority-flood + fluxo multiplo de Freeman (p = 1,1)',
    };
    async function flush(force = false) {
        if (pendingWrites.length === 0 || (!force && pendingWrites.length < 500)) return;
        const batch = pendingWrites.splice(0, pendingWrites.length);
        written += await towerEnvironmentRepository.mergeLsFluxo(batch, source);
    }
    async function workerLoop() {
        while (cursor < towers.length) {
            const tower = towers[cursor];
            cursor += 1;
            try {
                const dem = await readWindowRetry(reader, tower.latitude, tower.longitude, windowM);
                const out = computeFlowLs({ ...dem, radiusM: RAIO_TORRE_M });
                // janela cortada na borda do ladrilho de 1 grau: menos area a montante
                const esperado = 2 * (Math.ceil(windowM / dem.pixelH) + 2) + 1;
                if (out) pendingWrites.push({ ...tower, lsFluxo: { ...out, raioM: RAIO_TORRE_M, janelaM: windowM, janelaCortada: dem.height < esperado || dem.width < esperado - 2 } });
                else failed += 1;
            } catch (error) {
                failed += 1;
                console.warn(`  ${tower.projectId} T${tower.towerNumber}: ${error.message}`);
            }
            processed += 1;
            await flush();
            if (processed % 500 === 0 || processed === towers.length) {
                const elapsedMin = (Date.now() - startedAt) / 60000;
                const etaMin = (elapsedMin / processed) * (towers.length - processed);
                console.log(`${processed}/${towers.length} torres (${failed} com erro); faltam ~${Math.round(etaMin)} min`);
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
    await flush(true);
    console.log(`ok: ${written} torre(s) gravada(s), ${failed} com erro`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
