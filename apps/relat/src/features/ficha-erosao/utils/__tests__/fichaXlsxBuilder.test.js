import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';

import {
  buildFichaXlsx,
  buildFichaFileName,
  montarLinhas,
  CRITICIDADE_SOLUCOES,
  NUM_COLUNAS,
  NUM_LINHAS,
} from '../fichaXlsxBuilder';

// jsdom nao implementa Blob.arrayBuffer(); lemos via FileReader.
function blobToBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function unzipBlob(blob) {
  return unzipSync(await blobToBytes(blob));
}

async function sheetXml(dados) {
  const zip = await unzipBlob(buildFichaXlsx(dados));
  return strFromU8(zip['xl/worksheets/sheet1.xml']);
}

/** Texto da celula na linha/coluna informadas (1-based / letra). */
function celula(xml, ref) {
  const match = xml.match(new RegExp(`<c r="${ref}"[^>]*>(?:<is><t[^>]*>([^<]*)</t></is>)?`));
  return match ? (match[1] ?? '') : null;
}

const DADOS_COMPLETOS = {
  empreendimento: '230 kV Exemplo',
  ficha_num: '042',
  data: '26/08/2026',
  profissional: 'Equipe de Geotecnia',
  utm_e: '654321',
  utm_fuso: '23K',
  utm_s: '7123456',
  altitude: '540 m',
  fotos: '01, 02',
  referencia: 'Vao entre torres 30 e 31',
  tipo_area: 'faixa_servidao',
  criticidade: 'C3',
  estagio: 'ativo',
  feicoes: ['sulco', 'ravina'],
  presenca_agua: 'nao',
  declividade: '12_20',
  largura: '1_10',
  altura: 'ate_1',
  relevo: 'ondulado',
  tipo_solo: 'arenoso',
  usos_solo: ['pastagem', 'campo'],
  obstaculos: ['acesso', 'cerca'],
  outros: 'Cerca a 5 m da borda',
  medida_preventiva: 'Reconformacao imediata',
};

describe('montarLinhas', () => {
  it('monta as 31 linhas do template', () => {
    expect(montarLinhas(DADOS_COMPLETOS)).toHaveLength(NUM_LINHAS);
  });

  it('usa o texto padrao da criticidade quando a medida preventiva fica vazia', () => {
    const linhas = montarLinhas({ criticidade: 'C3' });
    expect(linhas[28].valores[0]).toBe(`MEDIDA PREVENTIVA: ${CRITICIDADE_SOLUCOES.C3}`);
  });

  it('preserva a medida preventiva informada', () => {
    const linhas = montarLinhas({ criticidade: 'C3', medida_preventiva: 'Texto proprio' });
    expect(linhas[28].valores[0]).toBe('MEDIDA PREVENTIVA: Texto proprio');
  });

  it('anexa o fuso ao UTM E somente quando ambos existem', () => {
    expect(montarLinhas({ utm_e: '123', utm_fuso: '23K' }).valores?.[0]).toBeUndefined();
    expect(montarLinhas({ utm_e: '123', utm_fuso: '23K' })[5].valores[0]).toBe('UTM E: 123 (Fuso 23K)');
    expect(montarLinhas({ utm_e: '123' })[5].valores[0]).toBe('UTM E: 123');
    expect(montarLinhas({ utm_fuso: '23K' })[5].valores[0]).toBe('UTM E:');
  });

  it('preenche a data de hoje quando nao informada', () => {
    const linhas = montarLinhas({});
    expect(linhas[2].valores[9]).toMatch(/^Data: \d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('buildFichaXlsx', () => {
  it('gera um pacote xlsx com as partes obrigatorias', async () => {
    const zip = await unzipBlob(buildFichaXlsx(DADOS_COMPLETOS));
    expect(Object.keys(zip).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('marca os checkboxes escolhidos nas colunas do template', async () => {
    const xml = await sheetXml(DADOS_COMPLETOS);
    expect(celula(xml, 'A8')).toBe('( X ) Faixa de Servidão'); // area
    expect(celula(xml, 'G11')).toBe('( X ) Alto'); // criticidade C3 -> col 6
    expect(celula(xml, 'C13')).toBe('( X ) Ativo'); // estagio
    expect(celula(xml, 'C15')).toBe('( X ) Sulco'); // feicao multipla
    expect(celula(xml, 'G15')).toBe('( X ) Ravina');
    expect(celula(xml, 'H16')).toBe('( X ) Não'); // presenca de agua -> col 7
    expect(celula(xml, 'G18')).toBe('( X ) 12º à 20º'); // declividade
    expect(celula(xml, 'B25')).toBe('( X ) Pastagem'); // uso do solo -> col 1
    expect(celula(xml, 'I25')).toBe('( X ) Campo'); // uso do solo -> col 8
    expect(celula(xml, 'F27')).toBe('( X ) Cerca'); // obstaculo -> col 5
  });

  it('deixa desmarcado o que nao foi escolhido', async () => {
    const xml = await sheetXml(DADOS_COMPLETOS);
    expect(celula(xml, 'A11')).toBe('(   ) Baixo');
    expect(celula(xml, 'K13')).toBe('(   ) Regeneração Natural');
    expect(celula(xml, 'A15')).toBe('(   ) Laminar');
  });

  it('gera ficha em branco sem marcar nada, mantendo os rotulos', async () => {
    const xml = await sheetXml({});
    expect(xml).not.toContain('( X )');
    expect(celula(xml, 'A1')).toBe('EMPREENDIMENTO: LT');
    expect(celula(xml, 'A3')).toBe('Ficha nº');
    expect(celula(xml, 'A29')).toBe('MEDIDA PREVENTIVA:');
    expect(celula(xml, 'A30')).toBe('OBSERVAÇÕES - CROQUIS');
  });

  it('mescla as celulas conforme os gridSpans do template', async () => {
    const xml = await sheetXml(DADOS_COMPLETOS);
    expect(xml).toContain('<mergeCell ref="A1:L1"/>'); // faixa de titulo
    expect(xml).toContain('<mergeCell ref="A3:I3"/>'); // Ficha n
    expect(xml).toContain('<mergeCell ref="J3:L3"/>'); // Data
    expect(xml).toContain('<mergeCell ref="A8:C8"/>'); // area: 3 + 6 + 3
    expect(xml).toContain('<mergeCell ref="D8:I8"/>');
    expect(xml).toContain('<mergeCell ref="J8:L8"/>');
    expect(xml).toContain('<mergeCell ref="A16:D16"/>'); // presenca de agua: 4 + 3 + 4 + 1
    expect(xml).toContain('<mergeCell ref="E16:G16"/>');
    expect(xml).toContain('<mergeCell ref="H16:K16"/>');
  });

  it('configura a impressao em uma pagina A4 retrato', async () => {
    const xml = await sheetXml(DADOS_COMPLETOS);
    expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(xml).toContain('paperSize="9"');
    expect(xml).toContain('orientation="portrait"');
    expect(xml).toContain('fitToWidth="1"');
    expect(xml).toContain('fitToHeight="1"');

    const zip = await unzipBlob(buildFichaXlsx(DADOS_COMPLETOS));
    expect(strFromU8(zip['xl/workbook.xml'])).toContain('Ficha!$A$1:$L$31');
  });

  it('estiliza todas as 12 colunas de cada linha (borda nas celulas mescladas)', async () => {
    const xml = await sheetXml(DADOS_COMPLETOS);
    const linha1 = xml.match(/<row r="1"[^>]*>.*?<\/row>/)[0];
    expect(linha1.match(/<c r="[A-L]1"/g)).toHaveLength(NUM_COLUNAS);
  });

  it('escapa caracteres especiais de XML', async () => {
    const xml = await sheetXml({ empreendimento: '<A & B> "teste"' });
    expect(xml).toContain('EMPREENDIMENTO: LT &lt;A &amp; B&gt; &quot;teste&quot;');
  });
});

describe('buildFichaFileName', () => {
  it('usa o numero da ficha', () => {
    expect(buildFichaFileName({ ficha_num: '042' })).toBe('ficha-erosao-042.xlsx');
  });

  it('cai para a data e sanitiza separadores', () => {
    expect(buildFichaFileName({ data: '26/08/2026' })).toBe('ficha-erosao-26-08-2026.xlsx');
  });

  it('tem um nome padrao quando nao ha identificacao', () => {
    expect(buildFichaFileName({})).toBe('ficha-erosao.xlsx');
  });
});
