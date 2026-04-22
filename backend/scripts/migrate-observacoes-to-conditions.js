#!/usr/bin/env node
// Script one-shot para migrar os blocos `[Condicionante X.Y] <texto>` que vivem
// hoje dentro de operating_licenses.payload.observacoes para a tabela
// license_conditions (migration 0015).
//
// Uso:
//   DATABASE_URL=... node backend/scripts/migrate-observacoes-to-conditions.js         # dry-run
//   DATABASE_URL=... node backend/scripts/migrate-observacoes-to-conditions.js --apply # grava
//
// Idempotente: quando --apply, usa bulkReplace por licenseId, entao reexecucao
// nao duplica. Se ja existirem condicionantes avulsas na LO, o bulk substitui
// todas — garanta que os textos dos blocos estao corretos antes de rodar.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { operatingLicenseRepository, licenseConditionRepository } = require('../repositories');

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
    const arg = process.argv.find((a) => a.startsWith('--limit='));
    return arg ? Number(arg.split('=')[1]) : 0;
})();

function normalizeText(value) {
    return String(value || '').trim();
}

function buildConditionId(licenseId, numero, idx) {
    const licPart = normalizeText(licenseId).toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    const numPart = normalizeText(numero).toUpperCase().replace(/[^A-Z0-9]+/g, '-') || `IDX-${idx}`;
    return `COND-${licPart || 'UNKNOWN'}-${numPart}`;
}

function classifyTipo(texto) {
    const t = String(texto || '').toLowerCase();
    if (/erosi/.test(t) || /suscetibilidade erosi/.test(t)) return 'processos_erosivos';
    if (/prad|recuperac[ãa]o de [aá]reas degradadas/.test(t)) return 'prad';
    if (/supress[ãa]o/.test(t)) return 'supressao';
    if (/fauna|avifauna/.test(t)) return 'fauna';
    if (/emerg[eê]ncia/.test(t)) return 'emergencia';
    if (/comunicac[ãa]o social/.test(t)) return 'comunicacao';
    if (/compensac[ãa]o|reposic[ãa]o florestal/.test(t)) return 'compensacao';
    return 'geral';
}

function parseObservacoes(observacoes) {
    const out = { header: [], conditions: [], note: null };
    if (!observacoes) return out;

    const lines = String(observacoes).split(/\r?\n/);

    // Header sao linhas antes do primeiro "[Condicionante" ou "[Trecho" ou "[Condicionante]"
    const sections = [];
    let buf = { label: null, text: [] };
    const flush = () => { if (buf.label || buf.text.length) sections.push(buf); buf = { label: null, text: [] }; };

    for (const line of lines) {
        const m = line.match(/^\s*\[(Condicionante(?:\s+\S+)?|Trecho com[^\]]+|Condicionante)\]\s*(.*)$/);
        if (m) {
            flush();
            buf = { label: m[1], text: [m[2]] };
        } else {
            if (buf.label === null) {
                // header lines
                if (line.trim()) out.header.push(line);
            } else {
                buf.text.push(line);
            }
        }
    }
    flush();

    for (const sec of sections) {
        if (!sec.label) continue;
        const text = sec.text.join(' ').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        // Extrai numero do label "Condicionante 2.1" → "2.1"
        const numMatch = sec.label.match(/Condicionante\s+([\d\.,]+|\S+)/i);
        const numero = numMatch ? numMatch[1].replace(/,$/, '') : '';
        const isNotePlaceholder = sec.label === 'Condicionante' && /^(LO sem condicionante|Condicionante em Parecer T[eé]cnico|Texto da condicionante n[aã]o extra[ií]do)/i.test(text);
        if (isNotePlaceholder) {
            out.note = text;
            continue;
        }
        // Detectar trecho/fallback
        if (/^Trecho/i.test(sec.label)) {
            out.conditions.push({ numero: numero || 'fallback', texto: text, fallback: true });
        } else {
            out.conditions.push({ numero: numero || 'sem-numero', texto: text, fallback: false });
        }
    }

    return out;
}

function extractParecerRef(text) {
    if (!text) return '';
    const m = String(text).match(/Parecer\s+T[eé]cnico\s*(?:n[º°o\.]?:?\s*)?([\d\.\/\-]+)/i);
    return m ? m[1] : '';
}

async function main() {
    const all = await operatingLicenseRepository.list();
    console.log(`Total de LOs: ${all.length}  (modo ${APPLY ? 'APPLY' : 'dry-run'})`);
    let count = 0;
    let totalConditions = 0;
    let skippedNoObs = 0;

    for (const lic of all) {
        if (LIMIT && count >= LIMIT) break;
        count++;
        const licenseId = lic.id;
        const obs = String(lic.observacoes || '');
        const parsed = parseObservacoes(obs);

        if (!parsed.conditions.length && !parsed.note) {
            skippedNoObs++;
            continue;
        }

        const conditions = parsed.conditions.map((c, idx) => ({
            id: buildConditionId(licenseId, c.numero, idx),
            licenseId,
            numero: c.numero,
            texto: c.texto,
            tipo: classifyTipo(c.texto),
            ordem: idx,
            parecerTecnicoRef: extractParecerRef(c.texto),
            payload: c.fallback ? { fonteExtracao: 'fallback-trecho-erosivo' } : {},
        }));

        console.log(`\n[${count}] ${licenseId} :: ${conditions.length} condicionante(s)${parsed.note ? ` + nota: "${parsed.note.slice(0, 80)}..."` : ''}`);
        for (const c of conditions) {
            console.log(`  - ${c.id} [${c.tipo}] numero=${c.numero}  "${c.texto.slice(0, 100)}..."`);
        }

        if (APPLY) {
            if (conditions.length > 0) {
                await licenseConditionRepository.bulkReplace(licenseId, conditions, { updatedBy: 'migration:0015' });
                totalConditions += conditions.length;
            }
            // Rewrite observacoes deixando so header + nota (se houver)
            const newObs = [
                ...parsed.header,
                parsed.note ? `\n${parsed.note}` : '',
            ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
            const updated = { ...lic, observacoes: newObs };
            await operatingLicenseRepository.save(updated, { merge: true });
        }
    }

    console.log(`\n=== Resumo ===`);
    console.log(`LOs processadas: ${count}`);
    console.log(`LOs sem observacoes parseaveis (skip): ${skippedNoObs}`);
    if (APPLY) console.log(`Condicionantes gravadas: ${totalConditions}`);
    console.log(APPLY ? 'DONE.' : '(dry-run — rode novamente com --apply para persistir)');
}

main().then(() => process.exit(0)).catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
});
