// Normalizador das fotos principais de uma erosao.
// fotosPrincipais e um array de ate 6 referencias { photoId, workspaceId,
// mediaAssetId, caption?, sortOrder }. Persistido no payload JSONB da erosao.

export const EROSION_PHOTOS_PRINCIPAIS_LIMIT = 6;

function asString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function sanitizeCaption(caption) {
  const text = asString(caption);
  if (!text) return undefined;
  return text.length > 500 ? text.slice(0, 500) : text;
}

export function normalizeFotoPrincipal(entry, fallbackSortOrder = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const photoId = asString(entry.photoId || entry.id);
  const workspaceId = asString(entry.workspaceId);
  const mediaAssetId = asString(entry.mediaAssetId);
  if (!photoId || !workspaceId || !mediaAssetId) return null;
  const sortOrderRaw = Number(entry.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw)
    ? Math.min(EROSION_PHOTOS_PRINCIPAIS_LIMIT - 1, Math.max(0, Math.trunc(sortOrderRaw)))
    : fallbackSortOrder;
  const caption = sanitizeCaption(entry.caption);
  const next = { photoId, workspaceId, mediaAssetId, sortOrder };
  if (caption) next.caption = caption;
  return next;
}

export function normalizeFotosPrincipais(source) {
  const raw = source && source.fotosPrincipais;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seenPhotoIds = new Set();
  const seenSortOrders = new Set();
  const normalized = [];
  raw.forEach((entry, index) => {
    const foto = normalizeFotoPrincipal(entry, index);
    if (!foto) return;
    if (seenPhotoIds.has(foto.photoId)) return;
    seenPhotoIds.add(foto.photoId);
    let sortOrder = foto.sortOrder;
    while (seenSortOrders.has(sortOrder) && sortOrder < EROSION_PHOTOS_PRINCIPAIS_LIMIT) {
      sortOrder += 1;
    }
    if (sortOrder >= EROSION_PHOTOS_PRINCIPAIS_LIMIT) return;
    seenSortOrders.add(sortOrder);
    normalized.push({ ...foto, sortOrder });
  });
  normalized.sort((a, b) => a.sortOrder - b.sortOrder);
  return normalized.slice(0, EROSION_PHOTOS_PRINCIPAIS_LIMIT);
}

export function buildFotosPrincipaisPatch(fotos) {
  const list = Array.isArray(fotos) ? fotos : [];
  const normalized = list
    .map((entry, index) => normalizeFotoPrincipal(entry, index))
    .filter(Boolean)
    .slice(0, EROSION_PHOTOS_PRINCIPAIS_LIMIT)
    .map((foto, index) => ({ ...foto, sortOrder: index }));
  return normalized;
}

export function reorderFotosPrincipais(fotos, fromIndex, toIndex) {
  const list = Array.isArray(fotos) ? [...fotos] : [];
  if (fromIndex < 0 || fromIndex >= list.length) return list;
  if (toIndex < 0 || toIndex >= list.length) return list;
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  return list.map((foto, index) => ({ ...foto, sortOrder: index }));
}
