import {
  deleteDocById, loadDoc, saveDoc, subscribeCollection,
} from './firestoreClient';
import { deleteField } from 'firebase/firestore';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import {
  EROSION_REMOVED_FIELDS,
  appendFollowupEvent,
  buildCriticalityInputFromErosion,
  deriveErosionTypeFromTechnicalFields,
  buildFollowupEvent,
  normalizeErosionTechnicalFields,
  normalizeFollowupHistory,
  stripRemovedErosionFields,
  validateErosionTechnicalFields,
} from '../features/erosions/utils/erosionUtils';
import { resolveLocationCoordinatesForSave } from '../features/erosions/utils/erosionCoordinates';
import {
  buildCriticalityTrend,
  calcular_criticidade,
  normalizeCriticalityHistory,
} from '../features/erosions/utils/criticalityV2';

export function subscribeErosions(onData, onError) {
  return subscribeCollection('erosions', onData, onError);
}

function buildSituacaoFromStatus(status) {
  const normalized = normalizeErosionStatus(status).toLowerCase();
  if (normalized === 'estabilizado') return 'estabilizado';
  if (normalized === 'monitoramento') return 'em_recuperacao';
  return 'ativo';
}

function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCriticalityHistory(previous, nextData, criticalidadeV2) {
  const previousHistory = normalizeCriticalityHistory(
    nextData.historicoCriticidade ?? previous?.historicoCriticidade,
  );

  const scoreAnterior = normalizeNumeric(
    previous?.criticalidadeV2?.criticidade_score ?? previous?.score,
  );
  const scoreAtual = normalizeNumeric(criticalidadeV2?.criticidade_score);
  const tendencia = buildCriticalityTrend(scoreAnterior, scoreAtual);
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
    situacao: buildSituacaoFromStatus(nextData.status),
  };

  return [...previousHistory, snapshot].slice(-200);
}

export async function postCalculoErosao(payload = {}, options = {}) {
  const calculation = calcular_criticidade(payload, options?.rulesConfig);
  return {
    campos_calculados: calculation,
    alertas_validacao: calculation.alertas_validacao || [],
  };
}

function buildLegacyFieldCleanupPatch() {
  const removedFields = [
    ...EROSION_REMOVED_FIELDS,
    'localTipo',
    'localDescricao',
    'localizacaoExposicao',
    'estruturaProxima',
  ];

  return removedFields.reduce((acc, field) => {
    acc[field] = deleteField();
    return acc;
  }, {});
}

export async function saveErosion(payload, meta = {}) {
  const sanitizedPayload = stripRemovedErosionFields(payload);
  const id = String(sanitizedPayload.id || '').trim() || `ERS-${Date.now()}`;
  const previous = meta.merge ? await loadDoc('erosions', id) : null;
  const criticality = sanitizedPayload.criticality || null;

  const locationResult = resolveLocationCoordinatesForSave(sanitizedPayload);
  if (!locationResult.ok) {
    throw new Error(locationResult.error || 'Coordenadas invalidas.');
  }

  const technicalValidation = validateErosionTechnicalFields(sanitizedPayload);
  if (!technicalValidation.ok) {
    throw new Error(technicalValidation.message || 'Campos tecnicos invalidos.');
  }

  const technical = technicalValidation.value || normalizeErosionTechnicalFields(sanitizedPayload);
  const criticalityInput = buildCriticalityInputFromErosion({
    ...sanitizedPayload,
    tiposFeicao: technical.tiposFeicao,
  });

  const criticalityResponse = sanitizedPayload.criticalidadeV2
    ? { campos_calculados: sanitizedPayload.criticalidadeV2, alertas_validacao: sanitizedPayload.alertsAtivos || [] }
    : await postCalculoErosao(criticalityInput, { rulesConfig: meta.rulesConfig });

  const criticalidadeV2 = criticalityResponse.campos_calculados || null;
  const fotosLinks = Array.isArray(sanitizedPayload.fotosLinks)
    ? sanitizedPayload.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const mergedInspectionIds = [
    String(sanitizedPayload.vistoriaId || '').trim(),
    ...(Array.isArray(sanitizedPayload.vistoriaIds) ? sanitizedPayload.vistoriaIds : []).map((item) => String(item || '').trim()),
    String(previous?.vistoriaId || '').trim(),
    ...(Array.isArray(previous?.vistoriaIds) ? previous.vistoriaIds : []).map((item) => String(item || '').trim()),
  ].filter(Boolean);

  const vistoriaIds = [...new Set(mergedInspectionIds)];

  const nextData = {
    ...sanitizedPayload,
    id,
    vistoriaId: String(sanitizedPayload.vistoriaId || '').trim(),
    ...(vistoriaIds.length > 0 ? { vistoriaIds } : {}),
    status: normalizeErosionStatus(sanitizedPayload.status),
    impacto: sanitizedPayload.impacto || criticality?.impacto || criticalidadeV2?.legacy?.impacto || 'Baixo',
    score: sanitizedPayload.score ?? criticality?.score ?? criticalidadeV2?.criticidade_score ?? 0,
    frequencia: sanitizedPayload.frequencia || criticality?.frequencia || criticalidadeV2?.legacy?.frequencia || '24 meses',
    intervencao: sanitizedPayload.intervencao || criticality?.intervencao || criticalidadeV2?.legacy?.intervencao || 'Monitoramento visual',
    localContexto: technical.localContexto,
    locationCoordinates: locationResult.locationCoordinates,
    latitude: locationResult.latitude || '',
    longitude: locationResult.longitude || '',
    tipo: deriveErosionTypeFromTechnicalFields({
      ...sanitizedPayload,
      tiposFeicao: technical.tiposFeicao,
    }),
    presencaAguaFundo: technical.presencaAguaFundo,
    tiposFeicao: technical.tiposFeicao,
    caracteristicasFeicao: technical.caracteristicasFeicao,
    usosSolo: technical.usosSolo,
    usoSoloOutro: technical.usoSoloOutro,
    saturacaoPorAgua: technical.saturacaoPorAgua,
    tipoSolo: technical.tipoSolo,
    profundidadeMetros: technical.profundidadeMetros,
    declividadeGraus: technical.declividadeGraus,
    distanciaEstruturaMetros: technical.distanciaEstruturaMetros,
    sinaisAvanco: technical.sinaisAvanco,
    vegetacaoInterior: technical.vegetacaoInterior,
    medidaPreventiva: sanitizedPayload.medidaPreventiva
      || criticalidadeV2?.lista_solucoes_sugeridas?.[0]
      || '',
    fotosLinks,
    criticalidadeV2,
    alertsAtivos: Array.isArray(sanitizedPayload.alertsAtivos)
      ? sanitizedPayload.alertsAtivos
      : (criticalityResponse.alertas_validacao || []),
    backfillEstimado: Boolean(sanitizedPayload.backfillEstimado),
  };

  const history = normalizeFollowupHistory(previous?.acompanhamentosResumo);
  const event = meta.skipAutoFollowup
    ? null
    : buildFollowupEvent(previous, nextData, {
      updatedBy: meta.updatedBy,
      isCreate: !previous,
      origem: meta.origem,
    });

  await saveDoc('erosions', id, {
    ...nextData,
    ...buildLegacyFieldCleanupPatch(),
    acompanhamentosResumo: appendFollowupEvent(nextData.acompanhamentosResumo ?? history, event),
    historicoCriticidade: buildCriticalityHistory(previous, nextData, criticalidadeV2),
  }, { ...meta, merge: true });

  return id;
}

export function deleteErosion(id) {
  return deleteDocById('erosions', id);
}
