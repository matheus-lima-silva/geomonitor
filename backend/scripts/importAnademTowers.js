#!/usr/bin/env node
// Importa a declividade do ANADEM v1 por torre (CSV exportado pelo script do
// Earth Engine exportar_anadem_geomonitor.js, ver docs/plans/erosao-acessos-geodados.md,
// Fases 3 e 6) para tower_environment, no bloco payload.anadem, como referencia.
// A declividade do Copernicus continua nos campos de topo e segue sendo a usada
// pela RUSLE e pela ficha: na validacao contra as torres vistoriadas o ANADEM
// separou pior as torres com erosao (ver o plano, Fase 6).
//
// Uso (no homelab roda dentro do container da API):
//   node scripts/importAnademTowers.js --file=/app/.job/anadem_v1_torres.csv           # dry-run
//   node scripts/importAnademTowers.js --file=/app/.job/anadem_v1_torres.csv --apply

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { towerEnvironmentRepository } = require('../repositories');
const { ANADEM_SOURCE, parseAnademTowerCsv } = require('../utils/anademTerrain');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}

async function main() {
    const file = argValue('file');
    if (!file) throw new Error('Informe --file=<csv>.');
    const apply = process.argv.includes('--apply');
    const records = parseAnademTowerCsv(fs.readFileSync(file, 'utf8'));
    const diffs = records
        .filter((r) => r.copernicusGee)
        .map((r) => r.anadem.declividadeMediaGraus - r.copernicusGee.declividadeMediaGraus)
        .sort((a, b) => a - b);
    const mean = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
    console.log(`${records.length} torre(s) com declividade do ANADEM`);
    if (diffs.length) {
        console.log(`ANADEM - Copernicus (graus): media ${mean.toFixed(2)}, mediana ${diffs[Math.floor(diffs.length / 2)].toFixed(2)}`);
    }
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }
    const rows = records.map((r) => ({
        projectId: r.projeto,
        towerNumber: r.torre,
        anadem: { ...r.anadem, raioM: 50, copernicusGee: r.copernicusGee },
    }));
    const updated = await towerEnvironmentRepository.mergeAnadem(rows, ANADEM_SOURCE);
    console.log(`ok: ${updated} torre(s) atualizada(s) de ${rows.length}`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
