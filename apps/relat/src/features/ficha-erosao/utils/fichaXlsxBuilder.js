/**
 * Monta a "Ficha Simplificada de Cadastro de Focos Erosivos" em .xlsx, 100% no
 * navegador.
 *
 * Espelha o layout da ficha do worker (`worker/assets/template_ficha_cadastro_erosao.docx`
 * e `worker/ficha_cadastro_renderer.py`): mesma tabela de 31 linhas x 12 colunas,
 * mesmas faixas de secao sombreadas e a mesma convencao de checkbox "( X )".
 * Diferencas de escopo (ferramenta standalone, ficha avulsa):
 *   - os dados vem do formulario, nao de uma erosao persistida no banco;
 *   - o estagio erosivo e a declividade sao escolhidos direto (o renderer do
 *     worker os deriva de sinaisAvanco/vegetacaoInterior e de graus porque o
 *     banco nao guarda o campo pronto);
 *   - nao insere fotos (o campo "Fotos:" e texto, igual ao DOCX).
 *
 * Zip via `fflate`, mesmo caminho do `kmzBuilder` do modulo Geo: nada e enviado
 * nem persistido — o arquivo nasce e morre no navegador.
 */
import { zipSync, strToU8 } from 'fflate';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const NUM_COLUNAS = 12;
export const NUM_LINHAS = 31;

// Larguras em cm da tabela original (total 18,49 cm).
const LARGURAS_CM = [3.74, 0.9, 1.93, 0.62, 0.28, 1.89, 1.68, 0.18, 1.54, 1.32, 0.85, 3.57];

const ALTURA_PADRAO = 18; // pt
const ALTURA_MEDIDA = 32; // pt — linha "MEDIDA PREVENTIVA"
const ALTURA_CROQUI = 190; // pt (~6,7 cm)

// Indices dos estilos declarados em styles.xml (ordem do <cellXfs>).
const ESTILO_DADOS = 1;
const ESTILO_DADOS_WRAP = 2;
const ESTILO_TITULO = 3; // fundo BFBFBF
const ESTILO_SECAO = 4; // fundo D9D9D9

// Textos de medida preventiva por grau de criticidade. Espelha
// CRITICIDADE_SOLUCOES de `worker/ficha_cadastro_renderer.py`.
export const CRITICIDADE_SOLUCOES = {
  C1: 'Cobertura vegetal (gramineas, ressemeadura); Curvas de nivel, plantio em faixas; '
    + 'Mulching / palhada / biomanta leve',
  C2: 'Barraginhas e pequenos terracos; Sangradouros laterais / lombadas de agua; '
    + 'Canaletas vegetadas / valetas rasas; Hidrossemeadura + biomantas leves',
  C3: 'Reconformacao de taludes; Sarjetas de crista / canaletas revestidas; '
    + 'Escadas hidraulicas / bacias de dissipacao; Check dams (degraus com pedra/gabioes)',
  C4: 'Rede completa de drenagem da bacia; Drenos profundos para piping; '
    + 'Diques de terra / barragens; Estruturas de contencao (muros, gabioes); PRAD especifico',
};

// Coluna (0-based) de cada opcao dentro da sua linha. Espelha os *_MAP do renderer.
const AREA_MAP = { faixa_servidao: 0, area_terceiros: 3, area_publica: 9 };
const CRITICIDADE_MAP = { C1: 0, C2: 2, C3: 6, C4: 10 };
const ESTAGIO_MAP = { ativo: 2, estavel: 6, regeneracao: 10 };
const FEICAO_MAP = { laminar: 0, sulco: 2, ravina: 6, vocoroca: 10 };
const PRESENCA_AGUA_MAP = { sim: 4, nao: 7, nao_verificado: 11 };
const DECLIVIDADE_MAP = { '0_6': 0, '6_12': 2, '12_20': 6, maior_20: 10 };
const DIMENSAO_MAP = { ate_1: 2, '1_10': 6, maior_30: 10 };
const RELEVO_MAP = { suave: 2, ondulado: 6, escarpado: 10 };
const TIPO_SOLO_MAP = { argiloso: 2, arenoso: 6, lateritico: 10 };
const USOS_SOLO_MAP = { pastagem: 1, cultivo: 5, campo: 8, veg_arborea: 11 };
const OBSTACULOS_MAP = { acesso: 1, cerca: 5, curso_agua: 8, tubulacao: 11 };

export const ROTULOS = {
  area: {
    faixa_servidao: 'Faixa de Servidão',
    area_terceiros: 'Área de Terceiros',
    area_publica: 'Área Pública',
  },
  criticidade: { C1: 'Baixo', C2: 'Médio', C3: 'Alto', C4: 'Muito Alto' },
  estagio: { ativo: 'Ativo', estavel: 'Estável', regeneracao: 'Regeneração Natural' },
  feicao: { laminar: 'Laminar', sulco: 'Sulco', ravina: 'Ravina', vocoroca: 'Voçoroca' },
  presenca_agua: { sim: 'Sim', nao: 'Não', nao_verificado: 'Não verificado' },
  declividade: {
    '0_6': '0º à 6º', '6_12': '6º à 12º', '12_20': '12º à 20º', maior_20: '> 20º',
  },
  dimensao: { ate_1: 'Até 1 metro', '1_10': '1 a 10 metros', maior_30: 'Maior que 30 metros' },
  relevo: { suave: 'Suave', ondulado: 'Ondulado', escarpado: 'Escarpado' },
  tipo_solo: { argiloso: 'Argiloso', arenoso: 'Arenoso', lateritico: 'Laterítico' },
  usos_solo: {
    pastagem: 'Pastagem', cultivo: 'Cultivo', campo: 'Campo', veg_arborea: 'Veg. Arbórea',
  },
  obstaculos: {
    acesso: 'Acesso', cerca: 'Cerca', curso_agua: "Curso d'água", tubulacao: 'Tubulação',
  },
};

// ---------------------------------------------------------------- helpers

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function lista(valor) {
  if (!valor) return [];
  return Array.isArray(valor) ? valor.map(String) : [String(valor)];
}

function checkbox(rotulo, marcado) {
  return `( ${marcado ? 'X' : ' '} ) ${rotulo}`;
}

/** 'Label: valor' — mantem o label mesmo sem valor (ficha em branco). */
function rotulado(prefixo, valor) {
  return `${prefixo} ${valor}`.trimEnd();
}

/** Monta { coluna: textoDoCheckbox } para um grupo de opcoes. */
function opcoes(grupo, mapa, selecionados) {
  const marcados = new Set(lista(selecionados));
  return Object.fromEntries(
    Object.entries(mapa).map(([chave, col]) => [col, checkbox(ROTULOS[grupo][chave], marcados.has(chave))]),
  );
}

function escapeXml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Converte cm na unidade de largura de coluna do Excel (1 cm = 37,7953 px a 96 dpi). */
function larguraExcel(cm) {
  return Math.round(Math.max((cm * 37.7953 - 5) / 7, 0.5) * 100) / 100;
}

/** 0 -> A, 11 -> L */
function letraColuna(indiceZeroBased) {
  let n = indiceZeroBased;
  let letras = '';
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

function dataDeHoje() {
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, '0');
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${hoje.getFullYear()}`;
}

// ---------------------------------------------------------------- layout

/**
 * Monta a especificacao das 31 linhas da ficha.
 * Cada item: { merges: { colInicial: span }, valores: { col: texto }, estilo, altura }
 */
export function montarLinhas(dados = {}) {
  const criticidade = texto(dados.criticidade);

  let utmE = texto(dados.utm_e);
  const fuso = texto(dados.utm_fuso);
  if (utmE && fuso) utmE = `${utmE} (Fuso ${fuso})`;

  let medida = texto(dados.medida_preventiva);
  if (!medida && CRITICIDADE_SOLUCOES[criticidade]) medida = CRITICIDADE_SOLUCOES[criticidade];

  const dataFicha = texto(dados.data) || dataDeHoje();

  const secao = (t) => ({ merges: { 0: 12 }, valores: { 0: t }, estilo: ESTILO_SECAO });

  return [
    // R00 / R01 — cabecalho
    {
      merges: { 0: 12 },
      valores: { 0: rotulado('EMPREENDIMENTO: LT', texto(dados.empreendimento)) },
      estilo: ESTILO_TITULO,
    },
    { merges: { 0: 12 }, valores: { 0: 'CADASTRO DE FOCOS EROSIVOS' }, estilo: ESTILO_TITULO },
    // R02 / R03 — identificacao
    {
      merges: { 0: 9, 9: 3 },
      valores: { 0: rotulado('Ficha nº', texto(dados.ficha_num)), 9: rotulado('Data:', dataFicha) },
    },
    { merges: { 0: 12 }, valores: { 0: rotulado('Profissional:', texto(dados.profissional)) } },
    // R04–R08 — localizacao
    secao('LOCALIZAÇÃO'),
    {
      merges: { 0: 9, 9: 3 },
      valores: { 0: rotulado('UTM E:', utmE), 9: rotulado('Altitude:', texto(dados.altitude)) },
    },
    {
      merges: { 0: 9, 9: 3 },
      valores: { 0: rotulado('UTM S:', texto(dados.utm_s)), 9: rotulado('Fotos:', texto(dados.fotos)) },
    },
    { merges: { 0: 3, 3: 6, 9: 3 }, valores: opcoes('area', AREA_MAP, texto(dados.tipo_area)) },
    { merges: { 0: 12 }, valores: { 0: rotulado('Referência:', texto(dados.referencia)) } },
    // R09 / R10 — criticidade
    secao('CLASSIFICAÇÃO DE CRITICIDADE - GRAU EROSIVO'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: opcoes('criticidade', CRITICIDADE_MAP, criticidade),
    },
    // R11 / R12 — situacao atual
    secao('SITUAÇÃO ATUAL'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: { 0: 'Estágio Erosivo', ...opcoes('estagio', ESTAGIO_MAP, texto(dados.estagio)) },
    },
    // R13–R15 — feicao
    secao('TIPO / CARACTERÍSTICAS DA FEIÇÃO'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: opcoes('feicao', FEICAO_MAP, dados.feicoes),
    },
    {
      merges: { 0: 4, 4: 3, 7: 4, 11: 1 },
      valores: {
        0: 'Presença de água no fundo da feição:',
        ...opcoes('presenca_agua', PRESENCA_AGUA_MAP, texto(dados.presenca_agua)),
      },
    },
    // R16 / R17 — declividade
    secao('DECLIVIDADE'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: opcoes('declividade', DECLIVIDADE_MAP, texto(dados.declividade)),
    },
    // R18–R20 — dimensoes
    secao('DIMENSÕES'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: { 0: 'Largura Máxima:', ...opcoes('dimensao', DIMENSAO_MAP, texto(dados.largura)) },
    },
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: { 0: 'Altura Máxima:', ...opcoes('dimensao', DIMENSAO_MAP, texto(dados.altura)) },
    },
    // R21–R24 — caracterizacao
    secao('CARACTERIZAÇÃO'),
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: { 0: 'Relevo', ...opcoes('relevo', RELEVO_MAP, texto(dados.relevo)) },
    },
    {
      merges: { 0: 2, 2: 4, 6: 4, 10: 2 },
      valores: { 0: 'Tipo de Solo', ...opcoes('tipo_solo', TIPO_SOLO_MAP, texto(dados.tipo_solo)) },
    },
    {
      merges: {
        0: 1, 1: 4, 5: 3, 8: 3, 11: 1,
      },
      valores: { 0: 'Usos do Solo:', ...opcoes('usos_solo', USOS_SOLO_MAP, dados.usos_solo) },
    },
    // R25–R27 — obstaculos (a faixa repete "CARACTERIZAÇÃO" no template original)
    secao('CARACTERIZAÇÃO'),
    {
      merges: {
        0: 1, 1: 4, 5: 3, 8: 3, 11: 1,
      },
      valores: { 0: 'Obstáculos:', ...opcoes('obstaculos', OBSTACULOS_MAP, dados.obstaculos) },
    },
    { merges: { 0: 12 }, valores: { 0: rotulado('Outros:', texto(dados.outros)) } },
    // R28 — medida preventiva
    {
      merges: { 0: 12 },
      valores: { 0: rotulado('MEDIDA PREVENTIVA:', medida) },
      estilo: ESTILO_DADOS_WRAP,
      altura: ALTURA_MEDIDA,
    },
    // R29 / R30 — croquis
    secao('OBSERVAÇÕES - CROQUIS'),
    { merges: { 0: 12 }, valores: {}, altura: ALTURA_CROQUI },
  ];
}

// ---------------------------------------------------------------- OOXML

function construirSheetXml(linhas) {
  const cols = LARGURAS_CM
    .map((cm, i) => `<col min="${i + 1}" max="${i + 1}" width="${larguraExcel(cm)}" customWidth="1"/>`)
    .join('');

  const merges = [];
  const rows = linhas.map((spec, indice) => {
    const numLinha = indice + 1;
    const estilo = spec.estilo ?? ESTILO_DADOS;
    const altura = spec.altura ?? ALTURA_PADRAO;

    // Estiliza as 12 celulas: uma celula mesclada so herda borda/fundo se as
    // constituintes tambem estiverem estilizadas.
    const celulas = [];
    for (let col = 0; col < NUM_COLUNAS; col += 1) {
      const ref = `${letraColuna(col)}${numLinha}`;
      const valor = spec.valores?.[col];
      celulas.push(valor
        ? `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(valor)}</t></is></c>`
        : `<c r="${ref}" s="${estilo}"/>`);
    }

    Object.entries(spec.merges || {}).forEach(([colInicial, span]) => {
      if (span > 1) {
        const inicio = Number(colInicial);
        merges.push(`<mergeCell ref="${letraColuna(inicio)}${numLinha}:${letraColuna(inicio + span - 1)}${numLinha}"/>`);
      }
    });

    return `<row r="${numLinha}" ht="${altura}" customHeight="1">${celulas.join('')}</row>`;
  });

  const mergeCells = merges.length
    ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:${letraColuna(NUM_COLUNAS - 1)}${NUM_LINHAS}"/>`
    + '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${cols}</cols>`
    + `<sheetData>${rows.join('')}</sheetData>`
    + mergeCells
    + '<pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'
    + '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>'
    + '</worksheet>';
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + '<fonts count="2">'
  + '<font><sz val="9"/><name val="Arial"/></font>'
  + '<font><b/><sz val="10"/><name val="Arial"/></font>'
  + '</fonts>'
  + '<fills count="4">'
  + '<fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFBFBFBF"/><bgColor indexed="64"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>'
  + '</fills>'
  + '<borders count="2">'
  + '<border><left/><right/><top/><bottom/><diagonal/></border>'
  + '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right>'
  + '<top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>'
  + '</borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  // 0: base | 1: dados | 2: dados com wrap | 3: titulo (BFBFBF) | 4: secao (D9D9D9)
  + '<cellXfs count="5">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">'
  + '<alignment horizontal="left" vertical="center"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">'
  + '<alignment horizontal="left" vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
  + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
  + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + '</Types>';

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
  + '</Relationships>';

// `_xlnm.Print_Area` fixa a area de impressao em A1:L31 (uma pagina A4).
const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" `
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  + '<sheets><sheet name="Ficha" sheetId="1" r:id="rId1"/></sheets>'
  + '<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">Ficha!$A$1:$L$31</definedName></definedNames>'
  + '</workbook>';

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  + '</Relationships>';

/**
 * Gera o .xlsx da ficha a partir dos dados do formulario.
 * @returns {Blob} planilha pronta para download.
 */
export function buildFichaXlsx(dados = {}) {
  const sheetXml = construirSheetXml(montarLinhas(dados));

  const zip = zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES_XML),
    '_rels/.rels': strToU8(ROOT_RELS_XML),
    'xl/workbook.xml': strToU8(WORKBOOK_XML),
    'xl/_rels/workbook.xml.rels': strToU8(WORKBOOK_RELS_XML),
    'xl/styles.xml': strToU8(STYLES_XML),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
  }, { level: 6 });

  // `slice()` garante um ArrayBuffer proprio (fflate pode devolver uma view).
  return new Blob([zip.slice().buffer], { type: XLSX_CONTENT_TYPE });
}

/** Nome de arquivo sugerido, derivado da ficha/data. */
export function buildFichaFileName(dados = {}) {
  const bruto = texto(dados.ficha_num) || texto(dados.data);
  const sufixo = bruto.replace(/[\\/:*?"<>|]/g, '-').trim();
  return sufixo ? `ficha-erosao-${sufixo}.xlsx` : 'ficha-erosao.xlsx';
}
