import { describe, expect, it } from 'vitest';
import { parseCaptionsFile } from '../captionsIO';

// Replica o formato emitido por handleExportCaptions em ReportsView.jsx
function buildCsvFromRows(rows) {
  const header = 'ID,Torre,Legenda,No Relatorio';
  const body = rows
    .map((r) => `"${r.id}","${r.tower}","${(r.caption || '').replace(/"/g, '""')}",${r.included}`)
    .join('\n');
  return `${header}\n${body}`;
}

function buildMarkdownFromRows(rows) {
  const header = '| ID | Torre | Legenda | No Relatorio |\n|---|---|---|---|';
  const body = rows
    .map((r) => `| ${r.id} | ${r.tower} | ${r.caption} | ${r.included ? 'Sim' : 'Nao'} |`)
    .join('\n');
  return `${header}\n${body}`;
}

describe('parseCaptionsFile — CSV', () => {
  it('parseia o output literal de handleExportCaptions(csv)', () => {
    const text = buildCsvFromRows([
      { id: 'p1', tower: 'T1', caption: 'Inicio da linha', included: true },
      { id: 'p2', tower: 'T2', caption: 'Meio', included: false },
      { id: 'p3', tower: '', caption: 'Sem torre', included: true },
    ]);
    const { rows, format, warnings } = parseCaptionsFile(text, 'workspace-legendas.csv');
    expect(format).toBe('csv');
    expect(warnings).toEqual([]);
    expect(rows).toEqual([
      { id: 'p1', caption: 'Inicio da linha' },
      { id: 'p2', caption: 'Meio' },
      { id: 'p3', caption: 'Sem torre' },
    ]);
  });

  it('respeita aspas escapadas (escape duplo "")', () => {
    const text = buildCsvFromRows([
      { id: 'p1', tower: 'T1', caption: 'Texto com "aspas" no meio', included: true },
    ]);
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p1', caption: 'Texto com "aspas" no meio' }]);
  });

  it('preserva virgula dentro de campos entre aspas', () => {
    const text = 'ID,Torre,Legenda,No Relatorio\n"p1","T1","a, b, c",true';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p1', caption: 'a, b, c' }]);
  });

  it('preserva quebra de linha dentro de campos entre aspas', () => {
    const text = 'ID,Torre,Legenda,No Relatorio\n"p1","T1","linha1\nlinha2",true';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p1', caption: 'linha1\nlinha2' }]);
  });

  it('aceita colunas em ordem diferente', () => {
    const text = 'Legenda,ID,Torre\n"minha legenda","p1","T1"';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p1', caption: 'minha legenda' }]);
  });

  it('cabecalho case-insensitive', () => {
    const text = 'id,torre,legenda,no relatorio\np1,T1,foo,true';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p1', caption: 'foo' }]);
  });

  it('retorna warning quando falta coluna ID', () => {
    const text = 'Torre,Legenda\nT1,foo';
    const { rows, warnings } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([]);
    expect(warnings.join(' ')).toMatch(/ID/);
  });

  it('retorna warning quando falta coluna Legenda', () => {
    const text = 'ID,Torre\np1,T1';
    const { rows, warnings } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([]);
    expect(warnings.join(' ')).toMatch(/Legenda/);
  });

  it('aceita CRLF (arquivo salvo no Windows)', () => {
    const text = 'ID,Torre,Legenda,No Relatorio\r\n"p1","T1","foo",true\r\n"p2","T2","bar",false\r\n';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([
      { id: 'p1', caption: 'foo' },
      { id: 'p2', caption: 'bar' },
    ]);
  });

  it('arquivo vazio nao quebra', () => {
    const { rows } = parseCaptionsFile('', 'x.csv');
    expect(rows).toEqual([]);
  });

  it('so whitespace nao quebra', () => {
    const { rows } = parseCaptionsFile('   \n   \n', 'x.csv');
    expect(rows).toEqual([]);
  });

  it('ignora linha sem ID', () => {
    const text = 'ID,Legenda\n"","foo"\n"p2","bar"';
    const { rows } = parseCaptionsFile(text, 'x.csv');
    expect(rows).toEqual([{ id: 'p2', caption: 'bar' }]);
  });
});

describe('parseCaptionsFile — Markdown', () => {
  it('parseia o output literal de handleExportCaptions(md)', () => {
    const text = buildMarkdownFromRows([
      { id: 'p1', tower: 'T1', caption: 'Inicio', included: true },
      { id: 'p2', tower: 'T2', caption: 'Meio', included: false },
      { id: 'p3', tower: '', caption: 'Sem torre', included: true },
    ]);
    const { rows, format, warnings } = parseCaptionsFile(text, 'workspace-legendas.md');
    expect(format).toBe('markdown');
    expect(warnings).toEqual([]);
    expect(rows).toEqual([
      { id: 'p1', caption: 'Inicio' },
      { id: 'p2', caption: 'Meio' },
      { id: 'p3', caption: 'Sem torre' },
    ]);
  });

  it('faz trim de espacos extras dentro das celulas', () => {
    const text = '| ID | Legenda |\n|---|---|\n|    p1    |     com espacos    |';
    const { rows } = parseCaptionsFile(text, 'x.md');
    expect(rows).toEqual([{ id: 'p1', caption: 'com espacos' }]);
  });

  it('respeita pipe escapado \\| dentro de legenda', () => {
    const text = '| ID | Legenda |\n|---|---|\n| p1 | a \\| b |';
    const { rows } = parseCaptionsFile(text, 'x.md');
    expect(rows).toEqual([{ id: 'p1', caption: 'a | b' }]);
  });

  it('ignora a linha separadora |---|---|', () => {
    const text = '| ID | Legenda |\n|---|---|\n| p1 | foo |';
    const { rows } = parseCaptionsFile(text, 'x.md');
    expect(rows.length).toBe(1);
  });

  it('retorna warning quando falta coluna ID', () => {
    const text = '| Torre | Legenda |\n|---|---|\n| T1 | foo |';
    const { rows, warnings } = parseCaptionsFile(text, 'x.md');
    expect(rows).toEqual([]);
    expect(warnings.join(' ')).toMatch(/ID/);
  });
});

describe('parseCaptionsFile — auto deteccao de formato', () => {
  it('usa extensao .md mesmo sem conteudo de tabela', () => {
    const text = '| ID | Legenda |\n|---|---|\n| p1 | foo |';
    expect(parseCaptionsFile(text, 'x.md').format).toBe('markdown');
  });

  it('detecta markdown pelo conteudo quando extensao nao ajuda', () => {
    const text = '| ID | Legenda |\n|---|---|\n| p1 | foo |';
    expect(parseCaptionsFile(text, 'x.txt').format).toBe('markdown');
  });

  it('detecta csv por default', () => {
    const text = 'ID,Legenda\np1,foo';
    expect(parseCaptionsFile(text, 'x.txt').format).toBe('csv');
  });

  it('respeita extensao .csv mesmo se conteudo parece markdown', () => {
    // Conteudo comecando com | mas arquivo marcado como csv -> prioriza extensao
    const text = '| ID | Legenda |\n|---|---|\n| p1 | foo |';
    expect(parseCaptionsFile(text, 'x.csv').format).toBe('csv');
  });
});

describe('parseCaptionsFile — round trip export ↔ import', () => {
  const originalRows = [
    { id: 'photo-aaa-111', tower: 'T-01', caption: 'Detalhe com "aspas" e, virgula', included: true },
    { id: 'photo-bbb-222', tower: '', caption: 'Sem torre\nquebra de linha', included: false },
    { id: 'photo-ccc-333', tower: 'T-02', caption: 'Simples', included: true },
  ];

  it('CSV: export gera texto que o parser reconstroi identico', () => {
    const csv = buildCsvFromRows(originalRows);
    const { rows } = parseCaptionsFile(csv, 'rt.csv');
    expect(rows).toEqual(originalRows.map((r) => ({ id: r.id, caption: r.caption })));
  });

  it('Markdown: export gera texto que o parser reconstroi identico (sem newline nas legendas)', () => {
    // Markdown table nao suporta \n dentro de celula; filtramos para um caso realista.
    const mdRows = originalRows.filter((r) => !r.caption.includes('\n'));
    const md = buildMarkdownFromRows(mdRows);
    const { rows } = parseCaptionsFile(md, 'rt.md');
    expect(rows).toEqual(mdRows.map((r) => ({ id: r.id, caption: r.caption })));
  });
});
