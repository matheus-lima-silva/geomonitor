import {
  subscribeOperatingLicenses as subscribeOperatingLicensesFeature,
} from '../features/licenses/services/licenseService';
import { auth } from '../firebase/config';
import { fetchWithHateoas } from '../utils/apiClient';

export function subscribeOperatingLicenses(onData, onError) {
  return subscribeOperatingLicensesFeature(onData, onError);
}

export async function saveOperatingLicense(id, payload, meta = {}) {
  if (payload?._links?.update) {
    return fetchWithHateoas(payload._links.update, { data: { ...payload, id }, meta });
  }

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const fetchMethod = meta.merge ? 'PUT' : 'POST';
  const url = meta.merge
    ? `http://localhost:8080/api/licenses/${id}`
    : 'http://localhost:8080/api/licenses';

  const response = await fetch(url, {
    method: fetchMethod,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ data: { ...payload, id }, meta })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao salvar licença via API.');
  }

  return response.json();
}

export async function deleteOperatingLicense(licenseOrId) {
  const _links = licenseOrId?._links || licenseOrId;
  if (_links?.delete) {
    return fetchWithHateoas(_links.delete);
  }
  const id = typeof licenseOrId === 'object' ? licenseOrId.id : licenseOrId;

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const response = await fetch(`http://localhost:8080/api/licenses/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao deletar licença via API.');
  }
}
