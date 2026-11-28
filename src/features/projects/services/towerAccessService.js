// Acessos por torre do empreendimento (Fase 1b). A colecao e descoberta pelo
// projeto; previa, gravacao, edicao e remocao seguem os _links devolvidos.
import { API_BASE_URL } from '../../../utils/serviceFactory';
import { fetchWithHateoas } from '../../../utils/apiClient';

export function accessesCollectionLink(projectId) {
  return { href: `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/accesses`, method: 'GET' };
}

/** @returns {{ items: Array, links: object }} */
export async function listTowerAccesses(projectId) {
  const result = await fetchWithHateoas(accessesCollectionLink(projectId));
  return {
    items: Array.isArray(result?.data) ? result.data : [],
    links: result?._links || {},
  };
}

/** features: [{ id, name, geometry: LineString }] */
export async function previewTowerAccesses(links, features, source = {}) {
  const result = await fetchWithHateoas(links.preview, { data: { features, source } });
  return result?.data || { items: [], meta: {} };
}

export async function createTowerAccesses(links, items, replaceIds = []) {
  const result = await fetchWithHateoas(links.create, { data: { items, replaceIds } });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function updateTowerAccess(access, patch) {
  const result = await fetchWithHateoas(access._links.update, {
    data: {
      towerNumber: patch.towerNumber ?? access.towerNumber ?? null,
      kind: patch.kind ?? access.kind,
      name: patch.name ?? access.name ?? '',
      segments: patch.segments ?? access.segments,
    },
  });
  return result?.data || null;
}

export async function deleteTowerAccess(access) {
  return fetchWithHateoas(access._links.delete);
}
