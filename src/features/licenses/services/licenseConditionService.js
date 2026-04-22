import { fetchWithHateoas } from '../../../utils/apiClient';

// Service de condicionantes de LO. Nao usa createCrudService porque as rotas
// mais usadas sao nested (/api/licenses/:id/conditions) e bulkReplace.
// Tudo passa por fetchWithHateoas respeitando o contrato HATEOAS.

function makeLink(href, method) {
    return { href, method };
}

function getBaseUrl() {
    // Mesma estrategia de outros services: o fetchWithHateoas usa preferredBaseUrl
    // ou cai em FALLBACK_PROD_API_BASE_URL. Aqui passamos href relativo e deixamos
    // o client resolver.
    return '';
}

export async function listConditions(licenseId) {
    const link = makeLink(`/api/licenses/${encodeURIComponent(licenseId)}/conditions`, 'GET');
    const res = await fetchWithHateoas(link, null, getBaseUrl());
    return Array.isArray(res?.data) ? res.data : [];
}

export async function createCondition(licenseId, data) {
    const link = makeLink(`/api/licenses/${encodeURIComponent(licenseId)}/conditions`, 'POST');
    const res = await fetchWithHateoas(link, { data }, getBaseUrl());
    return res?.data || null;
}

export async function bulkReplaceConditions(licenseId, items) {
    const link = makeLink(`/api/licenses/${encodeURIComponent(licenseId)}/conditions`, 'PUT');
    const res = await fetchWithHateoas(link, { data: items }, getBaseUrl());
    return Array.isArray(res?.data) ? res.data : [];
}

export async function updateCondition(condition, patch) {
    const link = condition?._links?.update || makeLink(`/api/license-conditions/${encodeURIComponent(condition?.id || '')}`, 'PUT');
    const res = await fetchWithHateoas(link, { data: patch }, getBaseUrl());
    return res?.data || null;
}

export async function deleteCondition(condition) {
    const link = condition?._links?.delete || makeLink(`/api/license-conditions/${encodeURIComponent(condition?.id || '')}`, 'DELETE');
    await fetchWithHateoas(link, null, getBaseUrl());
}
