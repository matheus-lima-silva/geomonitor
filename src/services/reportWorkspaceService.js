import { createCrudService } from '../utils/serviceFactory';
import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'report-workspaces',
  itemName: 'Workspace de Relatorio',
  defaultIdGenerator: (payload) => String(payload?.id || `RW-${Date.now()}`).trim(),
});

export function subscribeReportWorkspaces(onData, onError) {
  return service.subscribe(onData, onError);
}

export function createReportWorkspace(payload, meta = {}) {
  return service.create(payload, meta, (item) => String(item?.id || `RW-${Date.now()}`).trim());
}

export function updateReportWorkspace(id, payload, meta = {}, options = {}) {
  return service.update(id, payload, meta, options);
}

async function requestWorkspace(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar workspace de relatorio.');
  }

  return response.json();
}

export async function importReportWorkspace(workspaceId, payload, meta = {}) {
  return requestWorkspace(`${API_BASE_URL}/report-workspaces/${encodeURIComponent(workspaceId)}/import`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function listReportWorkspacePhotos(workspaceId) {
  const result = await requestWorkspace(`${API_BASE_URL}/report-workspaces/${encodeURIComponent(workspaceId)}/photos`, {
    method: 'GET',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function saveReportWorkspacePhoto(workspaceId, photoId, payload, meta = {}) {
  return requestWorkspace(`${API_BASE_URL}/report-workspaces/${encodeURIComponent(workspaceId)}/photos/${encodeURIComponent(photoId)}`, {
    method: 'PUT',
    body: JSON.stringify({ data: { ...payload, id: photoId }, meta }),
  });
}

export async function processWorkspaceKmz(workspaceId, data, meta = {}) {
  return requestWorkspace(`${API_BASE_URL}/report-workspaces/${encodeURIComponent(workspaceId)}/kmz/process`, {
    method: 'POST',
    body: JSON.stringify({ data, meta }),
  });
}
