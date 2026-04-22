import { API_BASE_URL, getAuthToken } from '../../../utils/serviceFactory';

// Service de condicionantes de LO. Usa API_BASE_URL + fetch direto (mesmo
// padrao de licenseAttachmentService.js). Nao usa fetchWithHateoas porque
// construiamos href relativo sem preferredBaseUrl, o que fazia o navegador
// resolver contra window.location.origin (o dominio do frontend) e receber
// o index.html do SPA — erro "Unexpected token '<', '<!doctype '...".

async function request(url, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data?.message || 'Erro na API de condicionantes da LO.');
    err.status = response.status;
    err.code = data?.code;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listConditions(licenseId) {
  const id = String(licenseId || '').trim();
  if (!id) return [];
  const res = await request(`${API_BASE_URL}/licenses/${encodeURIComponent(id)}/conditions`, {
    method: 'GET',
  });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function createCondition(licenseId, data) {
  const id = String(licenseId || '').trim();
  if (!id) throw new Error('licenseId obrigatorio.');
  const res = await request(`${API_BASE_URL}/licenses/${encodeURIComponent(id)}/conditions`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
  return res?.data || null;
}

export async function bulkReplaceConditions(licenseId, items) {
  const id = String(licenseId || '').trim();
  if (!id) throw new Error('licenseId obrigatorio.');
  const res = await request(`${API_BASE_URL}/licenses/${encodeURIComponent(id)}/conditions`, {
    method: 'PUT',
    body: JSON.stringify({ data: Array.isArray(items) ? items : [] }),
  });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function updateCondition(condition, patch) {
  const condId = String(condition?.id || '').trim();
  if (!condId) throw new Error('condition.id obrigatorio.');
  const res = await request(`${API_BASE_URL}/license-conditions/${encodeURIComponent(condId)}`, {
    method: 'PUT',
    body: JSON.stringify({ data: patch }),
  });
  return res?.data || null;
}

export async function deleteCondition(condition) {
  const condId = String(condition?.id || '').trim();
  if (!condId) throw new Error('condition.id obrigatorio.');
  await request(`${API_BASE_URL}/license-conditions/${encodeURIComponent(condId)}`, {
    method: 'DELETE',
  });
}
