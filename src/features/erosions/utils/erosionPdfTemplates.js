import { normalizeErosionStatus } from '../../shared/statusUtils';
import { normalizeLocationCoordinates } from '../../shared/erosionCoordinates';
import {
  deriveErosionTypeFromTechnicalFields,
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listText(values = []) {
  if (!Array.isArray(values) || values.length === 0) return '-';
  return values.join(', ');
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
  const criticalidadeV2 = erosion?.criticalidadeV2 && typeof erosion.criticalidadeV2 === 'object'
    ? erosion.criticalidadeV2
    : null;

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
        <div><strong>Exposicao:</strong> ${escapeHtml(localContexto.exposicao || '-')}</div>
        <div><strong>Estrutura proxima:</strong> ${escapeHtml(localContexto.estruturaProxima || '-')}</div>
      </div>
    </section>

    <section class="ficha-section">
      <h2>Classificacao e caracterizacao consolidada</h2>
      <div class="ficha-grid-two">
        <div><strong>Tipo (derivado):</strong> ${escapeHtml(derivedTipo || '-')}</div>
        <div><strong>Estagio:</strong> ${escapeHtml(erosion?.estagio || '-')}</div>
        <div><strong>Local:</strong> ${escapeHtml(localTipoLabel)}</div>
        ${String(localContexto.localTipo || '') === 'outros' ? `<div><strong>Detalhe local:</strong> ${escapeHtml(localContexto.localDescricao || '-')}</div>` : '<div><strong>Detalhe local:</strong> -</div>'}
        <div><strong>Profundidade:</strong> ${escapeHtml(erosion?.profundidade || '-')}</div>
        <div><strong>Classe de declividade (graus):</strong> ${escapeHtml(technical.declividadeClasse || erosion?.declividade || erosion?.declividadeClassePdf || '-')}</div>
        <div><strong>Classe de largura maxima (m):</strong> ${escapeHtml(technical.larguraMaximaClasse || erosion?.largura || '-')}</div>
        <div><strong>Presenca de agua no fundo:</strong> ${escapeHtml(technical.presencaAguaFundo || '-')}</div>
        <div><strong>Saturacao por agua:</strong> ${escapeHtml(saturacaoPorAgua || '-')}</div>
        <div class="ficha-full"><strong>Tipos de feicao:</strong> ${escapeHtml(listText(technical.tiposFeicao))}</div>
        <div class="ficha-full"><strong>Caracteristicas da feicao:</strong> ${escapeHtml(listText(technical.caracteristicasFeicao))}</div>
        <div class="ficha-full"><strong>Usos do solo:</strong> ${escapeHtml(listText(technical.usosSolo))}</div>
        ${technical.usosSolo.includes('outro') ? `<div class="ficha-full"><strong>Uso do solo - outro:</strong> ${escapeHtml(technical.usoSoloOutro || '-')}</div>` : ''}
        ${technical.usosSolo.length === 0 && String(erosion?.usoSolo || '').trim() ? `<div class="ficha-full"><strong>Uso do solo (legado):</strong> ${escapeHtml(erosion?.usoSolo || '-')}</div>` : ''}
        <div class="ficha-full"><strong>Resumo de criticidade calculada:</strong> ${escapeHtml(`Impacto: ${criticalitySummary.impacto} | Score: ${criticalitySummary.score} | Frequencia: ${criticalitySummary.frequencia}`)}</div>
        ${criticalitySummary.hasBreakdown ? `<div class="ficha-full"><strong>Criticidade:</strong> ${escapeHtml(criticalitySummary.criticidadeClasse)} (${escapeHtml(criticalitySummary.criticidadeCodigo)}) | Pontos T/P/D/S/E: ${escapeHtml(formatCriticalityPoints(criticalidadeV2?.pontos))}</div>` : ''}
        ${criticalitySummary.solucoesSugeridas.length > 0 ? `<div class="ficha-full"><strong>Solucoes sugeridas:</strong> ${escapeHtml(criticalitySummary.solucoesSugeridas.join(' | '))}</div>` : ''}
        ${criticalitySummary.sugestoesIntervencao.length > 0 ? `<div class="ficha-full"><strong>Sugestoes de intervencao (opcional):</strong> ${escapeHtml(criticalitySummary.sugestoesIntervencao.join(' | '))}</div>` : ''}
        ${criticalidadeV2?.tipo_medida_recomendada ? `<div class="ficha-full"><strong>Tipo de medida recomendada:</strong> ${escapeHtml(criticalidadeV2.tipo_medida_recomendada)}</div>` : ''}
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

function buildDocument(title, content) {
  return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          h2 { margin: 0 0 8px; font-size: 14px; }
          .ficha-meta-line { margin-bottom: 4px; }
          .ficha-muted { font-size: 10px; color: #64748b; }
          .ficha-section { margin-top: 12px; border: 1px solid #dbe4ee; border-radius: 10px; background: #fff; padding: 12px; }
          .ficha-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
          .ficha-grid-three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 12px; }
          .ficha-full { grid-column: 1 / -1; }
          .ficha-section ul { margin: 6px 0 0; padding-left: 18px; }
          .ficha-history-item { border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
          .ficha-history-item-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
          .ficha-history-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: #e2e8f0; color: #334155; }
          .ficha-history-summary { font-weight: 600; color: #1f2937; margin-bottom: 2px; }
          .ficha-history-details { font-size: 11px; color: #334155; margin-bottom: 2px; }
          .pdf-cover { border: 1px solid #dbe4ee; border-radius: 12px; background: #f8fafc; padding: 16px; margin-bottom: 16px; }
          .pdf-cover h1 { margin-bottom: 10px; }
          .pdf-group-head { border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; padding: 10px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; gap: 8px; align-items: center; }
          .pdf-page-break { page-break-before: always; }
          @media print {
            body { padding: 0; }
            .pdf-cover { page-break-after: always; margin-bottom: 0; }
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
  const projectName = project?.nome ? ` - ${project.nome}` : '';
  const cover = `
    <section class="pdf-cover">
      <h1>Fichas de Cadastro de Erosoes</h1>
      <div class="ficha-meta-line"><strong>Empreendimento:</strong> ${escapeHtml(projectId || '-')} ${escapeHtml(projectName)}</div>
      <div class="ficha-meta-line"><strong>Total de fichas:</strong> ${rows.length}</div>
      <div class="ficha-meta-line"><strong>Gerado em:</strong> ${escapeHtml(generatedAt)}</div>
    </section>
  `;

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

  return buildDocument(
    `Fichas de Erosoes - ${projectId || '-'}`,
    `${cover}${fichas}`,
  );
}
