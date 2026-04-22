import { API_BASE_URL, getAuthToken } from '../../../utils/serviceFactory';
import { fetchWithHateoas } from '../../../utils/apiClient';
import { extractApiErrorMessage, normalizeRequestError } from '../../../utils/apiClient';

// Endpoints fixos (nao HATEOAS-descoberto) porque sao ponto de entrada do modulo.
// Apos a primeira resposta, _links.self devolve o mesmo caminho e fluxos
// subsequentes (re-executar, pagina proxima do audit) podem usar fetchWithHateoas.
const EXECUTE_ENDPOINT = `${API_BASE_URL}/admin/sql/execute`;
const AUDIT_ENDPOINT = `${API_BASE_URL}/admin/sql/audit`;
const SNIPPETS_ENDPOINT = `${API_BASE_URL}/admin/sql/snippets`;

async function authorizedFetch(url, options = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error('Usuario nao autenticado.');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

export async function executeSql(sql) {
  const token = await getAuthToken();
  if (!token) throw new Error('Usuario nao autenticado.');

  try {
    const response = await fetch(EXECUTE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ data: { sql } }),
    });

    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao executar SQL.');
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    return payload?.data || null;
  } catch (error) {
    if (error?.status) throw error;
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}

export async function listAudit({ page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error('Usuario nao autenticado.');

  const url = new URL(AUDIT_ENDPOINT);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao carregar historico SQL.');
      throw new Error(message);
    }

    const payload = await response.json();
    return {
      items: Array.isArray(payload?.data) ? payload.data : [],
      pagination: payload?.pagination || { page, limit, total: 0, totalPages: 1 },
      links: payload?._links || {},
    };
  } catch (error) {
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}

// Re-exporta fetchWithHateoas para chamadas de paginacao do audit usando _links.
export { fetchWithHateoas };

// ---------------------------------------------------------------------------
// Snippets SQL salvos (globais entre admins).
// ---------------------------------------------------------------------------

export async function listSnippets() {
  try {
    const response = await authorizedFetch(SNIPPETS_ENDPOINT, { method: 'GET' });
    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao carregar snippets.');
      throw new Error(message);
    }
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch (error) {
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}

export async function createSnippet({ name, sqlText, description = null }) {
  try {
    const response = await authorizedFetch(SNIPPETS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ data: { name, sqlText, description } }),
    });
    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao criar snippet.');
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    return payload?.data || null;
  } catch (error) {
    if (error?.status) throw error;
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}

export async function updateSnippet(snippet, { name, sqlText, description } = {}) {
  const link = snippet?._links?.update;
  if (!link?.href) throw new Error('Link de atualizacao ausente no snippet.');
  try {
    const body = {};
    if (name !== undefined) body.name = name;
    if (sqlText !== undefined) body.sqlText = sqlText;
    if (description !== undefined) body.description = description;
    return await fetchWithHateoas(link, { data: body });
  } catch (error) {
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}

export async function deleteSnippet(snippet) {
  const link = snippet?._links?.delete;
  if (!link?.href) throw new Error('Link de remocao ausente no snippet.');
  try {
    return await fetchWithHateoas(link);
  } catch (error) {
    throw normalizeRequestError(error, 'Nao foi possivel conectar ao servidor.');
  }
}
