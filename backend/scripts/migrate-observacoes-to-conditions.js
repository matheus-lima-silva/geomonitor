#!/usr/bin/env node
// Migra blocos `[Condicionante X.Y] <texto>` de operating_licenses.payload.observacoes
// para a tabela relacional license_conditions.
//
// Fluxo em 3 fases:
//   1. PARSE   — quebra o observacoes em blocos reconheciveis
//   2. SANITIZE — normaliza whitespace, deduplica, valida numero/texto, trunca
//   3. APPLY   — com --apply, grava via licenseConditionRepository.bulkReplace
//
// Uso:
//   DATABASE_URL=... node backend/scripts/migrate-observacoes-to-conditions.js
//       → dry-run com tabela "will-insert" pra voce revisar
//   DATABASE_URL=... node backend/scripts/migrate-observacoes-to-conditions.js --apply
//       → grava (idempotente: bulkReplace substitui toda a lista da LO)
//
// Flags:
//   --apply          persiste no banco
//   --limit=N        processa apenas as N primeiras LOs (util pra piloto)
//   --only=LO-ID     processa apenas essa LO
//   --verbose        imprime o texto inteiro de cada condicionante
//   --max-chars=N    trunca textos em N chars (default 8000; proteje contra JSON gigante)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { operatingLicenseRepository, licenseConditionRepository } = require('../repositories');

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = (() => {
    const arg = process.argv.find((a) => a.startsWith('--limit='));
    return arg ? Number(arg.split('=')[1]) : 0;
})();
const ONLY = (() => {
    const arg = process.argv.find((a) => a.startsWith('--only='));
    return arg ? arg.split('=')[1] : '';
})();
const MAX_CHARS = (() => {
    const arg = process.argv.find((a) => a.startsWith('--max-chars='));
    return arg ? Number(arg.split('=')[1]) || 8000 : 8000;
})();

function normalizeText(value) {
    return String(value || '').trim();
}

// ==== PARSE ================================================================

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
        const numMatch = sec.label.match(/Condicionante\s+([\d\.,]+|\S+)/i);
        const numero = numMatch ? numMatch[1].replace(/,$/, '') : '';
        const isNotePlaceholder = sec.label === 'Condicionante'
            && /^(LO sem condicionante|Condicionante em Parecer T[eé]cnico|Texto da condicionante n[aã]o extra[ií]do)/i.test(text);
        if (isNotePlaceholder) {
            out.note = text;
            continue;
        }
        const fallback = /^Trecho/i.test(sec.label);
        out.conditions.push({ numero: numero || (fallback ? 'fallback' : 'sem-numero'), texto: text, fallback });
    }

    return out;
}

function extractParecerRef(text) {
    if (!text) return '';
    const m = String(text).match(/Parecer\s+T[eé]cnico\s*(?:n[º°o\.]?:?\s*)?([\d\.\/\-]+)/i);
    return m ? m[1] : '';
}

// ==== SANITIZE =============================================================

function sanitizeNumero(raw) {
    // Aceita "2.1", "2.1.1", "IN050654", "1056/2023". Remove lixo no fim.
    const normalized = String(raw || '').trim()
        .replace(/[,;\s]+$/g, '')           // virgula/espaco final
        .replace(/\s+/g, '')                // sem espaco interno
        .slice(0, 32);                      // cap em 32 chars
    return normalized;
}

function sanitizeTexto(raw, maxChars = MAX_CHARS) {
    let t = String(raw || '');
    t = t.replace(/\u0000/g, '');                             // NUL bytes
    t = t.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // controle
    t = t.replace(/\s+/g, ' ').trim();                        // whitespace
    if (t.length > maxChars) t = `${t.slice(0, maxChars)}... [truncado]`;
    return t;
}

function sanitizeConditions(raw) {
    const out = [];
    const reasons = [];
    const seenNumeros = new Map();  // numero normalizado -> index em out

    (Array.isArray(raw) ? raw : []).forEach((cond, idx) => {
        const numero = sanitizeNumero(cond?.numero);
        const texto = sanitizeTexto(cond?.texto);

        if (!numero) {
            reasons.push({ idx, reason: 'numero-vazio', raw: cond?.numero });
            return;
        }
        if (!texto || texto.length < 20) {
            reasons.push({ idx, reason: 'texto-muito-curto', raw: (cond?.texto || '').slice(0, 50), numero });
            return;
        }

        if (seenNumeros.has(numero)) {
            // deduplica: mantem o mais longo
            const existingIdx = seenNumeros.get(numero);
            if (texto.length > out[existingIdx].texto.length) {
                out[existingIdx] = { ...out[existingIdx], texto };
                reasons.push({ idx, reason: 'substituido-texto-mais-longo', numero });
            } else {
                reasons.push({ idx, reason: 'duplicata-descartada', numero });
            }
            return;
        }

        const entry = {
            numero,
            texto,
            tipo: classifyTipo(texto),
            fallback: Boolean(cond?.fallback),
            parecerRef: extractParecerRef(texto),
        };
        seenNumeros.set(numero, out.length);
        out.push(entry);
    });

    return { conditions: out, reasons };
}

// ==== APPLY ================================================================

function formatRowsForPrint(licenseId, conditions) {
    return conditions.map((c, i) => ({
        id: buildConditionId(licenseId, c.numero, i),
        tipo: c.tipo,
        numero: c.numero,
        ordem: i,
        chars: c.texto.length,
        parecerRef: c.parecerRef || '',
        preview: c.texto.slice(0, 120).replace(/\s+/g, ' '),
    }));
}

async function main() {
    const all = await operatingLicenseRepository.list();
    const filtered = ONLY ? all.filter((l) => l.id === ONLY) : all;
    const target = LIMIT > 0 ? filtered.slice(0, LIMIT) : filtered;

    console.log(`[migrate-observacoes-to-conditions]`);
    console.log(`  modo: ${APPLY ? 'APPLY (grava)' : 'DRY-RUN (nao grava)'}`);
    console.log(`  LOs alvo: ${target.length} (total no banco: ${all.length}${ONLY ? `, filtro=${ONLY}` : ''})`);
    console.log('');

    const summary = {
        processadas: 0,
        comCondicionantes: 0,
        semCondicionantes: 0,
        comNota: 0,
        totalCondicionantesGravadas: 0,
        totalRejeitadas: 0,
        errosDeGravacao: [],
    };

    for (const lic of target) {
        summary.processadas++;
        const licenseId = lic.id;
        const obs = String(lic.observacoes || '');
        const parsed = parseObservacoes(obs);
        const sanitized = sanitizeConditions(parsed.conditions);

        const conditionsToSave = sanitized.conditions.map((c, idx) => ({
            id: buildConditionId(licenseId, c.numero, idx),
            licenseId,
            numero: c.numero,
            texto: c.texto,
            tipo: c.tipo,
            ordem: idx,
            parecerTecnicoRef: c.parecerRef || '',
            payload: c.fallback ? { fonteExtracao: 'fallback-trecho-erosivo' } : {},
        }));

        if (conditionsToSave.length === 0 && !parsed.note) {
            summary.semCondicionantes++;
            if (VERBOSE) console.log(`[-] ${licenseId} :: sem blocos parseaveis`);
            continue;
        }

        if (conditionsToSave.length > 0) summary.comCondicionantes++;
        if (parsed.note) summary.comNota++;
        summary.totalRejeitadas += sanitized.reasons.length;

        console.log(`[${summary.processadas}/${target.length}] ${licenseId}`);
        if (parsed.note) console.log(`  nota: ${parsed.note.slice(0, 120)}${parsed.note.length > 120 ? '...' : ''}`);
        if (sanitized.reasons.length > 0) {
            for (const r of sanitized.reasons) {
                console.log(`  rejeitado[${r.idx}]: ${r.reason}${r.numero ? ` numero=${r.numero}` : ''}${r.raw ? ` raw="${String(r.raw).slice(0, 40)}..."` : ''}`);
            }
        }
        const rows = formatRowsForPrint(licenseId, sanitized.conditions);
        for (const r of rows) {
            console.log(`  + ${r.id} [${r.tipo}] numero=${r.numero} chars=${r.chars}${r.parecerRef ? ` pt=${r.parecerRef}` : ''}`);
            if (VERBOSE) console.log(`       "${r.preview}"`);
        }

        if (APPLY) {
            try {
                await licenseConditionRepository.bulkReplace(licenseId, conditionsToSave, { updatedBy: 'migration:0015' });
                summary.totalCondicionantesGravadas += conditionsToSave.length;

                // Limpa observacoes deixando so header + nota (se houver)
                const headerPart = parsed.header.join('\n').trim();
                const notePart = parsed.note ? `\n\n[Condicionante] ${parsed.note}` : '';
                const newObs = `${headerPart}${notePart}`.trim();
                const updated = { ...lic, observacoes: newObs };
                await operatingLicenseRepository.save(updated, { merge: true });
            } catch (err) {
                summary.errosDeGravacao.push({ licenseId, message: err?.message || String(err) });
                console.log(`  ERRO ao gravar: ${err?.message || err}`);
            }
        }
    }

    console.log('');
    console.log('=== Resumo ===');
    console.log(`  LOs processadas:                 ${summary.processadas}`);
    console.log(`  LOs com >=1 condicionante:       ${summary.comCondicionantes}`);
    console.log(`  LOs com nota (sem cond. parse):  ${summary.comNota}`);
    console.log(`  LOs sem blocos parseaveis:       ${summary.semCondicionantes}`);
    console.log(`  Itens rejeitados na sanitizacao: ${summary.totalRejeitadas}`);
    if (APPLY) {
        console.log(`  Condicionantes gravadas:         ${summary.totalCondicionantesGravadas}`);
        if (summary.errosDeGravacao.length > 0) {
            console.log(`  Erros de gravacao:               ${summary.errosDeGravacao.length}`);
            for (const e of summary.errosDeGravacao) console.log(`    - ${e.licenseId}: ${e.message}`);
        }
        console.log('\nDONE.');
    } else {
        console.log('\n(dry-run — rode novamente com --apply para persistir)');
    }
}

main().then(() => process.exit(0)).catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
});
