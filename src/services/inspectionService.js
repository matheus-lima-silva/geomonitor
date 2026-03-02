import { subscribeCollection } from './firestoreClient';
import { auth } from '../firebase/config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function subscribeInspections(onData, onError) {
  return subscribeCollection('inspections', onData, onError);
}

export async function saveInspection(inspection, meta = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  // The id is generated on the backend if not provided.
  const response = await fetch(`${API_BASE_URL}/inspections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ data: inspection, meta })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao salvar vistoria via API.');
  }

  const result = await response.json();
  return result.data.id;
}

export async function deleteInspection(id) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const response = await fetch(`${API_BASE_URL}/inspections/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao deletar vistoria via API.');
  }
}
