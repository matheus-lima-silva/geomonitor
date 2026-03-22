import { API_BASE_URL, createCrudService, getAuthToken } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'users',
  itemName: 'Utilizador'
});

export function subscribeUsers(onData, onError) {
  return service.subscribe(onData, onError);
}

export function saveUser(id, payload, meta = {}) {
  return service.save(id, { ...payload, id }, { ...meta, merge: true });
}

export function deleteUser(id) {
  return service.remove(id);
}

async function requestUser(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar perfil do utilizador.');
  }

  return response.json();
}

export async function getCurrentUserProfile() {
  const result = await requestUser(`${API_BASE_URL}/users/me`, { method: 'GET' });
  return result?.data || null;
}

export async function bootstrapCurrentUserProfile(payload, meta = {}) {
  const result = await requestUser(`${API_BASE_URL}/users/bootstrap`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
  return result?.data || null;
}
