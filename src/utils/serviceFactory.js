import { auth } from '../firebase/config';
import { fetchWithHateoas } from './apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function createCrudService({ resourcePath, itemName, defaultIdGenerator = (d) => String(d.id || '').trim() }) {
  const baseUrl = `${API_BASE_URL}/${resourcePath}`;

  async function getToken() {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Usuário não autenticado.');
    return token;
  }

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
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      }
      throw error;
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
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta });
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
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta });
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
        return fetchWithHateoas(_links.delete);
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
