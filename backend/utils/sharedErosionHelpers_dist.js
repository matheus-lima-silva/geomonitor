var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../shared/erosionHelpers.js
var erosionHelpers_exports = {};
__export(erosionHelpers_exports, {
  EROSION_REMOVED_FIELDS_COMMON: () => EROSION_REMOVED_FIELDS_COMMON,
  EROSION_REMOVED_FIELDS_LEGACY: () => EROSION_REMOVED_FIELDS_LEGACY,
  LEGACY_CLEANUP_EXTRA_FIELDS: () => LEGACY_CLEANUP_EXTRA_FIELDS,
  appendFollowupEvent: () => appendFollowupEvent,
  buildCriticalityHistory: () => buildCriticalityHistory,
  buildCriticalityTrend: () => buildCriticalityTrend,
  buildManualFollowupEvent: () => buildManualFollowupEvent,
  buildSituacaoFromStatus: () => buildSituacaoFromStatus,
  getCriticalityClass: () => getCriticalityClass,
  getCriticalityCode: () => getCriticalityCode,
  getCriticalityScore: () => getCriticalityScore,
  getInspectionDateScore: () => getInspectionDateScore,
  normalizeCriticalityHistory: () => normalizeCriticalityHistory,
  normalizeErosionInspectionIds: () => normalizeErosionInspectionIds,
  normalizeFollowupHistory: () => normalizeFollowupHistory,
  normalizeNumeric: () => normalizeNumeric,
  normalizeText: () => normalizeText,
  resolveErosionCriticality: () => resolveErosionCriticality,
  resolvePrimaryInspectionId: () => resolvePrimaryInspectionId,
  unwrapCriticalityPayload: () => unwrapCriticalityPayload
});
module.exports = __toCommonJS(erosionHelpers_exports);
function normalizeText(value) {
  return String(value || "").trim();
}
function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function unwrapCriticalityPayload(value) {
  if (!value || typeof value !== "object") return null;
  const nestedCandidates = [
    value.breakdown,
    value.campos_calculados,
    value.calculation,
    value.resultado
  ];
  for (let i = 0; i < nestedCandidates.length; i += 1) {
    const candidate = nestedCandidates[i];
    if (candidate && typeof candidate === "object") return candidate;
  }
  return value;
}
function resolveErosionCriticality(erosion) {
  if (!erosion || typeof erosion !== "object") return null;
  return unwrapCriticalityPayload(
    erosion.criticalidade ?? erosion.criticalidadeV2 ?? erosion.criticidadeV2 ?? erosion.criticalityV2 ?? erosion.criticality
  );
}
function getCriticalityCode(criticalidade, fallback = "") {
  const resolved = unwrapCriticalityPayload(criticalidade);
  return normalizeText(
    resolved?.codigo ?? resolved?.criticidade_codigo ?? resolved?.criticidadeCodigo ?? resolved?.criticality_code ?? resolved?.criticalityCode ?? fallback
  ).toUpperCase();
}
function getCriticalityClass(criticalidade, fallback = "") {
  const resolved = unwrapCriticalityPayload(criticalidade);
  return normalizeText(
    resolved?.criticidade_classe ?? resolved?.criticidadeClasse ?? resolved?.criticality_class ?? resolved?.criticalityClass ?? fallback
  );
}
function getCriticalityScore(criticalidade, fallback = null) {
  const resolved = unwrapCriticalityPayload(criticalidade);
  const normalized = normalizeNumeric(
    resolved?.criticidade_score ?? resolved?.criticidadeScore ?? resolved?.criticality_score ?? resolved?.criticalityScore
  );
  return normalized ?? fallback;
}
function normalizeFollowupHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => item && typeof item === "object").slice(-100);
}
function buildManualFollowupEvent(data, meta = {}) {
  const tipoEvento = normalizeText(data?.tipoEvento).toLowerCase();
  const usuario = normalizeText(meta?.updatedBy);
  if (tipoEvento === "obra") {
    const obraEtapa = normalizeText(data?.obraEtapa);
    const descricao = normalizeText(data?.descricao);
    if (!obraEtapa || !descricao) return null;
    const etapa = obraEtapa.toLowerCase();
    const etapaConcluida = etapa === "concluida" || etapa === "conclu\xEDda";
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      usuario,
      origem: "manual",
      tipoEvento: "obra",
      obraEtapa,
      descricao,
      ...etapaConcluida ? { statusNovo: "Estabilizado" } : {},
      resumo: `Obra - ${obraEtapa}: ${descricao}`
    };
  }
  if (tipoEvento === "autuacao") {
    const orgao = normalizeText(data?.orgao);
    const numeroOuDescricao = normalizeText(data?.numeroOuDescricao);
    const autuacaoStatus = normalizeText(data?.autuacaoStatus);
    if (!orgao || !numeroOuDescricao || !autuacaoStatus) return null;
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      usuario,
      origem: "manual",
      tipoEvento: "autuacao",
      orgao,
      numeroOuDescricao,
      autuacaoStatus,
      resumo: `Autuacao (${orgao}) - ${autuacaoStatus}: ${numeroOuDescricao}`
    };
  }
  return null;
}
function appendFollowupEvent(history, event) {
  const normalized = normalizeFollowupHistory(history);
  if (!event) return normalized;
  return [...normalized, event].slice(-100);
}
function buildCriticalityTrend(previousScore, currentScore) {
  if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) return "estavel";
  if (currentScore > previousScore) return "agravando";
  if (currentScore < previousScore) return "recuperando";
  return "estavel";
}
function normalizeCriticalityHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").slice(-200);
}
function getInspectionDateScore(inspection) {
  const candidates = [inspection?.dataFim, inspection?.dataInicio, inspection?.data];
  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = new Date(candidates[i]);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return null;
}
function normalizeErosionInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || "").trim();
  const list = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const pendencies = Array.isArray(erosion?.pendenciasVistoria) ? erosion.pendenciasVistoria : [];
  const fromPendencies = pendencies.map((item) => String(item?.vistoriaId || "").trim());
  return [...new Set([primary, ...list.map((v) => String(v || "").trim()), ...fromPendencies].filter(Boolean))];
}
function resolvePrimaryInspectionId(inspectionIds, inspections) {
  if (!Array.isArray(inspectionIds) || inspectionIds.length === 0) return "";
  const inspectionById = new Map(
    (Array.isArray(inspections) ? inspections : []).map((inspection) => [String(inspection?.id || "").trim(), inspection])
  );
  return [...inspectionIds].sort((a, b) => {
    const inspectionA = inspectionById.get(String(a || "").trim());
    const inspectionB = inspectionById.get(String(b || "").trim());
    const scoreA = getInspectionDateScore(inspectionA);
    const scoreB = getInspectionDateScore(inspectionB);
    if (scoreA !== null && scoreB !== null) return scoreB - scoreA;
    if (scoreA !== null) return -1;
    if (scoreB !== null) return 1;
    return String(b || "").localeCompare(String(a || ""));
  })[0];
}
function buildSituacaoFromStatus(status, normalizeStatusFn) {
  const normalized = normalizeStatusFn(status).toLowerCase();
  if (normalized === "estabilizado") return "estabilizado";
  if (normalized === "monitoramento") return "em_recuperacao";
  return "ativo";
}
function buildCriticalityHistory(previous, nextData, criticalidade, deps = {}) {
  const { buildCriticalityTrend: trendFn = buildCriticalityTrend, normalizeStatusFn } = deps;
  const previousHistory = normalizeCriticalityHistory(
    nextData.historicoCriticidade ?? previous?.historicoCriticidade
  );
  const scoreAnterior = getCriticalityScore(
    resolveErosionCriticality(previous),
    normalizeNumeric(previous?.score)
  );
  const scoreAtual = getCriticalityScore(criticalidade);
  const tendencia = trendFn(scoreAnterior, scoreAtual);
  const dataVistoria = String(
    nextData.dataVistoria || nextData.data_vistoria || nextData.dataCadastro || nextData.data || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  ).trim();
  const snapshot = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    data_vistoria: dataVistoria,
    score_anterior: scoreAnterior,
    score_atual: scoreAtual,
    tendencia,
    intervencao_realizada: String(nextData.intervencaoRealizada || "").trim(),
    situacao: normalizeStatusFn ? buildSituacaoFromStatus(nextData.status, normalizeStatusFn) : "ativo"
  };
  return [...previousHistory, snapshot].slice(-200);
}
var EROSION_REMOVED_FIELDS_COMMON = [
  "profundidade",
  "declividadeClasse",
  "declividadeClassePdf",
  "faixaServidao",
  "areaTerceiros",
  "usoSolo",
  "soloSaturadoAgua"
];
var EROSION_REMOVED_FIELDS_LEGACY = [
  "score_old",
  "pontuacao_old",
  "criticidade_old",
  "impacto_old",
  "risco_old",
  "criticality",
  "criticalityV2",
  "criticalidadeV2",
  "criticidadeV2",
  "impacto",
  "score",
  "frequencia",
  "intervencao",
  "fotosUrl",
  "foto1",
  "foto2",
  "foto3",
  "foto4",
  "foto5",
  "foto6"
];
var LEGACY_CLEANUP_EXTRA_FIELDS = [
  "localTipo",
  "localDescricao",
  "localizacaoExposicao",
  "estruturaProxima"
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EROSION_REMOVED_FIELDS_COMMON,
  EROSION_REMOVED_FIELDS_LEGACY,
  LEGACY_CLEANUP_EXTRA_FIELDS,
  appendFollowupEvent,
  buildCriticalityHistory,
  buildCriticalityTrend,
  buildManualFollowupEvent,
  buildSituacaoFromStatus,
  getCriticalityClass,
  getCriticalityCode,
  getCriticalityScore,
  getInspectionDateScore,
  normalizeCriticalityHistory,
  normalizeErosionInspectionIds,
  normalizeFollowupHistory,
  normalizeNumeric,
  normalizeText,
  resolveErosionCriticality,
  resolvePrimaryInspectionId,
  unwrapCriticalityPayload
});
