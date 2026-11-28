#!/usr/bin/env node
// Solo (IBGE) e indice de suscetibilidade RUSLE por torre (Fases 3/6,
// docs/plans/erosao-acessos-geodados.md). Usa o que ja esta em tower_environment
// (declividade do DEM, cobertura MapBiomas), a tabela ibge_pedologia e o fator R
// do REDB-BR (backend/geodata/REDBBR_Rfactor.tif, CC BY 4.0).
//
// Uso (no homelab roda dentro do container da API):
//   node scripts/computeTowerSoilErosion.js --all            # dry-run (resumo)
//   node scripts/computeTowerSoilErosion.js --all --apply
//   node scripts/computeTowerSoilErosion.js --projects=ARAPCA --apply

const fs = require('fs');
const path = require('path');
// Script em lote: consultas espaciais mais longas que o limite padrao da API.
process.env.POSTGRES_STATEMENT_TIMEOUT_MS = process.env.POSTGRES_STATEMENT_TIMEOUT_MS_SCRIPTS || '120000';
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { projectRepository, towerEnvironmentRepository } = require('../repositories');
const { soilFormTypeFromIbge, provisionalK, computeRusle } = require('../utils/soilErosion');

const R_TIF = path.resolve(__dirname, '..', 'geodata', 'REDBBR_Rfactor.tif');

function argValue(name) {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : '';
}

async function loadRFactorSampler(file = R_TIF) {
    const { fromArrayBuffer } = await import('geotiff');
    const bytes = fs.readFileSync(file);
    const image = await (await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).getImage();
    const [x0, , , y1] = image.getBoundingBox();
    const [rx, ry] = image.getResolution();
    const [values] = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    return (lon, lat) => {
        const px = Math.floor((lon - x0) / rx);
        const py = Math.floor((lat - y1) / ry);
        if (px < 0 || py < 0 || px >= width || py >= height) return null;
        const v = values[py * width + px];
        return Number.isFinite(v) && v > 0 && v < 1e6 ? v : null;
    };
}

async function main() {
    const apply = process.argv.includes('--apply');
    const wanted = argValue('projects').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!process.argv.includes('--all') && wanted.length === 0) throw new Error('Informe --projects=A,B ou --all.');
    const projects = (await projectRepository.list())
        .filter((p) => process.argv.includes('--all') || wanted.includes(String(p.id).toUpperCase()));
    const sampleR = await loadRFactorSampler();
    // Um projeto por vez: a busca do poligono de solo por ponto e pesada para
    // todas as torres numa query so (estoura o statement_timeout).
    const rows = [];
    for (const project of projects) {
        rows.push(...await towerEnvironmentRepository.listForSoilErosion([project.id]));
    }

    const out = [];
    const stats = { semSolo: 0, semRusle: 0, tipos: {}, classes: {} };
    rows.forEach((row) => {
        const ibge = row.simbolo || row.ordem ? {
            simbolo: row.simbolo, legenda: row.legenda, ordem: row.ordem, subordem: row.subordem,
            grandeGrupo: row.grande_grupo, textura: row.textura, relevo: row.relevo, versao: row.versao,
        } : null;
        if (!ibge) stats.semSolo += 1;
        const tipoSoloSugerido = ibge ? soilFormTypeFromIbge(ibge) : null;
        const k = ibge ? provisionalK(ibge) : null;
        const r = sampleR(Number(row.longitude), Number(row.latitude));
        const rusle = computeRusle({ r, k, slopeDeg: row.declividade, cobertura: row.cobertura });
        if (!rusle) stats.semRusle += 1;
        if (tipoSoloSugerido) stats.tipos[tipoSoloSugerido] = (stats.tipos[tipoSoloSugerido] || 0) + 1;
        if (rusle) stats.classes[rusle.classe] = (stats.classes[rusle.classe] || 0) + 1;
        out.push({
            projectId: row.project_id,
            towerNumber: row.tower_number,
            solo: { ibge, tipoSoloSugerido, kProvisorio: k, fonte: ibge ? `IBGE Pedologia 1:250.000 (${ibge.versao})` : null },
            rusle,
        });
    });
    console.log(`${rows.length} torre(s); sem classe de solo: ${stats.semSolo}; sem RUSLE: ${stats.semRusle}`);
    console.log('tipo de solo sugerido:', JSON.stringify(stats.tipos));
    console.log('classe RUSLE:', JSON.stringify(stats.classes));
    if (!apply) {
        console.log('dry-run: nada gravado (use --apply)');
        return;
    }
    const updated = await towerEnvironmentRepository.mergeSoilErosion(out, {
        solo: { nome: 'IBGE BDiA Pedologia 1:250.000', versao: '2026' },
        erosividade: { nome: 'REDB-BR (Rainfall Erosivity Database for Brazil)', licenca: 'CC BY 4.0', doi: '10.5281/zenodo.4428308' },
        rusle: { observacao: 'Indice relativo; K provisorio por ordem de solo; C por uso MapBiomas; rampa 50 m' },
    });
    console.log(`ok: ${updated} torre(s) atualizada(s)`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO', error);
    process.exit(1);
});
