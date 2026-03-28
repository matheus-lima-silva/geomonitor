import { API_BASE_URL, getAuthToken } from '../utils/serviceFactory';

async function requestTemplates(url, options = {}) {
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
    throw new Error(errorData?.message || 'Erro ao operar templates de relatorio.');
  }

  return response.json();
}

export async function listReportTemplates() {
  const result = await requestTemplates(`${API_BASE_URL}/report-templates`, {
    method: 'GET',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function createReportTemplate(payload, meta = {}) {
  return requestTemplates(`${API_BASE_URL}/report-templates`, {
    method: 'POST',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function updateReportTemplate(id, payload, meta = {}) {
  return requestTemplates(`${API_BASE_URL}/report-templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ data: payload, meta }),
  });
}

export async function deleteReportTemplate(id) {
  return requestTemplates(`${API_BASE_URL}/report-templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function activateReportTemplate(id) {
  return requestTemplates(`${API_BASE_URL}/report-templates/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
  });
}
