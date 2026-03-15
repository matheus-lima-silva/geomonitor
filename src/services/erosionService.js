import { deleteDocById, loadDoc, saveDoc, subscribeCollection } from './firestoreClient';
import { deleteField } from 'firebase/firestore';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import { extractApiErrorMessage, fetchWithHateoas, normalizeRequestError } from '../utils/apiClient';
import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

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

// ── Subscriptions ───────────────────────────────────────────────

export function subscribeErosions(onData, onError) {
  return subscribeCollection('erosions', onData, onError);
}

// ── API calls ───────────────────────────────────────────────────

export async function postCalculoErosao(payload = {}, options = {}) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/erosions/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: payload })
    });

    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao simular calculo via API.');
      throw new Error(message);
    }

    const result = await response.json();
    const calculation = result.data;

    return {
      campos_calculados: calculation,
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
  try {
    if (payload?._links?.update) {
      return fetchWithHateoas(payload._links.update, { data: payload, meta }, API_BASE_URL).then((res) => res.data.id);
    }

    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/erosions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: payload, meta })
    });

    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao salvar a erosao via API.');
      throw new Error(message);
    }

    const result = await response.json();
    return result.data.id;
  } catch (error) {
    throw normalizeRequestError(
      error,
      'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
    );
  }
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

export function deleteErosion(id) {
  return deleteDocById('erosions', id);
}
