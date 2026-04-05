import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestProject(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar dossie do empreendimento.');
  }

  return response.json();
}

export async function listProjectDossiers(projectId) {
  const result = await requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers`, {
    method: 'GET',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function createProjectDossier(projectId, payload, meta = {}) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function runProjectDossierPreflight(projectId, dossierId) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers/${encodeURIComponent(dossierId)}/preflight`, {
    method: 'POST',
  });
}

export async function generateProjectDossier(projectId, dossierId) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers/${encodeURIComponent(dossierId)}/generate`, {
    method: 'POST',
  });
}

export async function trashProjectDossier(projectId, dossierId) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers/${encodeURIComponent(dossierId)}/trash`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function restoreProjectDossier(projectId, dossierId) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers/${encodeURIComponent(dossierId)}/restore`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function deleteProjectDossier(projectId, dossierId) {
  return requestProject(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/dossiers/${encodeURIComponent(dossierId)}`, {
    method: 'DELETE',
  });
}
