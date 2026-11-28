// Meio fisico por torre (Fases 3-5): relevo (Copernicus DEM), cobertura (MapBiomas,
// com WorldCover de reserva). Colecao descoberta pelo projeto; somente leitura.
import { API_BASE_URL } from '../../../utils/serviceFactory';
import { fetchWithHateoas } from '../../../utils/apiClient';

export async function listTowerEnvironment(projectId) {
  const result = await fetchWithHateoas({
    href: `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/tower-environment`,
    method: 'GET',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

/** Indexa por numero da torre (texto). */
export function indexByTower(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = String(item?.towerNumber ?? '').trim();
    if (key) map.set(key, item);
  });
  return map;
}
