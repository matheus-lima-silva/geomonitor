// Service do modulo PAEC — mesmo padrao do monthlyReportService.js
// (chamadas diretas, sem createCrudService: o fluxo e list + PUT versionado
// + generate/poll, alem de create/delete simples).

import { API_BASE_URL, getAuthToken } from '@app/utils/serviceFactory';
import { extractApiErrorMessage, isNetworkFailureError, normalizeRequestError } from '@app/utils/apiClient';

export class VersionConflictError extends Error {
  constructor(currentVersion) {
    super('A ficha foi alterada em outra sessão. Recarregue antes de salvar.');
    this.name = 'VersionConflictError';
    this.code = 'VERSION_CONFLICT';
    this.currentVersion = currentVersion;
  }
}

async function authFetch(path, { method = 'GET', body = null } = {}) {
  const token = await getAuthToken();
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (isNetworkFailureError(error)) {
      throw normalizeRequestError(error, 'Erro de rede ao acessar a API.');
    }
    throw error;
  }
}

async function parseSuccess(response, fallbackMessage) {
  if (!response.ok) {
    const message = await extractApiErrorMessage(response, fallbackMessage);
    throw new Error(message);
  }
  const result = await response.json();
  return result.data;
}

export async function fetchPlants() {
  const response = await authFetch('/paec/plants');
  return parseSuccess(response, 'Erro ao carregar as usinas.');
}

// Manifest (catalogo de campos/blocos/secoes) da revisao do modelo — vive no
// template, nao na ficha. O editor busca por templateId apos carregar a ficha.
export async function fetchTemplate(id) {
  const response = await authFetch(`/paec/templates/${encodeURIComponent(id)}`);
  return parseSuccess(response, 'Erro ao carregar o modelo institucional.');
}

export async function fetchPlant(id) {
  const response = await authFetch(`/paec/plants/${encodeURIComponent(id)}`);
  return parseSuccess(response, 'Erro ao carregar a ficha da usina.');
}

// Cria a ficha (opcionalmente copiando campos de outra usina via copyFromId).
export async function createPlant(data, meta = {}) {
  const response = await authFetch('/paec/plants', { method: 'POST', body: { data, meta } });
  if (response.status === 409) {
    const message = await extractApiErrorMessage(response, 'Já existe uma ficha para esta usina.');
    throw new Error(message);
  }
  if (response.status === 422) {
    const message = await extractApiErrorMessage(response, 'Nenhuma revisão ativa do modelo PAEC.');
    throw new Error(message);
  }
  return parseSuccess(response, 'Erro ao criar a ficha da usina.');
}

// PUT full-sync com version. Lanca VersionConflictError em 409 VERSION_CONFLICT.
export async function savePlant(id, data, meta = {}) {
  const response = await authFetch(`/paec/plants/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { data, meta },
  });
  if (response.status === 409) {
    let payload = null;
    try { payload = await response.json(); } catch { /* corpo nao-JSON */ }
    if (payload && payload.code === 'VERSION_CONFLICT') {
      throw new VersionConflictError(payload.currentVersion);
    }
    throw new Error((payload && payload.message) || 'Conflito ao salvar a ficha.');
  }
  return parseSuccess(response, 'Erro ao salvar a ficha.');
}

export async function removePlant(id) {
  const response = await authFetch(`/paec/plants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) {
    const message = await extractApiErrorMessage(response, 'Erro ao remover a ficha.');
    throw new Error(message);
  }
}

// Enfileira a geracao do DOCX no worker; retorna o job (com _links.self).
export async function generatePaec(id) {
  const response = await authFetch(`/paec/plants/${encodeURIComponent(id)}/generate`, { method: 'POST' });
  if (response.status === 422) {
    const message = await extractApiErrorMessage(response, 'O template desta ficha não está disponível.');
    throw new Error(message);
  }
  return parseSuccess(response, 'Erro ao iniciar a geração do documento.');
}

// Status do job de geracao (mesmo endpoint/desempacote do geo/monthly-report).
export async function getJobStatus(jobId) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/report-jobs/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const message = await extractApiErrorMessage(response, 'Erro ao consultar o status da geração.');
    throw new Error(message);
  }
  const result = await response.json();
  return result?.data || result;
}
