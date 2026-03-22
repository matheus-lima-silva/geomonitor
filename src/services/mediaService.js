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
    throw new Error(errorData?.message || 'Erro ao operar midia.');
  }

  return response.json();
}

function isLocalApiUpload(uploadDescriptor = {}) {
  const href = String(uploadDescriptor?.href || '').trim();
  return href.startsWith(API_BASE_URL) || href.startsWith('/');
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
    throw new Error(fallbackMessage);
  }

  return response;
}
