import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

/**
 * Service de membros de report-workspace. Expoe as tres operacoes do
 * backend em rotas REST sob /report-workspaces/:id/members.
 *
 * Sem polling/subscription — o modal de UI chama uma vez ao abrir e
 * rebusca apos cada mutacao. Para detalhes de autorizacao, ver o
 * middleware workspaceAccess no backend: apenas owner/editor locais
 * ou superusers globais podem mutar a lista.
 */

async function requestMembers(url, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.message || 'Erro na operacao de membros do workspace.');
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function listWorkspaceMembers(workspaceId) {
  const encoded = encodeURIComponent(workspaceId);
  const result = await requestMembers(`${API_BASE_URL}/report-workspaces/${encoded}/members`, {
    method: 'GET',
  });
  // Backend devolve { status, data: [...members], _links }. Retornamos a
  // lista + os links do envelope (a UI usa _links.add para decidir se
  // mostra o formulario de adicao).
  return {
    members: Array.isArray(result?.data) ? result.data : [],
    links: result?._links || {},
  };
}

export async function addWorkspaceMember(workspaceId, { userId, role }) {
  const encoded = encodeURIComponent(workspaceId);
  const result = await requestMembers(`${API_BASE_URL}/report-workspaces/${encoded}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
  return result?.data || null;
}

export async function removeWorkspaceMember(workspaceId, userId) {
  const encodedWs = encodeURIComponent(workspaceId);
  const encodedUser = encodeURIComponent(userId);
  await requestMembers(`${API_BASE_URL}/report-workspaces/${encodedWs}/members/${encodedUser}`, {
    method: 'DELETE',
  });
  return true;
}
