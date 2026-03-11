import { subscribeProjects as subscribeProjectsFeature, deleteProject as legacyDelete } from '../features/projects/services/projectService';
import { auth } from '../firebase/config';
import { fetchWithHateoas } from '../utils/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function subscribeProjects(onData, onError) {
  return subscribeProjectsFeature(onData, onError);
}

export async function createProject(project, meta = {}) {
  const id = String(project.id || '').trim().toUpperCase();
  if (!id) throw new Error('Projeto precisa de ID');

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ data: { ...project, id }, meta })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao criar projeto via API.');
  }

  return { id };
}

export async function updateProject(id, project, meta = {}) {
  if (project?._links?.update) {
    return fetchWithHateoas(project._links.update, { data: project, meta }).then((res) => ({ id: res.data.id }));
  }

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  // HATEOAS / REST Standard HTTP PUT
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ data: project, meta })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao atualizar projeto via API.');
  }

  return { id };
}

export async function removeProject(projectOrId) {
  const _links = projectOrId?._links || projectOrId;
  if (_links?.delete) {
    return fetchWithHateoas(_links.delete);
  }
  const id = typeof projectOrId === 'object' ? projectOrId.id : projectOrId;

  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado.');

  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erro ao deletar projeto via API.');
  }
}
