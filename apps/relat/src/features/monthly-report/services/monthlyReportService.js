// Service do Relatorio Mensal — chamadas diretas (nao usa createCrudService:
// o fluxo e by-period + PUT versionado + generate/poll, sem list/cache).
// Padrao de auth/erros igual aos services do geo (erosionService).

import { API_BASE_URL, getAuthToken } from '@app/utils/serviceFactory';
import { extractApiErrorMessage, isNetworkFailureError, normalizeRequestError } from '@app/utils/apiClient';

export class VersionConflictError extends Error {
  constructor(currentVersion) {
    super('O relatório foi alterado em outra sessão. Recarregue antes de salvar.');
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

// Garante e retorna o relatorio do periodo (cria vazio no backend se faltar).
export async function fetchByPeriod(year, month) {
  const response = await authFetch(`/monthly-reports/by-period?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
  return parseSuccess(response, 'Erro ao carregar o relatório do período.');
}

// PUT full-sync com version. Lanca VersionConflictError em 409 VERSION_CONFLICT.
export async function saveReport(id, data, meta = {}) {
  const response = await authFetch(`/monthly-reports/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { data, meta },
  });
  if (response.status === 409) {
    let payload = null;
    try { payload = await response.json(); } catch { /* corpo nao-JSON */ }
    if (payload && payload.code === 'VERSION_CONFLICT') {
      throw new VersionConflictError(payload.currentVersion);
    }
    throw new Error((payload && payload.message) || 'Conflito ao salvar o relatório.');
  }
  return parseSuccess(response, 'Erro ao salvar o relatório.');
}

// Enfileira a geracao do DOCX no worker; retorna o job (com _links.self).
export async function generateDocx(id) {
  const response = await authFetch(`/monthly-reports/${encodeURIComponent(id)}/generate`, { method: 'POST' });
  return parseSuccess(response, 'Erro ao iniciar a geração do documento.');
}

// Status do job de geracao (mesmo endpoint/desempacote do geo para polling).
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

// Config global (equipe + contrato) — singleton por usuario.
export async function fetchSettings() {
  const response = await authFetch('/monthly-report-settings');
  return parseSuccess(response, 'Erro ao carregar as configurações.');
}

export async function saveSettings(data, meta = {}) {
  const response = await authFetch('/monthly-report-settings', {
    method: 'PUT',
    body: { data, meta },
  });
  return parseSuccess(response, 'Erro ao salvar as configurações.');
}
