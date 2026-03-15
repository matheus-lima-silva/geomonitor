import { auth } from '../firebase/config';
import { fetchWithHateoas, normalizeRequestError } from './apiClient';

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const hasWindow = typeof window !== 'undefined';
  const hostname = hasWindow ? String(window.location.hostname || '').toLowerCase() : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (configured) {
    const pointsToLocal = /localhost|127\.0\.0\.1/i.test(configured);
    if (!isLocalHost && pointsToLocal) {
      return 'https://geomonitor-api.fly.dev/api';
    }
    return configured;
  }

  return isLocalHost ? 'http://localhost:8080/api' : 'https://geomonitor-api.fly.dev/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function getAuthToken() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');
  return token;
}

export function createCrudService({ resourcePath, itemName, defaultIdGenerator = (d) => String(d.id || '').trim() }) {
  const baseUrl = `${API_BASE_URL}/${resourcePath}`;

  const getToken = getAuthToken;

  async function fetchWithToken(url, options) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        let message = `Erro na operação (${itemName}).`;
        try {
          const errorData = await response.json();
          if (errorData?.message) message = errorData.message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      return response.json();
    } catch (error) {
      throw normalizeRequestError(
        error,
        'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
      );
    }
  }

  return {
    async create(data, meta = {}, generateId = defaultIdGenerator) {
      const id = generateId(data);
      if (!id) throw new Error(`${itemName} precisa de ID`);

      const token = await getToken();
      return fetchWithToken(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async update(id, data, meta = {}) {
      if (data?._links?.update) {
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
      }

      const token = await getToken();
      return fetchWithToken(`${baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async save(id, data, meta = {}) {
      if (data?._links?.update) {
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
      }

      const token = await getToken();
      const fetchMethod = meta.merge ? 'PUT' : 'POST';
      const url = meta.merge ? `${baseUrl}/${id}` : baseUrl;
      
      return fetchWithToken(url, {
        method: fetchMethod,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async remove(itemOrId) {
      const _links = itemOrId?._links || itemOrId;
      if (_links?.delete) {
        return fetchWithHateoas(_links.delete, null, API_BASE_URL);
      }
      const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
      const token = await getToken();
      return fetchWithToken(`${baseUrl}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  };
}
