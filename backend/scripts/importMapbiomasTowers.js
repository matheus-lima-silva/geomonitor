#!/usr/bin/env node
// Importa o uso do solo do MapBiomas por torre (CSV exportado pelo script do
// Earth Engine, ver docs/plans/erosao-acessos-geodados.md, Fase 3) para
// tower_environment. O MapBiomas vira a fonte principal dos usos do solo
// sugeridos; o WorldCover fica de reserva. Dados (c) MapBiomas, CC BY 4.0.
//
// Uso (no homelab roda dentro do container da API):
//   node scripts/importMapbiomasTowers.js --file=/tmp/mapbiomas_c11_torres_2024.csv           # dry-run
//   node scripts/importMapbiomasTowers.js --file=/tmp/mapbiomas_c11_torres_2024.csv --apply

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { towerEnvironmentRepository } = require('../repositories');
const { parseMapbiomasTowerCsv, summarizeMapbiomasHistogram } = require('../utils/mapbiomasClasses');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}

async function main() {
    const file = argValue('file');
    if (!file) throw new Error('Informe --file=<csv>.');
    const apply = process.argv.includes('--apply');
    const records = parseMapbiomasTowerCsv(fs.readFileSync(file, 'utf8'));
    const rows = [];
    let empty = 0;
    records.forEach((r) => {
        const summary = summarizeMapbiomasHistogram(r.histogram);
        if (!summary) { empty += 1; return; }
        rows.push({ projectId: r.projeto, towerNumber: r.torre, mapbiomas: { ano: r.ano, colecao: r.colecao, ...summary } });
    });
    const anos = [...new Set(records.map((r) => r.ano))];
    const colecoes = [...new Set(records.map((r) => r.colecao))];
    const usos = {};
    rows.forEach((r) => r.mapbiomas.usosSoloSugeridos.forEach((u) => { usos[u] = (usos[u] || 0) + 1; }));
    console.log(`${records.length} linha(s), ${rows.length} com classes, ${empty} vazia(s); ano(s) ${anos.join(', ')}; colecao ${colecoes.join(', ')}`);
    console.log('usos sugeridos (torres):', JSON.stringify(usos));
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }
    const source = {
        nome: 'MapBiomas Brasil',
        colecao: colecoes.join(', '),
        ano: anos.join(', '),
        licenca: 'CC BY 4.0, (c) MapBiomas',
        rotulo: `MapBiomas C${colecoes[0]} ${anos.join('/')}`,
    };
    const updated = await towerEnvironmentRepository.mergeMapbiomas(rows, source);
    console.log(`ok: ${updated} torre(s) atualizada(s) de ${rows.length}`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
