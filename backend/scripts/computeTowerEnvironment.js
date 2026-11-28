#!/usr/bin/env node
// Calcula os atributos do meio fisico por torre (Fases 3/4,
// docs/plans/erosao-acessos-geodados.md): elevacao, declividade media/maxima,
// orientacao da encosta e cobertura do solo num raio em volta de cada torre,
// lendo so os trechos necessarios dos rasters publicos (Copernicus DEM GLO-30 e
// ESA WorldCover) — nada e baixado inteiro.
//
// Torres ja calculadas com a mesma coordenada sao puladas (retomada), salvo --refresh.
//
// Uso (no homelab roda dentro do container da API, cwd /app):
//   node scripts/computeTowerEnvironment.js --projects=ARAPCA            # dry-run
//   node scripts/computeTowerEnvironment.js --projects=ARAPCA --apply
//   node scripts/computeTowerEnvironment.js --all --apply
//
// Flags: --projects=A,B | --all, --apply, --refresh, --radius=50 (m), --concurrency=6

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { projectRepository, towerEnvironmentRepository } = require('../repositories');
const { createRasterReader } = require('../utils/rasterSources');
const { computePointEnvironment, DEFAULT_RADIUS_M } = require('../utils/towerEnvironment');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function towersOf(project) {
    return (Array.isArray(project.torresCoordenadas) ? project.torresCoordenadas : [])
        .map((t) => ({
            projectId: project.id,
            towerNumber: String(t?.numero ?? '').trim(),
            latitude: Number(t?.latitude),
            longitude: Number(t?.longitude),
        }))
        .filter((t) => t.towerNumber && Number.isFinite(t.latitude) && Number.isFinite(t.longitude)
            && Math.abs(t.latitude) <= 90 && Math.abs(t.longitude) <= 180);
}

async function main() {
    const apply = hasFlag('apply');
    const radiusM = Number(argValue('radius')) || DEFAULT_RADIUS_M;
    const concurrency = Math.max(1, Number(argValue('concurrency')) || 6);
    const wanted = argValue('projects').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!hasFlag('all') && wanted.length === 0) throw new Error('Informe --projects=A,B ou --all.');

    const projects = (await projectRepository.list())
        .filter((p) => hasFlag('all') || wanted.includes(String(p.id).toUpperCase()));
    const towers = projects.flatMap(towersOf);
    const done = hasFlag('refresh') ? new Set() : await towerEnvironmentRepository.listComputedKeys(projects.map((p) => p.id));
    const keyOf = (t) => `${t.projectId}|${t.towerNumber}|${t.latitude.toFixed(6)}|${t.longitude.toFixed(6)}`;
    // Ordem geografica: torres vizinhas reaproveitam os blocos ja lidos dos rasters.
    const pending = towers.filter((t) => !done.has(keyOf(t)))
        .sort((a, b) => (Math.floor(a.latitude) - Math.floor(b.latitude)) || (Math.floor(a.longitude) - Math.floor(b.longitude))
            || (a.latitude - b.latitude) || (a.longitude - b.longitude));
    console.log(`${projects.length} empreendimento(s), ${towers.length} torre(s): ${towers.length - pending.length} ja calculada(s), ${pending.length} a calcular (raio ${radiusM} m)`);
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }

    const reader = createRasterReader();
    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;
    let cursor = 0;
    async function workerLoop() {
        while (cursor < pending.length) {
            const tower = pending[cursor];
            cursor += 1;
            const result = await computePointEnvironment(reader, { lat: tower.latitude, lon: tower.longitude, radiusM });
            if (result.errors.length === 2) {
                failed += 1;
                console.warn(`  ${tower.projectId} T${tower.towerNumber}: ${result.errors.join('; ')}`);
            } else {
                await towerEnvironmentRepository.upsert({ ...tower, payload: { ...result.payload, erros: result.errors }, sources: result.sources });
            }
            processed += 1;
            if (processed % 200 === 0 || processed === pending.length) {
                const elapsedMin = (Date.now() - startedAt) / 60000;
                const etaMin = (elapsedMin / processed) * (pending.length - processed);
                console.log(`${processed}/${pending.length} torres (${failed} com erro); faltam ~${Math.round(etaMin)} min`);
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
    console.log(`ok: ${processed - failed} torre(s) gravada(s), ${failed} com erro`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
