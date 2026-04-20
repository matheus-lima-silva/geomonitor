// Guard em camadas para o console SQL administrativo.
// A primeira linha de defesa e este parser; a segunda e uma transacao
// READ ONLY com statement_timeout no router. Mesmo que algo escape daqui,
// o Postgres recusa a escrita.

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'GRANT', 'REVOKE', 'VACUUM', 'COPY', 'CALL', 'DO',
    'MERGE', 'REINDEX', 'CLUSTER', 'LOCK', 'COMMENT', 'SECURITY',
];

const ALLOWED_FIRST_TOKENS = new Set(['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'VALUES', 'TABLE']);

function stripCommentsAndStrings(sql) {
    // Remove comentarios de linha (-- ...) e blocos (/* ... */) e substitui
    // literais string ('...') por placeholder para evitar falsos positivos
    // em palavras como 'delete' dentro de literais.
    let out = '';
    let i = 0;
    const len = sql.length;
    while (i < len) {
        const c = sql[i];
        const next = sql[i + 1];

        // -- line comment
        if (c === '-' && next === '-') {
            while (i < len && sql[i] !== '\n') i++;
            continue;
        }

        // /* block comment */
        if (c === '/' && next === '*') {
            i += 2;
            while (i < len && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        // single-quoted string literal (com escape '' duplicado)
        if (c === "'") {
            out += "''"; // preserva o quoting sem o conteudo
            i++;
            while (i < len) {
                if (sql[i] === "'" && sql[i + 1] === "'") {
                    i += 2;
                    continue;
                }
                if (sql[i] === "'") {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        // dollar-quoted $$ ... $$ (e tag variants) — conservador: rejeita
        if (c === '$' && /[A-Za-z_$0-9]*\$/.test(sql.slice(i))) {
            // Deixa o dolar-quote passar como caractere normal; rejeicao
            // por multi-statement/keywords proibidas vai pegar funcoes.
            out += c;
            i++;
            continue;
        }

        // double-quoted identifier — mantem (faz parte do identificador)
        if (c === '"') {
            out += c;
            i++;
            while (i < len && sql[i] !== '"') {
                out += sql[i];
                i++;
            }
            if (i < len) {
                out += sql[i];
                i++;
            }
            continue;
        }

        out += c;
        i++;
    }
    return out;
}

function firstSignificantToken(sqlSanitized) {
    const match = sqlSanitized.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1].toUpperCase() : '';
}

function hasMultipleStatements(sqlSanitized) {
    // Aceita ponto e virgula final unico; rejeita qualquer `;` seguido de
    // conteudo nao-vazio.
    const trimmed = sqlSanitized.trim();
    const withoutTrailing = trimmed.replace(/;+\s*$/, '');
    return withoutTrailing.includes(';');
}

function containsForbiddenKeyword(sqlSanitized) {
    const upper = sqlSanitized.toUpperCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const re = new RegExp(`(^|[^A-Z0-9_])${keyword}([^A-Z0-9_]|$)`);
        if (re.test(upper)) return keyword;
    }
    return null;
}

/**
 * Retorna { ok: true } se o SQL aparenta ser somente leitura; caso contrario
 * { ok: false, reason }.
 */
function isReadOnlySql(sql) {
    if (typeof sql !== 'string' || !sql.trim()) {
        return { ok: false, reason: 'SQL vazio.' };
    }

    const sanitized = stripCommentsAndStrings(sql);
    if (!sanitized.trim()) {
        return { ok: false, reason: 'SQL vazio apos remocao de comentarios.' };
    }

    if (hasMultipleStatements(sanitized)) {
        return { ok: false, reason: 'Multiplos statements nao sao permitidos.' };
    }

    const firstToken = firstSignificantToken(sanitized);
    if (!ALLOWED_FIRST_TOKENS.has(firstToken)) {
        return {
            ok: false,
            reason: `Primeiro comando "${firstToken || '<vazio>'}" nao permitido. Use SELECT, WITH, EXPLAIN ou SHOW.`,
        };
    }

    const forbidden = containsForbiddenKeyword(sanitized);
    if (forbidden) {
        return { ok: false, reason: `Palavra-chave proibida: ${forbidden}.` };
    }

    return { ok: true };
}

module.exports = {
    isReadOnlySql,
    FORBIDDEN_KEYWORDS,
    ALLOWED_FIRST_TOKENS,
};
