/**
 * Módulo compartilhado entre frontend e backend.
 * Contém funções puras de lógica de erosão — sem dependências de Firebase.
 *
 * Frontend: importa diretamente via Vite (ESM)
 * Backend:  importa via esbuild bundle (CJS)
 */

// ─── Text & Numeric ──────────────────────────────────────────────

export function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function unwrapCriticalityPayload(value) {
  if (!value || typeof value !== 'object') return null;

  const nestedCandidates = [
    value.breakdown,
    value.campos_calculados,
    value.calculation,
    value.resultado,
  ];

  for (let i = 0; i < nestedCandidates.length; i += 1) {
    const candidate = nestedCandidates[i];
    if (candidate && typeof candidate === 'object') return candidate;
  }

  return value;
}

export function resolveErosionCriticality(erosion) {
  if (!erosion || typeof erosion !== 'object') return null;
  return unwrapCriticalityPayload(
    erosion.criticalidade
    ?? erosion.criticalidadeV2
    ?? erosion.criticidadeV2
    ?? erosion.criticalityV2
    ?? erosion.criticality,
  );
}

export function getCriticalityCode(criticalidade, fallback = '') {
  const resolved = unwrapCriticalityPayload(criticalidade);
  return normalizeText(
    resolved?.codigo
    ?? resolved?.criticidade_codigo
    ?? resolved?.criticidadeCodigo
    ?? resolved?.criticality_code
    ?? resolved?.criticalityCode
    ?? fallback,
  ).toUpperCase();
}

export function getCriticalityClass(criticalidade, fallback = '') {
  const resolved = unwrapCriticalityPayload(criticalidade);
  return normalizeText(
    resolved?.criticidade_classe
    ?? resolved?.criticidadeClasse
    ?? resolved?.criticality_class
    ?? resolved?.criticalityClass
    ?? fallback,
  );
}

export function getCriticalityScore(criticalidade, fallback = null) {
  const resolved = unwrapCriticalityPayload(criticalidade);
  const normalized = normalizeNumeric(
    resolved?.criticidade_score
    ?? resolved?.criticidadeScore
    ?? resolved?.criticality_score
    ?? resolved?.criticalityScore,
  );
  return normalized ?? fallback;
}

// ─── Followup History ────────────────────────────────────────────

export function normalizeFollowupHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => item && typeof item === 'object').slice(-100);
}

export function buildManualFollowupEvent(data, meta = {}) {
  const tipoEvento = normalizeText(data?.tipoEvento).toLowerCase();
  const usuario = normalizeText(meta?.updatedBy);

  if (tipoEvento === 'obra') {
    const obraEtapa = normalizeText(data?.obraEtapa);
    const descricao = normalizeText(data?.descricao);
    if (!obraEtapa || !descricao) return null;
    const etapa = obraEtapa.toLowerCase();
    const etapaConcluida = etapa === 'concluida' || etapa === 'concluída';
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
    const orgao = normalizeText(data?.orgao);
    const numeroOuDescricao = normalizeText(data?.numeroOuDescricao);
    const autuacaoStatus = normalizeText(data?.autuacaoStatus);
    if (!orgao || !numeroOuDescricao || !autuacaoStatus) return null;
    return {
      timestamp: new Date().toISOString(),
      usuario,
      origem: 'manual',
      tipoEvento: 'autuacao',
      orgao,
      numeroOuDescricao,
      autuacaoStatus,
      resumo: `Autuacao (${orgao}) - ${autuacaoStatus}: ${numeroOuDescricao}`,
    };
  }

  return null;
}

export function appendFollowupEvent(history, event) {
  const normalized = normalizeFollowupHistory(history);
  if (!event) return normalized;
  return [...normalized, event].slice(-100);
}

// ─── Criticality ─────────────────────────────────────────────────

export function buildCriticalityTrend(previousScore, currentScore) {
  if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) return 'estavel';
  if (currentScore > previousScore) return 'agravando';
  if (currentScore < previousScore) return 'recuperando';
  return 'estavel';
}

export function normalizeCriticalityHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object').slice(-200);
}

// ─── Inspection Helpers ──────────────────────────────────────────

export function getInspectionDateScore(inspection) {
  const candidates = [inspection?.dataFim, inspection?.dataInicio, inspection?.data];
  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = new Date(candidates[i]);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

export function normalizeErosionInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || '').trim();
  const list = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const pendencies = Array.isArray(erosion?.pendenciasVistoria) ? erosion.pendenciasVistoria : [];
  const fromPendencies = pendencies.map((item) => String(item?.vistoriaId || '').trim());
  return [...new Set([primary, ...list.map((v) => String(v || '').trim()), ...fromPendencies].filter(Boolean))];
}

export function resolvePrimaryInspectionId(inspectionIds, inspections) {
  if (!Array.isArray(inspectionIds) || inspectionIds.length === 0) return '';
  const inspectionById = new Map(
    (Array.isArray(inspections) ? inspections : [])
      .map((inspection) => [String(inspection?.id || '').trim(), inspection]),
  );
  return [...inspectionIds].sort((a, b) => {
    const inspectionA = inspectionById.get(String(a || '').trim());
    const inspectionB = inspectionById.get(String(b || '').trim());
    const scoreA = getInspectionDateScore(inspectionA);
    const scoreB = getInspectionDateScore(inspectionB);
    if (scoreA !== null && scoreB !== null) return scoreB - scoreA;
    if (scoreA !== null) return -1;
    if (scoreB !== null) return 1;
    return String(b || '').localeCompare(String(a || ''));
  })[0];
}

// ─── Status & Situação ──────────────────────────────────────────

/**
 * Mapeia status da erosão para a situação (ativo/em_recuperacao/estabilizado).
 * Recebe normalizeErosionStatus como parâmetro para evitar dependência circular.
 */
export function buildSituacaoFromStatus(status, normalizeStatusFn) {
  const normalized = normalizeStatusFn(status).toLowerCase();
  if (normalized === 'estabilizado') return 'estabilizado';
  if (normalized === 'monitoramento') return 'em_recuperacao';
  return 'ativo';
}

// ─── Criticality History Builder ─────────────────────────────────

export function buildCriticalityHistory(previous, nextData, criticalidade, deps = {}) {
  const { buildCriticalityTrend: trendFn = buildCriticalityTrend, normalizeStatusFn } = deps;

  const previousHistory = normalizeCriticalityHistory(
    nextData.historicoCriticidade ?? previous?.historicoCriticidade,
  );

  const scoreAnterior = getCriticalityScore(
    resolveErosionCriticality(previous),
    normalizeNumeric(previous?.score),
  );
  const scoreAtual = getCriticalityScore(criticalidade);
  const tendencia = trendFn(scoreAnterior, scoreAtual);
  const dataVistoria = String(
    nextData.dataVistoria
    || nextData.data_vistoria
    || nextData.dataCadastro
    || nextData.data
    || new Date().toISOString().slice(0, 10),
  ).trim();

  const snapshot = {
    timestamp: new Date().toISOString(),
    data_vistoria: dataVistoria,
    score_anterior: scoreAnterior,
    score_atual: scoreAtual,
    tendencia,
    intervencao_realizada: String(nextData.intervencaoRealizada || '').trim(),
    situacao: normalizeStatusFn
      ? buildSituacaoFromStatus(nextData.status, normalizeStatusFn)
      : 'ativo',
  };

  return [...previousHistory, snapshot].slice(-200);
}

// ─── Constants ───────────────────────────────────────────────────

export const EROSION_REMOVED_FIELDS_COMMON = [
  'profundidade',
  'declividadeClasse',
  'declividadeClassePdf',
  'faixaServidao',
  'areaTerceiros',
  'usoSolo',
  'soloSaturadoAgua',
];

export const EROSION_REMOVED_FIELDS_LEGACY = [
  'score_old', 'pontuacao_old', 'criticidade_old', 'impacto_old', 'risco_old',
  'criticality', 'criticalityV2', 'criticalidadeV2', 'criticidadeV2',
  'impacto', 'score', 'frequencia', 'intervencao',
  'fotosUrl', 'foto1', 'foto2', 'foto3', 'foto4', 'foto5', 'foto6',
];

export const LEGACY_CLEANUP_EXTRA_FIELDS = [
  'localTipo',
  'localDescricao',
  'localizacaoExposicao',
  'estruturaProxima',
];
