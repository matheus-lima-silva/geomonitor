// Parser simetrico ao handleExportCaptions em ReportsView.jsx.
// Aceita CSV e tabela Markdown, extrai apenas { id, caption } de cada linha.
// Outras colunas (Torre, No Relatorio) sao ignoradas por design: a importacao
// so aplica o campo legenda para evitar mudanca nao intencional de towerSource.

const ID_HEADERS = new Set(['id', 'photoid', 'photo_id']);
const CAPTION_HEADERS = new Set(['legenda', 'caption', 'captions']);

function normalizeHeader(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

function detectFormat(text, fileName) {
  const ext = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv') return 'csv';
  const firstNonEmpty = String(text || '').split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  if (firstNonEmpty.trim().startsWith('|')) return 'markdown';
  return 'csv';
}

// RFC-4180-ish CSV parser que suporta campos entre aspas, aspas escapadas ""
// e quebras de linha dentro de campos entre aspas.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const src = String(text || '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\r') {
      // normaliza CRLF: ignora o \r, o \n subsequente fecha a linha
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  // ultimo campo / ultima linha
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // remove linhas totalmente vazias
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function parseCsvRows(text) {
  const warnings = [];
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { rows: [], warnings };

  const [headerRow, ...dataRows] = matrix;
  const headers = headerRow.map(normalizeHeader);
  const idIdx = headers.findIndex((h) => ID_HEADERS.has(h));
  const captionIdx = headers.findIndex((h) => CAPTION_HEADERS.has(h));

  if (idIdx === -1) {
    warnings.push('Coluna "ID" nao encontrada no cabecalho do CSV.');
    return { rows: [], warnings };
  }
  if (captionIdx === -1) {
    warnings.push('Coluna "Legenda" nao encontrada no cabecalho do CSV.');
    return { rows: [], warnings };
  }

  const rows = [];
  for (const dataRow of dataRows) {
    const id = String(dataRow[idIdx] ?? '').trim();
    if (!id) continue;
    const caption = String(dataRow[captionIdx] ?? '');
    rows.push({ id, caption });
  }
  return { rows, warnings };
}

// Tabela Markdown no formato emitido pelo export:
//   | ID | Torre | Legenda | No Relatorio |
//   |---|---|---|---|
//   | abc | T1 | texto | Sim |
function parseMarkdownRows(text) {
  const warnings = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.startsWith('|'));
  if (lines.length === 0) return { rows: [], warnings };

  function splitRow(line) {
    // divide por | que nao seja precedido de \ (pipe escapado)
    // depois remove as celulas-borda vazias e faz unescape de \|
    const parts = [];
    let cur = '';
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '\\' && line[i + 1] === '|') {
        cur += '|';
        i += 1;
        continue;
      }
      if (ch === '|') {
        parts.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    // Remover primeira e ultima celulas se vazias (bordas do pipe table)
    if (parts.length > 0 && parts[0].trim() === '') parts.shift();
    if (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.map((p) => p.trim());
  }

  const headerCells = splitRow(lines[0]).map(normalizeHeader);
  const idIdx = headerCells.findIndex((h) => ID_HEADERS.has(h));
  const captionIdx = headerCells.findIndex((h) => CAPTION_HEADERS.has(h));

  if (idIdx === -1) {
    warnings.push('Coluna "ID" nao encontrada no cabecalho do Markdown.');
    return { rows: [], warnings };
  }
  if (captionIdx === -1) {
    warnings.push('Coluna "Legenda" nao encontrada no cabecalho do Markdown.');
    return { rows: [], warnings };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    // linha separadora "|---|---|"
    if (/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line)) continue;
    const cells = splitRow(line);
    const id = String(cells[idIdx] ?? '').trim();
    if (!id) continue;
    const caption = String(cells[captionIdx] ?? '');
    rows.push({ id, caption });
  }
  return { rows, warnings };
}

export function parseCaptionsFile(text, fileName = '') {
  const format = detectFormat(text, fileName);
  const parsed = format === 'markdown' ? parseMarkdownRows(text) : parseCsvRows(text);
  return { rows: parsed.rows, format, warnings: parsed.warnings };
}
