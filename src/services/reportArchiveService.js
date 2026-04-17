import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestArchive(url, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.message || 'Erro ao operar entrega.');
    error.status = response.status;
    error.code = errorData?.code || '';
    throw error;
  }

  return response.json();
}

export async function listArchives(compoundId) {
  const query = compoundId ? `?compoundId=${encodeURIComponent(compoundId)}` : '';
  const result = await requestArchive(`${API_BASE_URL}/report-archives${query}`, { method: 'GET' });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function getArchive(archiveId) {
  const result = await requestArchive(`${API_BASE_URL}/report-archives/${encodeURIComponent(archiveId)}`, { method: 'GET' });
  return result?.data || null;
}

export async function createCompoundDelivery(compoundId, { notes } = {}, meta = {}) {
  const result = await requestArchive(
    `${API_BASE_URL}/report-compounds/${encodeURIComponent(compoundId)}/deliver`,
    {
      method: 'POST',
      body: JSON.stringify({ data: { notes: notes || '' }, meta }),
    },
  );
  return result?.data || null;
}

export async function attachDeliveredMedia(archiveId, { mediaId, sha256, notes } = {}, meta = {}) {
  const result = await requestArchive(
    `${API_BASE_URL}/report-archives/${encodeURIComponent(archiveId)}/attach-delivered`,
    {
      method: 'POST',
      body: JSON.stringify({ data: { mediaId, sha256, notes: notes || '' }, meta }),
    },
  );
  return result?.data || null;
}

export async function computeFileSha256(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('Arquivo invalido para calculo de sha256.');
  }
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API indisponivel.');
  }
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
