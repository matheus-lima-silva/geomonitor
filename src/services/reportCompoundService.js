import { API_BASE_URL, createCrudService, getAuthToken } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'report-compounds',
  itemName: 'Relatorio Composto',
  defaultIdGenerator: (payload) => String(payload?.id || `RC-${Date.now()}`).trim(),
});

export function subscribeReportCompounds(onData, onError) {
  return service.subscribe(onData, onError);
}

export async function listReportCompounds() {
  const result = await service.list();
  return Array.isArray(result?.data) ? result.data : [];
}

export function createReportCompound(payload, meta = {}) {
  return service.create(payload, meta, (item) => String(item?.id || `RC-${Date.now()}`).trim());
}

async function requestCompound(url, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || 'Erro ao operar relatorio composto.');
  }

  return response.json();
}

export async function addWorkspaceToReportCompound(compoundId, workspaceId, meta = {}) {
  return requestCompound(`${API_BASE_URL}/report-compounds/${encodeURIComponent(compoundId)}/add-workspace`, {
    method: 'POST',
    body: JSON.stringify({ data: { workspaceId }, meta }),
  });
}

export async function reorderReportCompound(compoundId, orderJson, meta = {}) {
  return requestCompound(`${API_BASE_URL}/report-compounds/${encodeURIComponent(compoundId)}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ data: { orderJson }, meta }),
  });
}

export async function runReportCompoundPreflight(compoundId) {
  return requestCompound(`${API_BASE_URL}/report-compounds/${encodeURIComponent(compoundId)}/preflight`, {
    method: 'POST',
  });
}

export async function generateReportCompound(compoundId) {
  return requestCompound(`${API_BASE_URL}/report-compounds/${encodeURIComponent(compoundId)}/generate`, {
    method: 'POST',
  });
}
