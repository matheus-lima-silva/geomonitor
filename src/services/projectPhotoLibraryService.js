import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function requestProject(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar biblioteca de fotos do empreendimento.');
  }

  return response.json();
}

export async function listProjectPhotos(projectId, filters = {}) {
  const query = buildQueryString(filters);
  const result = await requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/photos${query}`, {
    method: 'GET',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function requestProjectPhotoExport(projectId, payload, meta = {}) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/photos/export`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}
