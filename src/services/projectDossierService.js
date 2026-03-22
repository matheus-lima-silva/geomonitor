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
