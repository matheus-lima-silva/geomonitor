import { API_BASE_URL, getAuthToken } from '../../../utils/serviceFactory';
import {
  extractApiErrorMessage,
  normalizeRequestError,
  fetchWithHateoas,
} from '../../../utils/apiClient';

const ALERTS_ENDPOINT = `${API_BASE_URL}/admin/alerts`;

async function authorizedFetch(url, options = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error('Usuario nao autenticado.');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

export async function listAlerts({ status = 'pending', page = 1, limit = 20 } = {}) {
  const url = new URL(ALERTS_ENDPOINT);
  url.searchParams.set('status', status);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));

  try {
    const response = await authorizedFetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      const message = await extractApiErrorMessage(response, 'Erro ao carregar alertas.');
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

export async function acknowledgeAlert(alert) {
  const ackLink = alert?._links?.ack
    || { href: `${ALERTS_ENDPOINT}/${alert?.id}/ack`, method: 'POST' };

  try {
    return await fetchWithHateoas(ackLink);
  } catch (error) {
    throw normalizeRequestError(error, 'Nao foi possivel marcar o alerta como revisado.');
  }
}

export { fetchWithHateoas };
