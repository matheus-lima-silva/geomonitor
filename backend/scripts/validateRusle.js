#!/usr/bin/env node
// Valida o indice RUSLE por torre contra as torres vistoriadas (Fase 6,
// docs/plans/erosao-acessos-geodados.md). Torre com erosao = marcada "temErosao"
// numa vistoria ou com erosao cadastrada; sem erosao = vistoriada sem marcacao.
// So leitura: imprime AUC geral, AUC dentro do empreendimento e taxa por classe,
// para o indice e para cada fator. Rodar de novo quando entrarem vistorias.
//
// Uso (no homelab roda dentro do container da API):
//   node scripts/validateRusle.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { towerEnvironmentRepository } = require('../repositories');
const { computeAuc, computeAucWithinGroups, erosionRateByClass } = require('../utils/rusleValidation');

const MEDIDAS = [
    ['indice', 'Indice RUSLE'],
    ['ls', 'LS (relevo, Copernicus)'],
    ['declividadeCopernicus', 'Declividade Copernicus'],
    ['declividadeAnadem', 'Declividade ANADEM'],
    ['c', 'C (cobertura)'],
    ['k', 'K (solo)'],
    ['r', 'R (chuva)'],
];

const fmt = (v) => (v === null ? '-' : v.toFixed(2));

async function main() {
    const rows = (await towerEnvironmentRepository.listForRusleValidation())
        .filter((r) => Number.isFinite(r.indice));
    const comErosao = rows.filter((r) => r.erosao).length;
    console.log(`${rows.length} torre(s) vistoriada(s) com indice RUSLE: ${comErosao} com erosao, ${rows.length - comErosao} sem`);
    MEDIDAS.forEach(([campo, nome]) => {
        const base = rows.map((r) => ({ grupo: r.projectId, erosao: r.erosao, valor: r[campo] }));
        const geral = computeAuc(base);
        const dentro = computeAucWithinGroups(base);
        console.log(`${nome.padEnd(26)} AUC geral ${fmt(geral.auc)}   dentro do empreendimento ${fmt(dentro.auc)} (${dentro.pares} pares)`);
    });
    console.log('Taxa de erosao por classe RUSLE:');
    erosionRateByClass(rows).forEach(({ classe, comErosao: c, total, taxa }) => {
        console.log(`  ${classe.padEnd(11)} ${c}/${total}${taxa === null ? '' : ` = ${(taxa * 100).toFixed(1)}%`}`);
    });
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
