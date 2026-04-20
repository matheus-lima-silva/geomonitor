import { API_BASE_URL, getAuthToken } from '../../../utils/serviceFactory';
import { fetchWithHateoas } from '../../../utils/apiClient';
import { extractApiErrorMessage, normalizeRequestError } from '../../../utils/apiClient';

// Endpoints fixos (nao HATEOAS-descoberto) porque sao ponto de entrada do modulo.
// Apos a primeira resposta, _links.self devolve o mesmo caminho e fluxos
// subsequentes (re-executar, pagina proxima do audit) podem usar fetchWithHateoas.
const EXECUTE_ENDPOINT = `${API_BASE_URL}/admin/sql/execute`;
const AUDIT_ENDPOINT = `${API_BASE_URL}/admin/sql/audit`;

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
