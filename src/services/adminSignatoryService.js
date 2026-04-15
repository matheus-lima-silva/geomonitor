import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestAdmin(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar signatario do usuario.');
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function listUserSignatarios(userId) {
  const result = await requestAdmin(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/signatarios`,
    { method: 'GET' },
  );
  return result?.data || [];
}

export async function createSignatarioForUser(userId, payload) {
  const result = await requestAdmin(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/signatarios`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return result?.data || null;
}

export async function updateSignatarioForUser(userId, sigId, payload) {
  const result = await requestAdmin(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/signatarios/${encodeURIComponent(sigId)}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
  return result?.data || null;
}

export async function deleteSignatarioForUser(userId, sigId) {
  await requestAdmin(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/signatarios/${encodeURIComponent(sigId)}`,
    { method: 'DELETE' },
  );
}
