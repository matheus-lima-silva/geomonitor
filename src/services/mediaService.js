import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestMedia(url, options = {}) {
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
    const error = new Error(errorData?.message || 'Erro ao operar midia.');
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function isLocalApiUpload(uploadDescriptor = {}) {
  const href = String(uploadDescriptor?.href || '').trim();
  if (!href) return false;
  if (href.startsWith('/')) return true;

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const targetUrl = new URL(href, fallbackOrigin);
    const apiBaseUrl = new URL(API_BASE_URL, fallbackOrigin);
    return targetUrl.origin === apiBaseUrl.origin;
  } catch {
    return href.startsWith(API_BASE_URL);
  }
}

function isLocalAccessUrl(url = '') {
  const href = String(url || '').trim();
  if (!href) return false;
  if (href.startsWith('/')) return true;

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const targetUrl = new URL(href, fallbackOrigin);
    const apiBaseUrl = new URL(API_BASE_URL, fallbackOrigin);
    return targetUrl.origin === apiBaseUrl.origin;
  } catch {
    return href.startsWith(API_BASE_URL);
  }
}

export async function createMediaUpload(payload, meta = {}) {
  return requestMedia(`${API_BASE_URL}/media/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function completeMediaUpload(payload, meta = {}) {
  return requestMedia(`${API_BASE_URL}/media/complete`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function uploadMediaBinary(uploadDescriptor, file) {
  if (!uploadDescriptor?.href || !uploadDescriptor?.method) {
    throw new Error('Upload de midia invalido.');
  }

  const isLocal = isLocalApiUpload(uploadDescriptor);
  const headers = {
    ...(uploadDescriptor.headers || {}),
  };

  if (!headers['Content-Type'] && file?.type) {
    headers['Content-Type'] = file.type;
  }

  if (isLocal) {
    const token = await getAuthToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(uploadDescriptor.href, {
    method: uploadDescriptor.method,
    headers,
    body: file,
  });

  if (!response.ok) {
    const fallbackMessage = isLocal
      ? 'Erro ao enviar midia para o backend.'
      : 'Erro ao enviar midia para o storage assinado.';
    const error = new Error(fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return response;
}

// Resolve a URL assinada diretamente consultando /access-url. Util quando
// precisamos da URL externa (ex.: <img src=...> para Tigris/S3 ou PDF print).
// Para backend local onde o navegador nao consegue passar Authorization no
// <img>, prefira `downloadMediaAsset` + URL.createObjectURL.
export async function resolveMediaAccessUrl(mediaId) {
  const result = await requestMedia(`${API_BASE_URL}/media/${encodeURIComponent(mediaId)}/access-url`, {
    method: 'GET',
  });
  const accessUrl = String(result?.data?.accessUrl || '').trim();
  if (!accessUrl) {
    throw new Error('URL de acesso da midia invalida.');
  }
  const expiresAtRaw = result?.data?.expiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).getTime() : null;
  return {
    accessUrl,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    local: isLocalAccessUrl(accessUrl),
    backend: result?.data?.backend || null,
  };
}

export async function downloadMediaAsset(mediaId) {
  const result = await requestMedia(`${API_BASE_URL}/media/${encodeURIComponent(mediaId)}/access-url`, {
    method: 'GET',
  });

  const accessUrl = String(result?.data?.accessUrl || '').trim();
  if (!accessUrl) {
    throw new Error('URL de acesso da midia invalida.');
  }

  const headers = {};
  if (isLocalAccessUrl(accessUrl)) {
    const token = await getAuthToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(accessUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Erro ao baixar a midia.');
  }

  return {
    blob: await response.blob(),
    contentType: String(response.headers.get('Content-Type') || ''),
  };
}
