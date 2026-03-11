import { subscribeCollection } from './firestoreClient';
import { auth } from '../firebase/config';
import { fetchWithHateoas } from '../utils/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function subscribeInspections(onData, onError) {
  return subscribeCollection('inspections', onData, onError);
}

export async function saveInspection(inspection, meta = {}) {
  if (inspection?._links?.update) {
    return fetchWithHateoas(inspection._links.update, { data: inspection, meta }).then((res) => res.data.id || '');
  }

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ data: inspection, meta })
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
  }

  if (!response.ok) {
    let message = 'Erro ao salvar vistoria via API.';
    try {
      const errorData = await response.json();
      if (errorData?.message) message = errorData.message;
    } catch { /* response body not JSON */ }
    throw new Error(message);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Resposta inesperada do servidor ao salvar vistoria.');
  }
  return result?.data?.id || '';
}

export async function deleteInspection(inspectionOrId) {
  const _links = inspectionOrId?._links || inspectionOrId;
  if (_links?.delete) {
    return fetchWithHateoas(_links.delete);
  }
  const id = typeof inspectionOrId === 'object' ? inspectionOrId.id : inspectionOrId;

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/inspections/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
  }

  if (!response.ok) {
    let message = 'Erro ao deletar vistoria via API.';
    try {
      const errorData = await response.json();
      if (errorData?.message) message = errorData.message;
    } catch { /* response body not JSON */ }
    throw new Error(message);
  }
}
