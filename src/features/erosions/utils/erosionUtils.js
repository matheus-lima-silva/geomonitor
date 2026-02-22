import { normalizeErosionStatus } from '../../shared/statusUtils';

export const EROSION_LOCATION_OPTIONS = [
  'Na faixa de servidão',
  'Na via de acesso exclusiva',
  'Fora da faixa de servidão',
  'Base de torre',
  'Outros',
];

export function normalizeFollowupHistory(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateErosionLocation(data) {
  const localTipo = String(data?.localTipo || '').trim();
  const localDescricao = String(data?.localDescricao || '').trim();

  if (!localTipo) {
    return { ok: false, message: 'Selecione o local da erosão.' };
  }

  if (!EROSION_LOCATION_OPTIONS.includes(localTipo)) {
    return { ok: false, message: 'Opção de local da erosão inválida.' };
  }

  if (localTipo === 'Outros' && !localDescricao) {
    return { ok: false, message: 'Informe a descrição do local quando selecionar "Outros".' };
  }

  return { ok: true, message: '' };
}

function summarizeEvent(change, previous) {
  if (change.origem === 'cadastro') return 'Cadastro inicial da erosão.';
  if (change.origem === 'vistoria') return 'Erosão registrada durante vistoria.';

  const pieces = [];
  if (change.statusAnterior !== change.statusNovo) {
    pieces.push(`status alterado de ${change.statusAnterior} para ${change.statusNovo}`);
  }
  if (String(change.torreAnterior || '') !== String(change.torreNova || '')) {
    pieces.push(`torre alterada de ${change.torreAnterior || '-'} para ${change.torreNova || '-'}`);
  }
  if (String(change.localTipoAnterior || '') !== String(change.localTipoNovo || '')) {
    pieces.push(`local alterado de ${change.localTipoAnterior || '-'} para ${change.localTipoNovo || '-'}`);
  }
  if (String(change.obsAnterior || '') !== String(change.obsNovo || '')) {
    pieces.push('observações atualizadas');
  }

  if (pieces.length === 0) {
    return previous ? 'Edição sem mudanças relevantes para acompanhamento.' : 'Cadastro da erosão.';
  }

  return pieces.join(' | ');
}

export function buildFollowupEvent(previous, next, meta = {}) {
  const now = new Date().toISOString();
  const previousStatus = normalizeErosionStatus(previous?.status);
  const nextStatus = normalizeErosionStatus(next?.status);
  const origem = meta.origem || (meta.isCreate ? 'cadastro' : 'edicao');

  const event = {
    timestamp: now,
    usuario: meta.updatedBy || '',
    origem,
    vistoriaId: String(next?.vistoriaId || '').trim() || undefined,
    statusAnterior: previous ? previousStatus : undefined,
    statusNovo: nextStatus,
    resumo: '',
    torreAnterior: previous?.torreRef,
    torreNova: next?.torreRef,
    localTipoAnterior: previous?.localTipo,
    localTipoNovo: next?.localTipo,
    obsAnterior: previous?.obs,
    obsNovo: next?.obs,
  };

  event.resumo = summarizeEvent(event, previous);

  const hasRelevantChange = origem === 'cadastro'
    || origem === 'vistoria'
    || event.statusAnterior !== event.statusNovo
    || String(event.torreAnterior || '') !== String(event.torreNova || '')
    || String(event.localTipoAnterior || '') !== String(event.localTipoNovo || '')
    || String(event.obsAnterior || '') !== String(event.obsNovo || '');

  if (!hasRelevantChange) return null;

  return {
    timestamp: event.timestamp,
    usuario: event.usuario,
    origem: event.origem,
    tipoEvento: 'sistema',
    ...(event.vistoriaId ? { vistoriaId: event.vistoriaId } : {}),
    ...(event.statusAnterior ? { statusAnterior: event.statusAnterior } : {}),
    statusNovo: event.statusNovo,
    resumo: event.resumo,
  };
}

export function normalizeFollowupEventType(item) {
  const raw = String(item?.tipoEvento || '').trim().toLowerCase();
  if (raw === 'obra') return 'obra';
  if (raw === 'autuacao') return 'autuacao';
  return 'sistema';
}

export function buildManualFollowupEvent(data, meta = {}) {
  const tipoEvento = String(data?.tipoEvento || '').trim().toLowerCase();
  const usuario = String(meta?.updatedBy || '').trim();
  if (tipoEvento === 'obra') {
    const obraEtapa = String(data?.obraEtapa || '').trim();
    const descricao = String(data?.descricao || '').trim();
    if (!obraEtapa || !descricao) return null;
    const etapaConcluida = obraEtapa.toLowerCase() === 'concluída' || obraEtapa.toLowerCase() === 'concluida';
    return {
      timestamp: new Date().toISOString(),
      usuario,
      origem: 'manual',
      tipoEvento: 'obra',
      obraEtapa,
      descricao,
      ...(etapaConcluida ? { statusNovo: 'Estabilizado' } : {}),
      resumo: `Obra - ${obraEtapa}: ${descricao}`,
    };
  }

  if (tipoEvento === 'autuacao') {
    const orgao = String(data?.orgao || '').trim();
    const numeroOuDescricao = String(data?.numeroOuDescricao || '').trim();
    const autuacaoStatus = String(data?.autuacaoStatus || '').trim();
    if (!orgao || !numeroOuDescricao || !autuacaoStatus) return null;
    return {
      timestamp: new Date().toISOString(),
      usuario,
      origem: 'manual',
      tipoEvento: 'autuacao',
      orgao,
      numeroOuDescricao,
      autuacaoStatus,
      resumo: `Autuação (${orgao}) - ${autuacaoStatus}: ${numeroOuDescricao}`,
    };
  }

  return null;
}

export function appendFollowupEvent(history, event) {
  const normalized = normalizeFollowupHistory(history);
  if (!event) return normalized;
  return [...normalized, event].slice(-100);
}

export function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeProjectKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getErosionInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || '').trim();
  const extra = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const merged = [primary, ...extra.map((item) => String(item || '').trim())]
    .filter(Boolean);
  return [...new Set(merged)];
}

function resolveErosionProjectId(erosion, inspectionsById = new Map()) {
  const explicit = normalizeProjectKey(erosion?.projetoId);
  if (explicit) return explicit;
  const inspectionIds = getErosionInspectionIds(erosion);
  for (let i = 0; i < inspectionIds.length; i += 1) {
    const inspection = inspectionsById.get(inspectionIds[i]);
    const project = normalizeProjectKey(inspection?.projetoId);
    if (project) return project;
  }
  return '';
}

function resolveErosionDate(erosion, inspectionsById = new Map()) {
  const candidates = [
    erosion?.ultimaAtualizacao,
    erosion?.updatedAt,
    erosion?.createdAt,
    erosion?.dataCadastro,
    erosion?.data,
  ];
  getErosionInspectionIds(erosion).forEach((inspectionId) => {
    const inspection = inspectionsById.get(inspectionId);
    if (inspection) {
      candidates.push(inspection?.dataFim, inspection?.dataInicio, inspection?.data);
    }
  });
  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = toIsoDate(candidates[i]);
    if (parsed) return parsed;
  }
  return null;
}

export function filterErosionsForReport(
  erosions,
  { projetoId, anos },
  inspections = [],
) {
  const selectedYearsRaw = Array.isArray(anos) ? anos : [];
  const selectedYears = new Set(
    selectedYearsRaw
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 9999),
  );
  const projectKey = normalizeProjectKey(projetoId);
  const inspectionsById = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));

  return (erosions || []).filter((item) => {
    if (resolveErosionProjectId(item, inspectionsById) !== projectKey) return false;
    if (selectedYears.size === 0) return true;

    const rowDate = resolveErosionDate(item, inspectionsById);
    if (!rowDate) return false;
    const year = Number(String(rowDate).slice(0, 4));
    return selectedYears.has(year);
  });
}

export function buildErosionReportRows(erosions) {
  return (erosions || []).map((item) => ({
    id: item.id || '',
    projetoId: item.projetoId || '',
    vistoriaId: item.vistoriaId || '',
    torreRef: item.torreRef || '',
    localTipo: item.localTipo || '',
    localDescricao: item.localDescricao || '',
    tipo: item.tipo || '',
    estagio: item.estagio || '',
    profundidade: item.profundidade || '',
    declividade: item.declividade || '',
    largura: item.largura || '',
    status: normalizeErosionStatus(item.status),
    impacto: item.impacto || '',
    score: item.score ?? '',
    frequencia: item.frequencia || '',
    intervencao: item.intervencao || '',
    latitude: item.latitude || '',
    longitude: item.longitude || '',
    ultimaAtualizacao: item.ultimaAtualizacao || '',
    atualizadoPor: item.atualizadoPor || '',
  }));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildErosionsCsv(rows) {
  const headers = [
    'id', 'projetoId', 'vistoriaId', 'torreRef', 'localTipo', 'localDescricao',
    'tipo', 'estagio', 'profundidade', 'declividade', 'largura',
    'status', 'impacto', 'score', 'frequencia', 'intervencao',
    'latitude', 'longitude', 'ultimaAtualizacao', 'atualizadoPor',
  ];

  const lines = [headers.join(';')];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escapeCsv(row[key])).join(';'));
  });
  return lines.join('\n');
}

export function buildImpactSummary(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'Não informado';
    const impact = row.impacto || 'Não informado';
    acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
    acc.byImpact[impact] = (acc.byImpact[impact] || 0) + 1;
    return acc;
  }, { byStatus: {}, byImpact: {} });
}
