import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestMetrics(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao carregar metricas administrativas.');
  }

  return response.json();
}

export async function getAdminTotals() {
  const result = await requestMetrics(`${API_BASE_URL}/admin/metrics/totals`, { method: 'GET' });
  return result?.data || null;
}

export async function getAdminActivity() {
  const result = await requestMetrics(`${API_BASE_URL}/admin/metrics/activity`, { method: 'GET' });
  return result?.data || null;
}

export async function getAdminTopUsers(limit = 10) {
  const url = `${API_BASE_URL}/admin/metrics/top-users?limit=${encodeURIComponent(limit)}`;
  const result = await requestMetrics(url, { method: 'GET' });
  return result?.data || null;
}

export async function getAdminHealth() {
  const result = await requestMetrics(`${API_BASE_URL}/admin/metrics/health`, { method: 'GET' });
  return result?.data || null;
}
