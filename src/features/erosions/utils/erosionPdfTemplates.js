import { normalizeErosionStatus } from '../../shared/statusUtils';
import { normalizeLocationCoordinates } from '../../shared/erosionCoordinates';
import {
  deriveErosionTypeFromTechnicalFields,
  EROSION_TECHNICAL_OPTIONS,
  getLocalContextLabel,
  normalizeErosionTechnicalFields,
  normalizeFollowupEventType,
  normalizeFollowupHistory,
} from '../../shared/viewUtils';
import {
  buildCriticalitySummaryFromErosion,
  formatCriticalityPoints,
} from '../../shared/criticalitySummary';
import { formatTowerLabel } from '../../projects/utils/kmlUtils';
import { resolveErosionCriticality } from '../../../../shared/erosionHelpers';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openPrintableWindow(documentHtml) {
  const win = window.open('', '_blank', 'width=1120,height=820');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };

  const doc = win.document;
  if (typeof doc?.open === 'function') doc.open();
  if (typeof doc?.write === 'function') doc.write(documentHtml);
  if (typeof doc?.close === 'function') doc.close();

  win.onload = () => {
    setTimeout(printOnce, 120);
  };

  setTimeout(printOnce, 450);
}

function listText(values = []) {
  if (!Array.isArray(values) || values.length === 0) return '-';
  return values.join(', ');
}

function buildLabelMap(options = []) {
  return (Array.isArray(options) ? options : []).reduce((acc, item) => {
    const key = String(item?.value || '').trim();
    if (key) acc[key] = String(item?.label || '').trim() || key;
    return acc;
  }, {});
}

const feicaoLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.tiposFeicao);
const usoSoloLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.usosSolo);
const exposicaoLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.localizacaoExposicao);
const estruturaLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.estruturaProxima);
const tipoSoloLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.tipoSolo);
const posicaoViaLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.posicaoRelativaVia);
const grauObstrucaoLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.grauObstrucao);
const estadoViaLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.estadoVia);
const tipoImpactoViaLabelMap = buildLabelMap(EROSION_TECHNICAL_OPTIONS.tipoImpactoVia);

function boolLabel(value) {
  if (value === true) return 'Sim';
  if (value === false) return 'Nao';
  return '-';
}

function labelText(value, labelMap = {}) {
  const key = String(value || '').trim();
  if (!key) return '-';
  return labelMap[key] || key.replace(/_/g, ' ');
}

function listLabelText(values = [], labelMap = {}) {
  if (!Array.isArray(values) || values.length === 0) return '-';
  return values.map((item) => labelText(item, labelMap)).join(', ');
}

function renderHistory(history = []) {
  const normalized = normalizeFollowupHistory(history);
  if (normalized.length === 0) return '<div>Sem historico de acompanhamento.</div>';

  return normalized.map((item) => {
    const itemType = normalizeFollowupEventType(item);
    const typeLabel = itemType === 'obra' ? 'Obra' : (itemType === 'autuacao' ? 'Autuacao' : 'Sistema');
    const details = itemType === 'obra'
      ? `Etapa: ${escapeHtml(item.obraEtapa || '-')} | Descricao: ${escapeHtml(item.descricao || '-')}`
      : (itemType === 'autuacao'
        ? `Orgao: ${escapeHtml(item.orgao || '-')} | No/Descricao: ${escapeHtml(item.numeroOuDescricao || '-')} | Status: ${escapeHtml(item.autuacaoStatus || '-')}`
        : `Status da erosao: ${escapeHtml(item.statusNovo || '-')}`);

    return `
      <div class="ficha-history-item">
        <div class="ficha-history-item-head">
          <span class="ficha-history-chip">${escapeHtml(typeLabel)}</span>
          <span class="ficha-muted">${escapeHtml(item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-')}</span>
        </div>
        <div class="ficha-history-summary">${escapeHtml(item.resumo || '-')}</div>
        <div class="ficha-history-details">${details}</div>
        <div class="ficha-muted">Usuario: ${escapeHtml(item.usuario || '-')} | Origem: ${escapeHtml(item.origem || '-')}</div>
      </div>
    `;
  }).join('');
}

function renderRelatedInspections(relatedInspections = []) {
  if (!Array.isArray(relatedInspections) || relatedInspections.length === 0) {
    return '<div>Sem vistorias vinculadas.</div>';
  }

  return relatedInspections
    .map((item) => `<div>${escapeHtml(item.id)}${item.inspection?.dataInicio ? ` | inicio: ${escapeHtml(item.inspection.dataInicio)}` : ''}${item.inspection?.dataFim ? ` | fim: ${escapeHtml(item.inspection.dataFim)}` : ''}${item.inspection?.responsavel ? ` | resp.: ${escapeHtml(item.inspection.responsavel)}` : ''}</div>`)
    .join('');
}

function renderPhotoLinks(links = []) {
  if (!Array.isArray(links) || links.length === 0) return '<div>Sem links de fotos.</div>';
  return `<ul>${links.map((link) => `<li>${escapeHtml(link)}</li>`).join('')}</ul>`;
}

function parseTowerNumber(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (/^t-?\d+$/.test(normalized)) {
    const parsed = Number(normalized.slice(1));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (/^-?\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const match = normalized.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTowerGrouping(row) {
  const raw = String(row?.erosion?.torreRef || '').trim();
  const parsed = parseTowerNumber(raw);
  if (raw) {
    return {
      key: `txt:${raw.toLowerCase()}`,
      label: formatTowerLabel(raw),
      sortBucket: Number.isFinite(parsed) ? 0 : 1,
      sortValue: Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY,
      sortText: raw.toLowerCase(),
    };
  }

  return {
    key: 'empty',
    label: 'Torre nao informada',
    sortBucket: 2,
    sortValue: Number.POSITIVE_INFINITY,
    sortText: '',
  };
}

function renderFicha({
  erosion,
  project,
  history,
  relatedInspections,
  generatedAt,
}) {
  const locationCoordinates = normalizeLocationCoordinates(erosion || {});
  const technical = normalizeErosionTechnicalFields(erosion || {});
  const localContexto = technical.localContexto || {};
  const localTipoLabel = getLocalContextLabel(localContexto.localTipo) || '-';
  const saturacaoPorAgua = technical.saturacaoPorAgua || String(erosion?.soloSaturadoAgua || '').trim();
  const derivedTipo = deriveErosionTypeFromTechnicalFields({ ...erosion, tiposFeicao: technical.tiposFeicao });
  const criticalitySummary = buildCriticalitySummaryFromErosion(erosion || {});
  const criticalidade = resolveErosionCriticality(erosion || {});

  return `
    <h1>Ficha de Cadastro de Erosao ${escapeHtml(erosion?.id || '-')}</h1>
    <div class="ficha-meta-line"><strong>Empreendimento:</strong> ${escapeHtml(erosion?.projetoId || '-')} ${project?.nome ? `(${escapeHtml(project.nome)})` : ''}</div>
    <div class="ficha-meta-line"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>

    <section class="ficha-section">
      <h2>Resumo</h2>
      <div class="ficha-grid-two">
        <div><strong>ID:</strong> ${escapeHtml(erosion?.id || '-')}</div>
        <div><strong>Torre:</strong> ${escapeHtml(erosion?.torreRef || '-')}</div>
        <div><strong>Status:</strong> ${escapeHtml(normalizeErosionStatus(erosion?.status))}</div>
        <div><strong>Impacto:</strong> ${escapeHtml(erosion?.impacto || '-')}</div>
        <div><strong>Vistoria principal:</strong> ${escapeHtml(erosion?.vistoriaId || '-')}</div>
        <div><strong>Vistorias vinculadas:</strong> ${escapeHtml(Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds.join(', ') : '-')}</div>
        <div class="ficha-full"><strong>Observacoes:</strong> ${escapeHtml(erosion?.obs || '-')}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Localizacao e referencia</h2>
      <div class="ficha-grid-three">
        <div><strong>Latitude:</strong> ${escapeHtml(locationCoordinates.latitude || '-')}</div>
        <div><strong>Longitude:</strong> ${escapeHtml(locationCoordinates.longitude || '-')}</div>
        <div><strong>Altitude:</strong> ${escapeHtml(locationCoordinates.altitude || '-')}</div>
        <div><strong>UTM Easting:</strong> ${escapeHtml(locationCoordinates.utmEasting || '-')}</div>
        <div><strong>UTM Northing:</strong> ${escapeHtml(locationCoordinates.utmNorthing || '-')}</div>
        <div><strong>UTM Zona/Hemisferio:</strong> ${escapeHtml(`${locationCoordinates.utmZone || '-'} ${locationCoordinates.utmHemisphere || '-'}`)}</div>
        <div><strong>Referencia:</strong> ${escapeHtml(locationCoordinates.reference || '-')}</div>
        <div><strong>Exposicao:</strong> ${escapeHtml(labelText(localContexto.exposicao, exposicaoLabelMap))}</div>
        <div><strong>Estrutura proxima:</strong> ${escapeHtml(labelText(localContexto.estruturaProxima, estruturaLabelMap))}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Classificacao e caracterizacao consolidada</h2>
      <div class="ficha-grid-two">
        <div><strong>Tipo:</strong> ${escapeHtml(labelText(derivedTipo, feicaoLabelMap))}</div>
        <div><strong>Grau erosivo:</strong> ${escapeHtml(erosion?.estagio || '-')}</div>
        <div><strong>Local:</strong> ${escapeHtml(localTipoLabel)}</div>
        ${String(localContexto.localTipo || '') === 'outros' ? `<div><strong>Detalhe local:</strong> ${escapeHtml(localContexto.localDescricao || '-')}</div>` : '<div><strong>Detalhe local:</strong> -</div>'}
        <div><strong>Profundidade (m):</strong> ${escapeHtml(Number.isFinite(technical.profundidadeMetros) ? String(technical.profundidadeMetros) : (erosion?.profundidade || '-'))}</div>
        <div><strong>Declividade (graus):</strong> ${escapeHtml(Number.isFinite(technical.declividadeGraus) ? `${technical.declividadeGraus}${criticalidade?.declividade_classe ? ` (${criticalidade.declividade_classe})` : ''}` : (erosion?.declividadeClassePdf || '-'))}</div>
        <div><strong>Distancia estrutura (m):</strong> ${escapeHtml(Number.isFinite(technical.distanciaEstruturaMetros) ? `${technical.distanciaEstruturaMetros}${criticalidade?.exposicao_classe ? ` (${criticalidade.exposicao_classe})` : ''}` : '-')}</div>
        <div><strong>Presenca de agua no fundo:</strong> ${escapeHtml(technical.presencaAguaFundo || '-')}</div>
        <div><strong>Saturacao por agua:</strong> ${escapeHtml(saturacaoPorAgua || '-')}</div>
        <div class="ficha-full"><strong>Tipos de feicao:</strong> ${escapeHtml(listLabelText(technical.tiposFeicao, feicaoLabelMap))}</div>
        <div class="ficha-full"><strong>Usos do solo:</strong> ${escapeHtml(listLabelText(technical.usosSolo, usoSoloLabelMap))}</div>
        ${technical.usosSolo.includes('outro') ? `<div class="ficha-full"><strong>Uso do solo - outro:</strong> ${escapeHtml(technical.usoSoloOutro || '-')}</div>` : ''}
        ${technical.usosSolo.length === 0 && String(erosion?.usoSolo || '').trim() ? `<div class="ficha-full"><strong>Uso do solo (legado):</strong> ${escapeHtml(erosion?.usoSolo || '-')}</div>` : ''}
        <div><strong>Tipo de solo:</strong> ${escapeHtml(labelText(technical.tipoSolo, tipoSoloLabelMap))}</div>
        <div><strong>Sinais de avanco:</strong> ${escapeHtml(boolLabel(technical.sinaisAvanco))}</div>
        <div><strong>Vegetacao no interior:</strong> ${escapeHtml(boolLabel(technical.vegetacaoInterior))}</div>
        ${(() => { const iv = erosion?.impactoVia || technical.impactoVia; const isVia = String(localContexto.localTipo || '').includes('acesso'); return (iv && isVia) ? `<div class="ficha-full"><strong>Impacto na via:</strong> Posicao: ${escapeHtml(labelText(iv.posicaoRelativaVia, posicaoViaLabelMap))} | Tipo: ${escapeHtml(labelText(iv.tipoImpactoVia, tipoImpactoViaLabelMap))} | Obstrucao: ${escapeHtml(labelText(iv.grauObstrucao, grauObstrucaoLabelMap))} | Estado: ${escapeHtml(labelText(iv.estadoVia, estadoViaLabelMap))} | Rota alternativa: ${escapeHtml(boolLabel(iv.rotaAlternativaDisponivel))}</div>` : ''; })()}
        <div class="ficha-full"><strong>Resumo de criticidade calculada:</strong> ${escapeHtml(`Impacto: ${criticalitySummary.impacto} | Score: ${criticalitySummary.score} | Frequencia: ${criticalitySummary.frequencia}`)}</div>
        ${criticalitySummary.hasBreakdown ? `<div class="ficha-full"><strong>Criticidade:</strong> ${escapeHtml(criticalitySummary.criticidadeClasse)} (${escapeHtml(criticalitySummary.criticidadeCodigo)}) | Pontos T/P/D/S/E/A: ${escapeHtml(formatCriticalityPoints(criticalidade?.pontos))}${Number(criticalidade?.pontos?.V) > 0 ? ` + V: ${criticalidade.pontos.V}` : ''}</div>` : ''}
        ${criticalitySummary.hasBreakdown ? `<div class="ficha-full"><strong>Classes:</strong> T=${escapeHtml(criticalidade?.tipo_classe || criticalidade?.tipo_erosao_classe || '-')} | P=${escapeHtml(criticalidade?.profundidade_classe || '-')} | D=${escapeHtml(criticalidade?.declividade_classe || '-')} | S=${escapeHtml(criticalidade?.solo_classe || '-')} | E=${escapeHtml(criticalidade?.exposicao_classe || '-')} | A=${escapeHtml(criticalidade?.atividade_classe || '-')}</div>` : ''}
        ${criticalitySummary.solucoesSugeridas.length > 0 ? `<div class="ficha-full"><strong>Solucoes sugeridas:</strong> ${escapeHtml(criticalitySummary.solucoesSugeridas.join(' | '))}</div>` : ''}
        ${criticalitySummary.sugestoesIntervencao.length > 0 ? `<div class="ficha-full"><strong>Sugestoes de intervencao (opcional):</strong> ${escapeHtml(criticalitySummary.sugestoesIntervencao.join(' | '))}</div>` : ''}
        ${criticalidade?.tipo_medida_recomendada ? `<div class="ficha-full"><strong>Tipo de medida recomendada:</strong> ${escapeHtml(labelText(criticalidade.tipo_medida_recomendada))}</div>` : ''}
        ${criticalitySummary.regraContextual ? `<div class="ficha-full"><strong>Regra contextual:</strong> ${escapeHtml(criticalitySummary.regraContextual)}</div>` : ''}
        ${criticalitySummary.alertas.length > 0 ? `<div class="ficha-full"><strong>Alertas ativos:</strong> ${escapeHtml(criticalitySummary.alertas.join(' | '))}</div>` : ''}
        <div class="ficha-full"><strong>Medida preventiva:</strong> ${escapeHtml(erosion?.medidaPreventiva || '-')}</div>
        <div class="ficha-full"><strong>Fotos:</strong> ${renderPhotoLinks(erosion?.fotosLinks)}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Vistorias relacionadas</h2>
      ${renderRelatedInspections(relatedInspections)}
    </section>

    <section class="ficha-section">
      <h2>Historico de acompanhamento</h2>
      ${renderHistory(history)}
    </section>
  `;
}

function checkbox(checked) {
  return checked ? '☑' : '☐';
}

function classifyDeclividade(graus) {
  if (!Number.isFinite(graus)) return null;
  if (graus <= 6) return '0_6';
  if (graus <= 12) return '6_12';
  if (graus <= 20) return '12_20';
  return 'gt_20';
}

function buildDocument(title, content) {
  return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; font-size: 12px; }
          h1 { margin: 0 0 8px; font-size: 18px; color: #1e293b; }
          h2 { margin: 0 0 8px; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
          .ficha-meta-line { margin-bottom: 4px; font-size: 12px; }
          .ficha-muted { font-size: 10px; color: #64748b; }
          .ficha-header { border-bottom: 3px solid #1e40af; padding-bottom: 8px; margin-bottom: 4px; }
          .ficha-header h1 { color: #1e40af; margin-bottom: 4px; }
          .ficha-header-meta { font-size: 12px; }
          .ficha-section { margin-top: 10px; border: 1px solid #dbe4ee; border-radius: 8px; background: #fff; padding: 10px 12px; }
          .ficha-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
          .ficha-grid-three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; }
          .ficha-full { grid-column: 1 / -1; }
          .ficha-checkbox-row { font-size: 12px; line-height: 1.8; }
          .ficha-section ul { margin: 6px 0 0; padding-left: 18px; }
          .ficha-history-item { border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
          .ficha-history-item-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
          .ficha-history-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: #e2e8f0; color: #334155; }
          .ficha-history-summary { font-weight: 600; color: #1f2937; margin-bottom: 2px; }
          .ficha-history-details { font-size: 11px; color: #334155; margin-bottom: 2px; }
          .pdf-group-head { border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; padding: 10px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; gap: 8px; align-items: center; }
          .pdf-page-break { page-break-before: always; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}

export function buildSingleErosionFichaPdfDocument({
  erosion,
  project,
  history,
  relatedInspections,
  generatedAt = new Date().toLocaleString('pt-BR'),
}) {
  const content = renderFicha({
    erosion,
    project,
    history,
    relatedInspections,
    generatedAt,
  });

  return buildDocument(`Detalhes da Erosao ${erosion?.id || '-'}`, content);
}

export function buildBatchErosionFichasPdfDocument({
  projectId,
  project,
  rows = [],
  generatedAt = new Date().toLocaleString('pt-BR'),
}) {
  const sortedRows = [...rows].sort((a, b) => {
    const groupA = buildTowerGrouping(a);
    const groupB = buildTowerGrouping(b);

    if (groupA.sortBucket !== groupB.sortBucket) return groupA.sortBucket - groupB.sortBucket;
    if (groupA.sortValue !== groupB.sortValue) return groupA.sortValue - groupB.sortValue;
    if (groupA.sortText !== groupB.sortText) return groupA.sortText.localeCompare(groupB.sortText, 'pt-BR', { sensitivity: 'base', numeric: true });

    const idA = String(a?.erosion?.id || '');
    const idB = String(b?.erosion?.id || '');
    return idA.localeCompare(idB, 'pt-BR', { sensitivity: 'base', numeric: true });
  });

  const groupCountByKey = new Map();
  sortedRows.forEach((row) => {
    const group = buildTowerGrouping(row);
    groupCountByKey.set(group.key, (groupCountByKey.get(group.key) || 0) + 1);
  });

  let previousGroupKey = null;
  const fichasParts = [];
  sortedRows.forEach((row, index) => {
    const group = buildTowerGrouping(row);
    const isFirstInGroup = group.key !== previousGroupKey;
    previousGroupKey = group.key;
    const groupCount = groupCountByKey.get(group.key) || 0;

    fichasParts.push(`
      <section class="${index > 0 ? 'pdf-page-break' : ''}">
        ${isFirstInGroup ? `
          <div class="pdf-group-head">
            <strong>Grupo da torre:</strong> ${escapeHtml(group.label)}
            <span class="ficha-muted">${groupCount} ficha(s)</span>
          </div>
        ` : ''}
        ${renderFicha({
      erosion: row.erosion,
      project: row.project || project,
      history: row.history,
      relatedInspections: row.relatedInspections,
      generatedAt,
    })}
      </section>
    `);
  });
  const fichas = fichasParts.join('');

  const summaryHeader = `
    <section>
      <h1>Fichas de Cadastro de Erosoes</h1>
      <div class="ficha-meta-line"><strong>Empreendimento:</strong> ${escapeHtml(projectId || '-')} ${project?.nome ? `(${escapeHtml(project.nome)})` : ''}</div>
      <div class="ficha-meta-line"><strong>Total de fichas:</strong> ${rows.length}</div>
      <div class="ficha-meta-line"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>
    </section>
  `;

  return buildDocument(
    `Fichas de Erosoes - ${projectId || '-'}`,
    `${summaryHeader}${fichas}`,
  );
}

export function buildReportPdfDocument({
  projectId,
  rows,
  selectedYears,
  summary,
}) {
  const now = new Date();
  const statusRows = Object.entries(summary.byStatus)
    .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
    .join('');
  const impactRows = Object.entries(summary.byImpact)
    .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
    .join('');

  const sortedRows = [...(rows || [])].sort((a, b) => {
    const groupA = buildTowerGrouping({ erosion: a });
    const groupB = buildTowerGrouping({ erosion: b });

    if (groupA.sortBucket !== groupB.sortBucket) return groupA.sortBucket - groupB.sortBucket;
    if (groupA.sortValue !== groupB.sortValue) return groupA.sortValue - groupB.sortValue;
    if (groupA.sortText !== groupB.sortText) return groupA.sortText.localeCompare(groupB.sortText, 'pt-BR', { sensitivity: 'base', numeric: true });

    const idA = String(a?.id || '');
    const idB = String(b?.id || '');
    return idA.localeCompare(idB, 'pt-BR', { sensitivity: 'base', numeric: true });
  });

  let previousGroupKey = null;
  const tableRows = sortedRows.map((row) => {
    const group = buildTowerGrouping({ erosion: row });
    const isFirstInGroup = group.key !== previousGroupKey;
    previousGroupKey = group.key;

    const groupRow = isFirstInGroup
      ? `<tr><td colspan="7" style="background:#e2e8f0;font-weight:700;">Grupo da torre: ${escapeHtml(group.label)}</td></tr>`
      : '';

    return `
      ${groupRow}
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.vistoriaId || '-')}</td>
        <td>${escapeHtml(row.torreRef || '-')}</td>
        <td>${escapeHtml(row['localContexto.localTipoLabel'] || row['localContexto.localTipo'] || '-')}</td>
        <td>${escapeHtml(row.status || '-')}</td>
        <td>${escapeHtml(row.impacto || '-')}</td>
        <td>${escapeHtml(row.ultimaAtualizacao || '-')}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Relatorio de Processos Erosivos</h1>
    <div class="ficha-meta-line">
      <div><strong>Empreendimento:</strong> ${escapeHtml(projectId)}</div>
      <div><strong>Ano(s):</strong> ${selectedYears.length > 0 ? selectedYears.join(', ') : 'Todos'}</div>
      <div><strong>Periodo consolidado:</strong> ${selectedYears.length > 0 ? `${selectedYears[0]}-01-01 ate ${selectedYears[selectedYears.length - 1]}-12-31` : 'Historico completo do empreendimento'}</div>
      <div><strong>Gerado em:</strong> ${now.toLocaleString('pt-BR')}</div>
      <div><strong>Total de erosoes:</strong> ${rows.length}</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0;">
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
        <h3>Totais por status</h3>
        <ul>${statusRows || '<li>Sem dados</li>'}</ul>
      </div>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
        <h3>Totais por impacto</h3>
        <ul>${impactRows || '<li>Sem dados</li>'}</ul>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">ID</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Vistoria</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Torre</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Local</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Status</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Impacto</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; background: #f1f5f9;">Atualizacao</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="7" style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left;">Sem dados para o filtro selecionado.</td></tr>'}
      </tbody>
    </table>
  `;

  return buildDocument(`Relatorio de Erosoes - ${projectId}`, content);
}

function renderFichaSimplificada({
  erosion,
  project,
  generatedAt,
  generatedBy,
}) {
  const locationCoordinates = normalizeLocationCoordinates(erosion || {});
  const technical = normalizeErosionTechnicalFields(erosion || {});
  const localContexto = technical.localContexto || {};
  const criticalidade = resolveErosionCriticality(erosion || {});

  const exposicao = String(localContexto.exposicao || '').toLowerCase();
  const status = normalizeErosionStatus(erosion?.status);
  const tiposFeicao = Array.isArray(technical.tiposFeicao) ? technical.tiposFeicao : [];
  const usosSolo = Array.isArray(technical.usosSolo) ? technical.usosSolo : [];
  const tipoSolo = String(technical.tipoSolo || '').toLowerCase();
  const presencaAgua = String(technical.presencaAguaFundo || '').toLowerCase();
  const declFaixa = classifyDeclividade(technical.declividadeGraus);
  const relevo = String(erosion?.relevo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const criticidadeClasse = String(criticalidade?.criticidade_classe || criticalidade?.criticidadeClasse || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fotosLinks = Array.isArray(erosion?.fotosLinks) ? erosion.fotosLinks : [];
  const hasDecimal = locationCoordinates.latitude || locationCoordinates.longitude;
  const hasUtm = locationCoordinates.utmEasting || locationCoordinates.utmNorthing;
  const profissional = erosion?.updatedBy || generatedBy || '-';

  return `
    <div class="ficha-header">
      <h1>Ficha Simplificada de Erosao</h1>
      <div class="ficha-header-meta">
        <div class="ficha-meta-line"><strong>Empreendimento:</strong> ${escapeHtml(erosion?.projetoId || '')} ${project?.nome ? `- ${escapeHtml(project.nome)}` : ''}</div>
        <div class="ficha-meta-line"><strong>CADASTRO DE FOCOS EROSIVOS</strong></div>
      </div>
    </div>

    <section class="ficha-section">
      <h2>Identificacao</h2>
      <div class="ficha-grid-three">
        <div><strong>Ficha n\u00ba:</strong> ${escapeHtml(erosion?.id || '')}</div>
        <div><strong>Data:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong>Profissional:</strong> ${escapeHtml(profissional)}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Localizacao e referencia</h2>
      <div class="ficha-grid-three">
        ${hasDecimal ? `
          <div><strong>Latitude:</strong> ${escapeHtml(locationCoordinates.latitude || '-')}</div>
          <div><strong>Longitude:</strong> ${escapeHtml(locationCoordinates.longitude || '-')}</div>
        ` : hasUtm ? `
          <div><strong>UTM E:</strong> ${escapeHtml(locationCoordinates.utmEasting || '-')}</div>
          <div><strong>UTM N:</strong> ${escapeHtml(locationCoordinates.utmNorthing || '-')}</div>
        ` : `<div><strong>Coordenadas:</strong> -</div>`}
        <div><strong>Altitude:</strong> ${escapeHtml(locationCoordinates.altitude || '-')}</div>
        <div><strong>Torre ref.:</strong> ${escapeHtml(erosion?.torreRef ? `Torre ${erosion.torreRef}` : '-')}</div>
        <div class="ficha-full ficha-checkbox-row">
          ${checkbox(exposicao === 'faixa_servidao')} Faixa de Servid\u00e3o &nbsp;&nbsp;
          ${checkbox(exposicao === 'area_terceiros')} \u00c1rea de Terceiros &nbsp;&nbsp;
          ${checkbox(false)} \u00c1rea P\u00fablica
        </div>
        <div class="ficha-full"><strong>Fotos:</strong> ${fotosLinks.length > 0 ? escapeHtml(fotosLinks.join(', ')) : '-'}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Classificacao de Criticidade - Grau Erosivo</h2>
      <div class="ficha-checkbox-row">
        ${checkbox(criticidadeClasse.includes('baixo') && !criticidadeClasse.includes('muito'))} Baixo &nbsp;&nbsp;
        ${checkbox(criticidadeClasse.includes('medio'))} M\u00e9dio &nbsp;&nbsp;
        ${checkbox(criticidadeClasse.includes('alto') && !criticidadeClasse.includes('muito'))} Alto &nbsp;&nbsp;
        ${checkbox(criticidadeClasse.includes('muito alto'))} Muito Alto
      </div>
    </section>

    <section class="ficha-section">
      <h2>Situacao Atual</h2>
      <div class="ficha-grid-two">
        <div><strong>Estagio Erosivo:</strong></div>
        <div class="ficha-checkbox-row">
          ${checkbox(status === 'Ativo')} Ativo &nbsp;&nbsp;
          ${checkbox(status === 'Estabilizado')} Est\u00e1vel &nbsp;&nbsp;
          ${checkbox(status === 'Monitoramento')} Regenera\u00e7\u00e3o Natural
        </div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Tipo / Caracteristicas da Feicao</h2>
      <div class="ficha-grid-two">
        <div class="ficha-full ficha-checkbox-row">
          ${checkbox(tiposFeicao.includes('laminar'))} Laminar &nbsp;&nbsp;
          ${checkbox(tiposFeicao.includes('sulco'))} Sulco &nbsp;&nbsp;
          ${checkbox(tiposFeicao.includes('ravina'))} Ravina &nbsp;&nbsp;
          ${checkbox(tiposFeicao.includes('vocoroca'))} Vo\u00e7oroca
        </div>
        <div class="ficha-full">
          <strong>Presenca de agua no fundo:</strong> &nbsp;
          ${checkbox(presencaAgua === 'sim')} Sim &nbsp;&nbsp;
          ${checkbox(presencaAgua === 'nao')} N\u00e3o &nbsp;&nbsp;
          ${checkbox(presencaAgua === 'nao_verificado')} N\u00e3o verificado
        </div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Declividade</h2>
      <div class="ficha-checkbox-row">
        ${checkbox(declFaixa === '0_6')} 0\u00ba a 6\u00ba &nbsp;&nbsp;
        ${checkbox(declFaixa === '6_12')} 6\u00ba a 12\u00ba &nbsp;&nbsp;
        ${checkbox(declFaixa === '12_20')} 12\u00ba a 20\u00ba &nbsp;&nbsp;
        ${checkbox(declFaixa === 'gt_20')} &gt; 20\u00ba
      </div>
    </section>

    <section class="ficha-section">
      <h2>Relevo</h2>
      <div class="ficha-checkbox-row">
        ${checkbox(relevo === 'suave')} Suave &nbsp;&nbsp;
        ${checkbox(relevo === 'ondulado')} Ondulado &nbsp;&nbsp;
        ${checkbox(relevo === 'escarpado')} Escarpado
      </div>
    </section>

    <section class="ficha-section">
      <h2>Dimensoes</h2>
      <div class="ficha-grid-two">
        <div><strong>Largura Maxima:</strong></div>
        <div class="ficha-checkbox-row">
          ${checkbox(false)} Ate 1 m &nbsp;&nbsp;
          ${checkbox(false)} 1 a 10 m &nbsp;&nbsp;
          ${checkbox(false)} &gt; 30 m
        </div>
        <div><strong>Altura Maxima:</strong></div>
        <div class="ficha-checkbox-row">
          ${checkbox(false)} Ate 1 m &nbsp;&nbsp;
          ${checkbox(false)} 1 a 10 m &nbsp;&nbsp;
          ${checkbox(false)} &gt; 30 m
        </div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Caracterizacao</h2>
      <div class="ficha-grid-two">
        <div><strong>Tipo de Solo:</strong></div>
        <div class="ficha-checkbox-row">
          ${checkbox(tipoSolo === 'argiloso')} Argiloso &nbsp;&nbsp;
          ${checkbox(tipoSolo === 'arenoso')} Arenoso &nbsp;&nbsp;
          ${checkbox(tipoSolo === 'lateritico')} Later\u00edtico
        </div>
        <div><strong>Usos do Solo:</strong></div>
        <div class="ficha-checkbox-row">
          ${checkbox(usosSolo.includes('pastagem'))} Pastagem &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('cultivo'))} Cultivo &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('campo'))} Campo &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('veg_arborea'))} Veg. Arb\u00f3rea
        </div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Obstaculos</h2>
      <div class="ficha-grid-two">
        <div class="ficha-full ficha-checkbox-row">
          ${checkbox(usosSolo.includes('acesso'))} Acesso &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('cerca'))} Cerca &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('curso_agua'))} Curso d'agua &nbsp;&nbsp;
          ${checkbox(usosSolo.includes('tubulacao'))} Tubulacao
        </div>
        <div class="ficha-full"><strong>Outros:</strong> ${escapeHtml(technical.usoSoloOutro || '-')}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Medida Preventiva</h2>
      <div>${escapeHtml(erosion?.medidaPreventiva || '-')}</div>
    </section>
  `;
}

export function buildSingleErosionFichaSimplificadaDocument({
  erosion,
  project,
  generatedAt = new Date().toLocaleString('pt-BR'),
  generatedBy,
}) {
  const content = renderFichaSimplificada({ erosion, project, generatedAt, generatedBy });
  return buildDocument(`Ficha Simplificada ${erosion?.id || '-'}`, content);
}

export function buildBatchErosionFichasSimplificadasDocument({
  projectId,
  project,
  rows = [],
  generatedAt = new Date().toLocaleString('pt-BR'),
  generatedBy,
}) {
  const sortedRows = [...rows].sort((a, b) => {
    const groupA = buildTowerGrouping(a);
    const groupB = buildTowerGrouping(b);
    if (groupA.sortBucket !== groupB.sortBucket) return groupA.sortBucket - groupB.sortBucket;
    if (groupA.sortValue !== groupB.sortValue) return groupA.sortValue - groupB.sortValue;
    if (groupA.sortText !== groupB.sortText) return groupA.sortText.localeCompare(groupB.sortText, 'pt-BR', { sensitivity: 'base', numeric: true });
    return String(a?.erosion?.id || '').localeCompare(String(b?.erosion?.id || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
  });

  const groupCountByKey = new Map();
  sortedRows.forEach((row) => {
    const group = buildTowerGrouping(row);
    groupCountByKey.set(group.key, (groupCountByKey.get(group.key) || 0) + 1);
  });

  let previousGroupKey = null;
  const fichasParts = [];
  sortedRows.forEach((row, index) => {
    const group = buildTowerGrouping(row);
    const isFirstInGroup = group.key !== previousGroupKey;
    previousGroupKey = group.key;
    const groupCount = groupCountByKey.get(group.key) || 0;

    fichasParts.push(`
      <section class="${index > 0 ? 'pdf-page-break' : ''}">
        ${isFirstInGroup ? `
          <div class="pdf-group-head">
            <strong>Grupo da torre:</strong> ${escapeHtml(group.label)}
            <span class="ficha-muted">${groupCount} ficha(s)</span>
          </div>
        ` : ''}
        ${renderFichaSimplificada({
      erosion: row.erosion,
      project: row.project || project,
      generatedAt,
      generatedBy,
    })}
      </section>
    `);
  });

  const summaryHeader = `
    <section>
      <div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:4px;">Fichas Simplificadas de Cadastro de Eros\u00f5es</div>
      <div style="font-size:11px;margin-bottom:2px;"><strong>Empreendimento:</strong> ${escapeHtml(projectId || '-')} ${project?.nome ? `(${escapeHtml(project.nome)})` : ''}</div>
      <div style="font-size:11px;margin-bottom:2px;"><strong>Total de fichas:</strong> ${rows.length}</div>
      <div style="font-size:11px;margin-bottom:8px;"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>
    </section>
  `;

  return buildDocument(
    `Fichas Simplificadas - ${projectId || '-'}`,
    `${summaryHeader}${fichasParts.join('')}`,
  );
}
