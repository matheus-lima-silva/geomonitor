import {
  deleteDocById, loadDoc, saveDoc, subscribeCollection,
} from './firestoreClient';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import {
  appendFollowupEvent,
  buildFollowupEvent,
  normalizeFollowupHistory,
} from '../features/erosions/utils/erosionUtils';

export function subscribeErosions(onData, onError) {
  return subscribeCollection('erosions', onData, onError);
}

export async function saveErosion(payload, meta = {}) {
  const id = String(payload.id || '').trim() || `ERS-${Date.now()}`;
  const previous = meta.merge ? await loadDoc('erosions', id) : null;
  const criticality = payload.criticality || null;
  const mergedInspectionIds = [
    String(payload.vistoriaId || '').trim(),
    ...(Array.isArray(payload.vistoriaIds) ? payload.vistoriaIds : []).map((item) => String(item || '').trim()),
    String(previous?.vistoriaId || '').trim(),
    ...(Array.isArray(previous?.vistoriaIds) ? previous.vistoriaIds : []).map((item) => String(item || '').trim()),
  ].filter(Boolean);
  const vistoriaIds = [...new Set(mergedInspectionIds)];
  const nextData = {
    ...payload,
    id,
    vistoriaId: String(payload.vistoriaId || '').trim(),
    ...(vistoriaIds.length > 0 ? { vistoriaIds } : {}),
    status: normalizeErosionStatus(payload.status),
    impacto: payload.impacto || criticality?.impacto || 'Baixo',
    score: payload.score || criticality?.score || 1,
    frequencia: payload.frequencia || criticality?.frequencia || '24 meses',
    intervencao: payload.intervencao || criticality?.intervencao || 'Monitoramento visual',
    localTipo: payload.localTipo || '',
    localDescricao: payload.localDescricao || '',
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
    acompanhamentosResumo: appendFollowupEvent(nextData.acompanhamentosResumo ?? history, event),
  }, { ...meta, merge: true });
  return id;
}

export function deleteErosion(id) {
  return deleteDocById('erosions', id);
}
