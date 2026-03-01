import {
  deleteDocById, loadDoc, saveDoc, subscribeCollection,
} from './firestoreClient';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import {
  appendFollowupEvent,
  buildCriticalityInputFromErosion,
  deriveErosionTypeFromTechnicalFields,
  buildFollowupEvent,
  normalizeErosionTechnicalFields,
  normalizeFollowupHistory,
  validateErosionTechnicalFields,
} from '../features/erosions/utils/erosionUtils';
import { resolveLocationCoordinatesForSave } from '../features/erosions/utils/erosionCoordinates';

export function subscribeErosions(onData, onError) {
  return subscribeCollection('erosions', onData, onError);
}

export async function saveErosion(payload, meta = {}) {
  const id = String(payload.id || '').trim() || `ERS-${Date.now()}`;
  const previous = meta.merge ? await loadDoc('erosions', id) : null;
  const criticality = payload.criticality || null;

  const locationResult = resolveLocationCoordinatesForSave(payload);
  if (!locationResult.ok) {
    throw new Error(locationResult.error || 'Coordenadas invalidas.');
  }

  const technicalValidation = validateErosionTechnicalFields(payload);
  if (!technicalValidation.ok) {
    throw new Error(technicalValidation.message || 'Campos tecnicos invalidos.');
  }
  const technical = technicalValidation.value || normalizeErosionTechnicalFields(payload);
  const criticalityInput = buildCriticalityInputFromErosion({
    ...payload,
    tiposFeicao: technical.tiposFeicao,
    larguraMaximaClasse: technical.larguraMaximaClasse,
    declividadeClasse: technical.declividadeClasse,
  });

  const fotosLinks = Array.isArray(payload.fotosLinks)
    ? payload.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

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
    locationCoordinates: locationResult.locationCoordinates,
    latitude: locationResult.latitude || '',
    longitude: locationResult.longitude || '',
    faixaServidao: payload.faixaServidao || '',
    areaTerceiros: payload.areaTerceiros || '',
    usoSolo: payload.usoSolo || '',
    tipo: deriveErosionTypeFromTechnicalFields({
      ...payload,
      tiposFeicao: technical.tiposFeicao,
    }),
    declividade: criticalityInput.declividade || '',
    largura: criticalityInput.largura || '',
    presencaAguaFundo: technical.presencaAguaFundo,
    tiposFeicao: technical.tiposFeicao,
    caracteristicasFeicao: technical.caracteristicasFeicao,
    larguraMaximaClasse: technical.larguraMaximaClasse,
    declividadeClasse: technical.declividadeClasse,
    // Backward compatibility during transition to canonical field name.
    declividadeClassePdf: technical.declividadeClasse,
    usosSolo: technical.usosSolo,
    usoSoloOutro: technical.usoSoloOutro,
    saturacaoPorAgua: technical.saturacaoPorAgua,
    // Backward compatibility for legacy consumers.
    soloSaturadoAgua: technical.saturacaoPorAgua,
    medidaPreventiva: payload.medidaPreventiva || '',
    fotosLinks,
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
