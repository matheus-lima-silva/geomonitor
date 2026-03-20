import { deleteField } from 'firebase/firestore';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import { buildCriticalityInputFromErosion } from '../features/shared/viewUtils';
import { extractApiErrorMessage, isNetworkFailureError, normalizeRequestError } from '../utils/apiClient';
import { API_BASE_URL, createCrudService, getAuthToken } from '../utils/serviceFactory';

const FALLBACK_PROD_API_BASE_URL = 'https://geomonitor-api.fly.dev/api';

function getApiBaseCandidates() {
  if (API_BASE_URL === FALLBACK_PROD_API_BASE_URL) return [API_BASE_URL];
  return [API_BASE_URL, FALLBACK_PROD_API_BASE_URL];
}

const erosionCrudService = createCrudService({
  resourcePath: 'erosions',
  itemName: 'Erosao',
  defaultIdGenerator: (payload) => String(payload?.id || '').trim(),
});

// ── Shared pure functions (single source of truth) ──────────────
import {
  normalizeText,
  normalizeFollowupHistory,
  normalizeNumeric,
  normalizeErosionInspectionIds,
  resolvePrimaryInspectionId,
  getInspectionDateScore,
  buildCriticalityTrend,
  normalizeCriticalityHistory,
  appendFollowupEvent,
  buildManualFollowupEvent,
  buildSituacaoFromStatus as _buildSituacaoFromStatus,
  buildCriticalityHistory as _buildCriticalityHistory,
  EROSION_REMOVED_FIELDS_COMMON,
  LEGACY_CLEANUP_EXTRA_FIELDS,
} from '../../shared/erosionHelpers';

// Re-export shared functions for consumers that import from this file
export {
  buildManualFollowupEvent,
  appendFollowupEvent,
  buildCriticalityTrend,
  normalizeCriticalityHistory,
};

export const EROSION_REMOVED_FIELDS = EROSION_REMOVED_FIELDS_COMMON;

// ── Wrappers that inject normalizeErosionStatus dependency ──────

function buildSituacaoFromStatus(status) {
  return _buildSituacaoFromStatus(status, normalizeErosionStatus);
}

function buildCriticalityHistory(previous, nextData, criticalidadeV2) {
  return _buildCriticalityHistory(previous, nextData, criticalidadeV2, {
    normalizeStatusFn: normalizeErosionStatus,
  });
}

function normalizeCriticalityCalculationPayload(calculation) {
  if (!calculation || typeof calculation !== 'object') return null;
  if (calculation.breakdown && typeof calculation.breakdown === 'object') {
    return calculation.breakdown;
  }
  return calculation;
}

// ── Subscriptions ───────────────────────────────────────────────

export function subscribeErosions(onData, onError) {
  return erosionCrudService.subscribe(onData, onError);
}

// ── API calls ───────────────────────────────────────────────────

export async function postCalculoErosao(payload = {}, options = {}) {
  try {
    const token = await getAuthToken();
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: payload })
    };

    let result = null;
    let lastNetworkError = null;

    for (const apiBase of getApiBaseCandidates()) {
      try {
        const response = await fetch(`${apiBase}/erosions/simulate`, requestOptions);
        if (!response.ok) {
          const message = await extractApiErrorMessage(response, 'Erro ao simular calculo via API.');
          throw new Error(message);
        }
        result = await response.json();
        lastNetworkError = null;
        break;
      } catch (error) {
        if (!isNetworkFailureError(error)) throw error;
        lastNetworkError = error;
      }
    }

    if (!result) {
      throw lastNetworkError || new Error('Erro ao simular calculo via API.');
    }

    const calculation = result.data;

    return {
      campos_calculados: normalizeCriticalityCalculationPayload(calculation),
      alertas_validacao: calculation.alertas_validacao || [],
    };
  } catch (error) {
    throw normalizeRequestError(
      error,
      'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
    );
  }
}

function buildLegacyFieldCleanupPatch() {
  const removedFields = [
    ...EROSION_REMOVED_FIELDS,
    ...LEGACY_CLEANUP_EXTRA_FIELDS,
  ];

  return removedFields.reduce((acc, field) => {
    acc[field] = deleteField();
    return acc;
  }, {});
}

export async function saveErosion(payload, meta = {}) {
  const result = await erosionCrudService.save(String(payload?.id || '').trim(), payload, meta);
  return result?.data?.id || String(payload?.id || '').trim();
}

export async function recalculateAndSaveErosion(erosion) {
  if (!erosion?.id) return null;
  const input = buildCriticalityInputFromErosion(erosion);
  const { campos_calculados } = await postCalculoErosao(input);
  if (!campos_calculados) return null;
  const previousCriticality = erosion.criticalidadeV2 || null;
  const historicoCriticidade = normalizeCriticalityHistory(erosion.historicoCriticidade);
  if (previousCriticality) {
    historicoCriticidade.push({
      ...previousCriticality,
      data: new Date().toISOString(),
      motivo: 'recalculo_v3',
    });
  }
  await saveErosion({
    id: erosion.id,
    criticalidadeV2: campos_calculados,
    historicoCriticidade,
    impacto: campos_calculados.legacy?.impacto || erosion.impacto,
    score: campos_calculados.criticidade_score ?? erosion.score,
    frequencia: campos_calculados.legacy?.frequencia || erosion.frequencia,
  }, { merge: true });
  return campos_calculados;
}

export async function saveErosionManualFollowupEvent(erosion, eventData, meta = {}) {
  const source = erosion && typeof erosion === 'object' ? erosion : null;
  if (!source?.id) {
    throw new Error('Erosao invalida para registro de evento manual.');
  }

  const manualEvent = buildManualFollowupEvent(eventData, { updatedBy: meta?.updatedBy });
  if (!manualEvent) {
    throw new Error('Dados do evento invalidos.');
  }

  const etapa = String(manualEvent?.obraEtapa || '').trim().toLowerCase();
  const shouldStabilize = manualEvent?.tipoEvento === 'obra'
    && (etapa === 'concluida' || etapa === 'concluída');
  const nextStatus = shouldStabilize ? 'Estabilizado' : normalizeErosionStatus(source.status);
  const nextInspectionIds = normalizeErosionInspectionIds(source);
  const primaryInspectionId = resolvePrimaryInspectionId(nextInspectionIds, meta?.inspections);

  await saveErosion({
    ...source,
    status: nextStatus,
    vistoriaId: primaryInspectionId || '',
    vistoriaIds: nextInspectionIds,
    acompanhamentosResumo: appendFollowupEvent(source.acompanhamentosResumo, manualEvent),
  }, {
    updatedBy: meta?.updatedBy,
    merge: true,
    skipAutoFollowup: true,
  });

  return {
    manualEvent,
    nextStatus,
  };
}

export function deleteErosion(erosionOrId) {
  return erosionCrudService.remove(erosionOrId);
}
