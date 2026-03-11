import { deleteDocById, loadDoc, saveDoc, subscribeCollection } from './firestoreClient';
import { deleteField } from 'firebase/firestore';
import { auth } from '../firebase/config';
import { normalizeErosionStatus } from '../features/shared/statusUtils';
import { fetchWithHateoas } from '../utils/apiClient';
function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeFollowupHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => item && typeof item === 'object').slice(-100);
}

export const EROSION_REMOVED_FIELDS = [
  'profundidade',
  'declividadeClasse',
  'declividadeClassePdf',
  'faixaServidao',
  'areaTerceiros',
  'usoSolo',
  'soloSaturadoAgua',
];

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

export function subscribeErosions(onData, onError) {
  return subscribeCollection('erosions', onData, onError);
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
  const primary = String(erosion?.vistoriaId || '').trim();
  const list = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  return [...new Set([primary, ...list.map((value) => String(value || '').trim())].filter(Boolean))];
}

function resolvePrimaryInspectionId(inspectionIds, inspections) {
  if (!Array.isArray(inspectionIds) || inspectionIds.length === 0) return '';
  const inspectionById = new Map((Array.isArray(inspections) ? inspections : [])
    .map((inspection) => [String(inspection?.id || '').trim(), inspection]));
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
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const response = await fetch(`${API_BASE_URL}/erosions/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ data: payload })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao simular calculo via API.');
  }

  const result = await response.json();
  const calculation = result.data;

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export async function saveErosion(payload, meta = {}) {
  if (payload?._links?.update) {
    return fetchWithHateoas(payload._links.update, { data: payload, meta }).then((res) => res.data.id);
  }

  const token = await auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login para salvar a erosão.');
  }

  // Chamar o back-end via API usando o token de autênticação passando Data e Meta
  const response = await fetch(`${API_BASE_URL}/erosions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ data: payload, meta })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao salvar a erosão via API.');
  }

  const result = await response.json();
  return result.data.id;
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
