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

function parseContentDispositionFileName(headerValue = '') {
  const utf8Match = String(headerValue || '').match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const quotedMatch = String(headerValue || '').match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = String(headerValue || '').match(/filename=([^;]+)/i);
  return plainMatch?.[1] ? plainMatch[1].trim() : '';
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

export async function downloadProjectPhotoExport(projectId, token) {
  const authToken = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/photos/exports/${encodeURIComponent(token)}?download=1`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || 'Erro ao baixar exportacao de fotos do empreendimento.');
  }

  return {
    blob: await response.blob(),
    fileName: parseContentDispositionFileName(response.headers.get('Content-Disposition')) || `photos-${projectId}-${token}.zip`,
  };
}
