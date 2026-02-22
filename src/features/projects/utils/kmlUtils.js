function normalizeCoordinateString(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return '';
  return String(num);
}

function normalizeForSearch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasPorticoMarker(text) {
  const raw = String(text ?? '').toLowerCase();
  if (!raw) return false;

  const normalized = normalizeForSearch(raw);
  if (normalized.includes('portico')) return true;

  const asciiOnly = raw.replace(/[^a-z]/g, '');
  return asciiOnly.includes('portico') || asciiOnly.includes('prtico');
}

function formatTowerId(numberPart, suffixPart = '') {
  const base = Number.parseInt(String(numberPart ?? '').replace(/^0+/, '') || '0', 10);
  if (!Number.isFinite(base) || base < 0) return '';
  return `${base}${String(suffixPart || '').toUpperCase()}`;
}

function normalizeTowerToken(raw) {
  const token = String(raw ?? '').trim();
  if (!token) return '';
  if (hasPorticoMarker(token)) return '0';

  const compact = token.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^0*(\d+)([A-Z]?)$/);
  if (!match) return '';
  return formatTowerId(match[1], match[2]);
}

function normalizeTowerNumber(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (hasPorticoMarker(text)) return '0';

  const explicit = text.match(/^(?:torre|tor|t)\s*[-_: ]?\s*0*(\d+)([a-zA-Z]?)$/i);
  if (explicit) return formatTowerId(explicit[1], explicit[2]);

  return normalizeTowerToken(text);
}

function findTowerIdFromSource(source) {
  const text = String(source ?? '').trim();
  if (!text) return '';
  if (hasPorticoMarker(text)) return '0';

  const explicit = text.match(/(?:torre|tor|t)\s*[-_: ]?\s*0*(\d+)([a-zA-Z]?)/i);
  if (explicit) return formatTowerId(explicit[1], explicit[2]);

  const tokens = text.match(/[A-Za-z0-9]+/g) || [];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    const normalized = normalizeTowerToken(token);
    if (!normalized) continue;

    const isSingleMixedToken =
      tokens.length === 1 && /[A-Za-z]/.test(token) && /\d/.test(token);
    if (isSingleMixedToken) continue;

    return normalized;
  }

  return '';
}

function extractTowerNumberFromText(...sources) {
  for (const source of sources) {
    const found = findTowerIdFromSource(source);
    if (found) return found;
  }
  return '';
}

function parseTowerSortParts(value) {
  const normalized = normalizeTowerNumber(value);
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)([A-Z]?)$/);
  if (!match) return null;

  return {
    base: Number(match[1]),
    suffix: match[2] || '',
    normalized,
  };
}

function sanitizeProjectId(raw) {
  return String(raw ?? '')
    .replace(/\.[^/.]+$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function parseCoordinateTuple(raw) {
  const tuple = String(raw ?? '').trim();
  if (!tuple) return null;

  const [lonRaw, latRaw] = tuple.split(',');
  const lat = Number(String(latRaw ?? '').trim().replace(',', '.'));
  const lon = Number(String(lonRaw ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

function parseCoordinatePath(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .map(parseCoordinateTuple)
    .filter(Boolean);
}

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371.0088;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function getPathLengthKm(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    total += haversineDistanceKm(path[i], path[i + 1]);
  }
  return total;
}

function extractDocumentName(xml) {
  return (
    xml.getElementsByTagName('Document')?.[0]
      ?.getElementsByTagName('name')?.[0]
      ?.textContent
    || xml.getElementsByTagName('name')?.[0]?.textContent
    || ''
  ).trim();
}

function extractProjectNameFromDocument(documentName) {
  return String(documentName ?? '')
    .trim()
    .replace(/\.(kml|kmz)$/i, '');
}

function stripCircuitSuffix(rawName) {
  return String(rawName ?? '')
    .trim()
    .replace(/\s*[-_/]?\s*C\d+[A-Z]?$/i, '')
    .trim();
}

function extractProjectNameFromLineStringPlacemark(placemarks = []) {
  for (const placemark of placemarks) {
    const lineNode = placemark.getElementsByTagName('LineString')?.[0];
    if (!lineNode) continue;

    const name = placemark.getElementsByTagName('name')?.[0]?.textContent || '';
    const cleaned = stripCircuitSuffix(name);
    if (cleaned) return cleaned;
  }

  return '';
}

function extractSiglaFromLineStringPlacemark(placemarks = []) {
  for (const placemark of placemarks) {
    const lineNode = placemark.getElementsByTagName('LineString')?.[0];
    if (!lineNode) continue;

    const descriptionRaw = placemark.getElementsByTagName('description')?.[0]?.textContent || '';
    const description = String(descriptionRaw).replace(/<[^>]*>/g, ' ');
    const token = description.match(/[A-Za-z][A-Za-z0-9]*/)?.[0] || '';
    if (!token) continue;

    let sigla = sanitizeProjectId(token);
    if (/^[A-Z]+\d+$/.test(sigla)) sigla = sigla.replace(/\d+$/, '');
    if (sigla) return sigla;
  }

  return '';
}

function inferSiglaFromRows(rows = []) {
  const prefixCount = new Map();
  const increment = (value) => {
    if (!value) return;
    prefixCount.set(value, (prefixCount.get(value) || 0) + 1);
  };

  rows.forEach((row) => {
    const name = String(row?.sourceName ?? '').trim();
    if (!name) return;

    const tokens = name.split(/\s+/).map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) return;

    let prefix = sanitizeProjectId(tokens[0]);
    const second = String(tokens[1] || '');
    const secondLooksLikeTower = !!(normalizeTowerToken(second) || hasPorticoMarker(second));
    if (/\d+$/.test(prefix) && secondLooksLikeTower) {
      prefix = prefix.replace(/\d+$/, '');
    }

    increment(sanitizeProjectId(prefix));
  });

  let best = '';
  let bestCount = -1;
  prefixCount.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

function extractFirstLineStringMeta(placemarks = []) {
  for (const placemark of placemarks) {
    const lineNode = placemark.getElementsByTagName('LineString')?.[0];
    if (!lineNode) continue;

    const coordinatesText = lineNode.getElementsByTagName('coordinates')?.[0]?.textContent || '';
    const path = parseCoordinatePath(coordinatesText);
    if (path.length < 2) {
      return { lineStringFound: true, extensao: '' };
    }

    const lengthKm = getPathLengthKm(path);
    return { lineStringFound: true, extensao: lengthKm.toFixed(2) };
  }

  return { lineStringFound: false, extensao: '' };
}

export function compareTowerNumbers(a, b) {
  const aParts = parseTowerSortParts(a);
  const bParts = parseTowerSortParts(b);

  if (aParts && bParts) {
    if (aParts.base !== bParts.base) return aParts.base - bParts.base;
    if (aParts.suffix === bParts.suffix) return 0;
    if (!aParts.suffix) return -1;
    if (!bParts.suffix) return 1;
    return aParts.suffix.localeCompare(bParts.suffix);
  }

  if (aParts) return -1;
  if (bParts) return 1;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export function parseKmlTowers(kmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(String(kmlText || ''), 'application/xml');
  const baseMeta = {
    sigla: '',
    nome: '',
    torres: 0,
    extensao: '',
    lineStringFound: false,
    sourceLabel: '',
  };

  if (xml.querySelector('parsererror')) {
    return { rows: [], errors: ['Arquivo KML invalido ou corrompido.'], meta: baseMeta };
  }

  const documentName = extractDocumentName(xml);
  baseMeta.sourceLabel = documentName;
  const placemarks = Array.from(xml.getElementsByTagName('Placemark'));
  if (placemarks.length === 0) {
    return { rows: [], errors: ['Nenhum Placemark encontrado no KML.'], meta: baseMeta };
  }
  const projectName = extractProjectNameFromLineStringPlacemark(placemarks)
    || extractProjectNameFromDocument(documentName);
  baseMeta.nome = projectName;

  const rows = [];
  let ignoredPlacemarks = 0;

  placemarks.forEach((placemark) => {
    const pointNode = placemark.getElementsByTagName('Point')?.[0];
    if (!pointNode) {
      ignoredPlacemarks += 1;
      return;
    }

    const name = placemark.getElementsByTagName('name')?.[0]?.textContent || '';
    const description = placemark.getElementsByTagName('description')?.[0]?.textContent || '';
    const coordinatesText = pointNode.getElementsByTagName('coordinates')?.[0]?.textContent || '';
    const firstPoint = coordinatesText.trim().split(/\s+/)[0] || '';
    if (!firstPoint) {
      ignoredPlacemarks += 1;
      return;
    }

    const tuple = parseCoordinateTuple(firstPoint);
    if (!tuple) {
      ignoredPlacemarks += 1;
      return;
    }

    const numero = extractTowerNumberFromText(name, description);
    const latitude = normalizeCoordinateString(tuple.lat);
    const longitude = normalizeCoordinateString(tuple.lon);
    if (!numero || !latitude || !longitude) {
      ignoredPlacemarks += 1;
      return;
    }

    rows.push({
      key: `kml-${rows.length + 1}`,
      numero,
      latitude,
      longitude,
      origem: 'kml',
      sourceName: name || `Placemark ${rows.length + 1}`,
      error: '',
    });
  });

  const errors = [];
  if (ignoredPlacemarks > 0) {
    errors.push(`${ignoredPlacemarks} Placemark(s) ignorado(s) por tipo de geometria, identificacao ou coordenadas invalidas.`);
  }

  const lineMeta = extractFirstLineStringMeta(placemarks);
  const lineSigla = extractSiglaFromLineStringPlacemark(placemarks);
  const inferredSigla = inferSiglaFromRows(rows) || lineSigla || sanitizeProjectId(documentName);
  const meta = {
    sigla: inferredSigla,
    nome: projectName,
    torres: rows.length,
    extensao: lineMeta.extensao,
    lineStringFound: lineMeta.lineStringFound,
    sourceLabel: documentName,
  };

  return { rows, errors, meta };
}

export function validateTowerCoordinatesAsString(list) {
  const rows = (Array.isArray(list) ? list : []).map((row, idx) => {
    const numero = normalizeTowerNumber(row?.numero ?? '');
    const latitude = normalizeCoordinateString(row?.latitude ?? '');
    const longitude = normalizeCoordinateString(row?.longitude ?? '');
    const lat = Number(latitude);
    const lng = Number(longitude);
    const issues = [];

    if (!numero && numero !== '0') issues.push('Torre invalida');
    if (!latitude || Number.isNaN(lat) || lat < -90 || lat > 90) issues.push('Latitude invalida');
    if (!longitude || Number.isNaN(lng) || lng < -180 || lng > 180) issues.push('Longitude invalida');

    return {
      key: row?.key || `manual-${idx + 1}`,
      numero,
      latitude,
      longitude,
      origem: row?.origem || 'manual',
      sourceName: row?.sourceName || '',
      error: issues.join(' | '),
    };
  });

  const dupCount = {};
  rows.forEach((r) => {
    if (!r.numero && r.numero !== '0') return;
    dupCount[r.numero] = (dupCount[r.numero] || 0) + 1;
  });

  rows.forEach((r) => {
    if (!r.numero && r.numero !== '0') return;
    if (dupCount[r.numero] > 1) {
      r.error = r.error ? `${r.error} | Torre duplicada` : 'Torre duplicada';
    }
  });

  return {
    rows,
    hasErrors: rows.some((r) => !!r.error),
  };
}

export function mergeTowerCoordinates(existing, imported) {
  const normalizedExisting = validateTowerCoordinatesAsString(existing || []).rows
    .filter((r) => !r.error)
    .map((r) => ({ numero: r.numero, latitude: r.latitude, longitude: r.longitude, origem: r.origem || 'manual' }));

  const normalizedImported = validateTowerCoordinatesAsString(imported || []).rows
    .filter((r) => !r.error)
    .map((r) => ({ numero: r.numero, latitude: r.latitude, longitude: r.longitude, origem: 'kml' }));

  const mergedMap = new Map();
  normalizedExisting.forEach((row) => mergedMap.set(String(row.numero), row));
  normalizedImported.forEach((row) => mergedMap.set(String(row.numero), row));

  return [...mergedMap.values()].sort((a, b) => compareTowerNumbers(a.numero, b.numero));
}
