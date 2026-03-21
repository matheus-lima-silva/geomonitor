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

  const explicit = text.match(/^(?:torre|tor|t)\s*[-_: ]?\s*0*(\d+)\s*([a-zA-Z]?)$/i);
  if (explicit) return formatTowerId(explicit[1], explicit[2]);

  return normalizeTowerToken(text);
}

function findTowerIdFromSource(source) {
  const text = String(source ?? '').trim();
  if (!text) return '';
  if (hasPorticoMarker(text)) return '0';

  const explicit = text.match(/(?:torre|tor|t)\s*[-_: ]?\s*0*(\d+)\s*([a-zA-Z]?)/i);
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

  const [lonRaw, latRaw, altRaw] = tuple.split(',');
  const lat = Number(String(latRaw ?? '').trim().replace(',', '.'));
  const lon = Number(String(lonRaw ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const alt = Number(String(altRaw ?? '').trim().replace(',', '.'));
  return { lat, lon, alt: Number.isFinite(alt) ? alt : null };
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

function extractSiglaFromDescription(descriptionRaw) {
  const description = String(descriptionRaw ?? '').replace(/<[^>]*>/g, ' ');
  const token = description.match(/[A-Za-z][A-Za-z0-9]*/)?.[0] || '';
  if (!token) return '';

  let sigla = sanitizeProjectId(token);
  if (/^[A-Z]+\d+$/.test(sigla)) sigla = sigla.replace(/\d+$/, '');
  return sigla || '';
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

function normalizeLineCoordinates(path = []) {
  return path
    .map((point) => ({
      latitude: normalizeCoordinateString(point?.lat),
      longitude: normalizeCoordinateString(point?.lon),
      altitude: normalizeCoordinateString(point?.alt),
    }))
    .filter((point) => point.latitude && point.longitude);
}

function extractLongestLineStringMeta(placemarks = []) {
  let lineStringFound = false;
  let bestLengthKm = -1;
  let bestMeta = null;

  for (const placemark of placemarks) {
    const lineNode = placemark.getElementsByTagName('LineString')?.[0];
    if (!lineNode) continue;
    lineStringFound = true;

    const coordinatesText = lineNode.getElementsByTagName('coordinates')?.[0]?.textContent || '';
    const path = parseCoordinatePath(coordinatesText);
    const lengthKm = getPathLengthKm(path);
    if (lengthKm <= bestLengthKm) continue;

    const placemarkName = placemark.getElementsByTagName('name')?.[0]?.textContent || '';
    const lineName = stripCircuitSuffix(placemarkName);
    const descriptionRaw = placemark.getElementsByTagName('description')?.[0]?.textContent || '';
    bestLengthKm = lengthKm;
    bestMeta = {
      extensao: path.length >= 2 ? lengthKm.toFixed(2) : '',
      linhaCoordenadas: normalizeLineCoordinates(path),
      linhaNome: lineName,
      linhaFonteKml: String(placemarkName || '').trim(),
      siglaFromLine: extractSiglaFromDescription(descriptionRaw),
    };
  }

  if (!lineStringFound) {
    return {
      lineStringFound: false,
      extensao: '',
      linhaCoordenadas: [],
      linhaNome: '',
      linhaFonteKml: '',
      siglaFromLine: '',
    };
  }

  return {
    lineStringFound: true,
    extensao: bestMeta?.extensao || '',
    linhaCoordenadas: bestMeta?.linhaCoordenadas || [],
    linhaNome: bestMeta?.linhaNome || '',
    linhaFonteKml: bestMeta?.linhaFonteKml || '',
    siglaFromLine: bestMeta?.siglaFromLine || '',
  };
}

export function formatTowerLabel(tower) {
  const str = String(tower ?? '');
  if (str === '0') return 'Pórtico (T0)';
  if (str.startsWith('0') && str.length > 1 && !str.match(/^0\d/)) {
    return `Pórtico (${str})`;
  }
  return `Torre ${str}`;
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

function _parseKmlPlacemarks(placemarks, documentName) {
  const lineMeta = extractLongestLineStringMeta(placemarks);
  const projectName = lineMeta.linhaNome || extractProjectNameFromDocument(documentName);

  const rows = [];
  let ignoredPlacemarks = 0;
  const porticoMap = new Map();

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

    let numero = extractTowerNumberFromText(name, description);

    if (numero === '0') {
      const pName = String(name || '').trim().toUpperCase();
      if (!porticoMap.has(pName)) {
        const suffix = porticoMap.size === 0 ? '' : String.fromCharCode(64 + porticoMap.size);
        porticoMap.set(pName, `0${suffix}`);
      }
      numero = porticoMap.get(pName);
    }

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

  const inferredSigla = inferSiglaFromRows(rows) || lineMeta.siglaFromLine || sanitizeProjectId(documentName);
  const meta = {
    sigla: inferredSigla,
    nome: projectName,
    torres: rows.length,
    extensao: lineMeta.extensao,
    lineStringFound: lineMeta.lineStringFound,
    sourceLabel: documentName,
    linhaCoordenadas: lineMeta.linhaCoordenadas,
    linhaNome: lineMeta.linhaNome,
    linhaFonteKml: lineMeta.linhaFonteKml,
  };

  return { rows, errors, meta };
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
    linhaCoordenadas: [],
    linhaNome: '',
    linhaFonteKml: '',
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

  return _parseKmlPlacemarks(placemarks, documentName);
}

function _findSiglaFolders(xml) {
  const allFolders = Array.from(xml.getElementsByTagName('Folder'));
  const siglaFolders = [];

  for (let i = 0; i < allFolders.length; i++) {
    const folder = allFolders[i];
    const folderName = folder.querySelector(':scope > name')?.textContent?.trim() || '';
    if (!folderName) continue;

    const hasLineString = folder.getElementsByTagName('LineString').length > 0;
    const hasPoint = folder.getElementsByTagName('Point').length > 0;
    if (!hasLineString || !hasPoint) continue;

    const childFolders = Array.from(folder.querySelectorAll(':scope > Folder'));
    const childHasLineStrings = childFolders.some(
      (cf) => cf.getElementsByTagName('LineString').length > 0 && cf.getElementsByTagName('Point').length > 0
    );
    if (childHasLineStrings) continue;

    const parentFolder = folder.parentElement?.closest?.('Folder');
    const parentName = parentFolder?.querySelector?.(':scope > name')?.textContent?.trim() || '';

    siglaFolders.push({ folder, folderName, parentName, index: i });
  }

  return siglaFolders;
}

function _stripCircuitNumber(sigla) {
  return String(sigla || '').replace(/\d+$/, '');
}

function _stripDescriptiveCircuitSuffix(name) {
  return String(name || '').trim().replace(/\s+\d+\s*$/, '').trim();
}

function _getDescriptiveName(folder) {
  const childFolders = Array.from(folder.querySelectorAll(':scope > Folder'));
  for (const cf of childFolders) {
    const name = cf.querySelector(':scope > name')?.textContent?.trim() || '';
    if (name && !/^numer/i.test(name)) return name;
  }
  const placemarks = Array.from(folder.querySelectorAll(':scope > Placemark'));
  for (const pm of placemarks) {
    if (!pm.getElementsByTagName('LineString')?.[0]) continue;
    const name = pm.getElementsByTagName('name')?.[0]?.textContent?.trim() || '';
    if (name) return name;
  }
  return '';
}

function _countUniquePoints(folders) {
  const seen = new Set();
  let count = 0;
  for (const folder of folders) {
    const placemarks = Array.from(folder.getElementsByTagName('Placemark'));
    for (const pm of placemarks) {
      const pointNode = pm.getElementsByTagName('Point')?.[0];
      if (!pointNode) continue;
      const name = pm.getElementsByTagName('name')?.[0]?.textContent || '';
      const numero = extractTowerNumberFromText(name, '');
      if (!numero) continue;
      if (seen.has(numero)) continue;
      seen.add(numero);
      count++;
    }
  }
  return count;
}

function _getLongestLineStringKm(folders) {
  let bestKm = 0;
  for (const folder of folders) {
    const placemarks = Array.from(folder.getElementsByTagName('Placemark'));
    for (const pm of placemarks) {
      const lineNode = pm.getElementsByTagName('LineString')?.[0];
      if (!lineNode) continue;
      const coordsText = lineNode.getElementsByTagName('coordinates')?.[0]?.textContent || '';
      const path = parseCoordinatePath(coordsText);
      const km = getPathLengthKm(path);
      if (km > bestKm) bestKm = km;
    }
  }
  return bestKm;
}

function _getLineStringEndpoints(folder) {
  let bestLength = 0;
  let bestEndpoints = null;
  const placemarks = Array.from(folder.getElementsByTagName('Placemark'));
  for (const pm of placemarks) {
    const lineNode = pm.getElementsByTagName('LineString')?.[0];
    if (!lineNode) continue;
    const coordsText = lineNode.getElementsByTagName('coordinates')?.[0]?.textContent || '';
    const path = parseCoordinatePath(coordsText);
    if (path.length < 2) continue;
    const length = getPathLengthKm(path);
    if (length > bestLength) {
      bestLength = length;
      bestEndpoints = { start: path[0], end: path[path.length - 1] };
    }
  }
  return bestEndpoints;
}

function _areLineStringsSimilar(folderA, folderB, toleranceKm = 0.1) {
  const epA = _getLineStringEndpoints(folderA);
  const epB = _getLineStringEndpoints(folderB);
  if (!epA || !epB) return false;

  // Check both orientations (A→B might be reversed)
  const directStartDist = haversineDistanceKm(epA.start, epB.start);
  const directEndDist = haversineDistanceKm(epA.end, epB.end);
  const reversedStartDist = haversineDistanceKm(epA.start, epB.end);
  const reversedEndDist = haversineDistanceKm(epA.end, epB.start);

  const directMatch = directStartDist <= toleranceKm && directEndDist <= toleranceKm;
  const reversedMatch = reversedStartDist <= toleranceKm && reversedEndDist <= toleranceKm;
  return directMatch || reversedMatch;
}

export function detectKmlLines(kmlText) {
  const empty = { isMultiLine: false, lines: [] };
  const parser = new DOMParser();
  const xml = parser.parseFromString(String(kmlText || ''), 'application/xml');
  if (xml.querySelector('parsererror')) return empty;

  const siglaFolders = _findSiglaFolders(xml);
  if (siglaFolders.length < 2) return empty;

  // Phase 1: Collect entries per base sigla
  const rawGroups = new Map();
  for (const entry of siglaFolders) {
    const fullSigla = sanitizeProjectId(entry.folderName);
    const baseSigla = _stripCircuitNumber(fullSigla);
    if (!baseSigla) continue;

    if (!rawGroups.has(baseSigla)) {
      rawGroups.set(baseSigla, []);
    }
    rawGroups.get(baseSigla).push({ ...entry, fullSigla });
  }

  // Phase 2: Cluster by route similarity within each base sigla
  const groups = new Map();
  for (const [baseSigla, entries] of rawGroups) {
    if (entries.length === 1) {
      // Single entry — use base sigla
      const entry = entries[0];
      groups.set(baseSigla, {
        sigla: baseSigla,
        descriptiveName: _stripDescriptiveCircuitSuffix(_getDescriptiveName(entry.folder)),
        tensaoKv: entry.parentName,
        folders: [entry.folder],
        folderIndices: [entry.index],
        circuitCount: 1,
      });
      continue;
    }

    // Multiple entries — cluster by route similarity
    const clusters = [];
    for (const entry of entries) {
      let matched = false;
      for (const cluster of clusters) {
        if (_areLineStringsSimilar(entry.folder, cluster[0].folder)) {
          cluster.push(entry);
          matched = true;
          break;
        }
      }
      if (!matched) {
        clusters.push([entry]);
      }
    }

    // Find the largest cluster (gets the base sigla)
    clusters.sort((a, b) => b.length - a.length);

    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      const isMainCluster = ci === 0;

      // Main cluster uses base sigla; secondary clusters use sigla + circuit number
      let clusterSigla;
      if (isMainCluster) {
        clusterSigla = baseSigla;
      } else {
        // Use the circuit number from the first entry in this cluster
        const suffix = cluster[0].fullSigla.slice(baseSigla.length);
        clusterSigla = suffix ? `${baseSigla}${suffix}` : `${baseSigla}C${ci + 1}`;
      }

      const firstEntry = cluster[0];
      groups.set(clusterSigla, {
        sigla: clusterSigla,
        descriptiveName: _stripDescriptiveCircuitSuffix(_getDescriptiveName(firstEntry.folder)),
        tensaoKv: firstEntry.parentName,
        folders: cluster.map((e) => e.folder),
        folderIndices: cluster.map((e) => e.index),
        circuitCount: cluster.length,
      });
    }
  }

  if (groups.size < 2) return empty;

  const lines = [];
  for (const group of groups.values()) {
    lines.push({
      sigla: group.sigla,
      descriptiveName: group.descriptiveName,
      tensaoKv: group.tensaoKv,
      towerCount: _countUniquePoints(group.folders),
      lengthKm: Number(_getLongestLineStringKm(group.folders).toFixed(2)),
      circuitCount: group.circuitCount,
      folderIndices: group.folderIndices,
    });
  }

  lines.sort((a, b) => a.sigla.localeCompare(b.sigla));
  return { isMultiLine: true, lines };
}

export function parseKmlTowersFromGroup(kmlText, folderIndices) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(String(kmlText || ''), 'application/xml');
  const baseMeta = {
    sigla: '',
    nome: '',
    torres: 0,
    extensao: '',
    lineStringFound: false,
    sourceLabel: '',
    linhaCoordenadas: [],
    linhaNome: '',
    linhaFonteKml: '',
  };

  if (xml.querySelector('parsererror')) {
    return { rows: [], errors: ['Arquivo KML invalido ou corrompido.'], meta: baseMeta };
  }

  const allFolders = Array.from(xml.getElementsByTagName('Folder'));
  const targetFolders = folderIndices
    .map((idx) => allFolders[idx])
    .filter(Boolean);

  if (targetFolders.length === 0) {
    return { rows: [], errors: ['Folders selecionadas nao encontradas no KML.'], meta: baseMeta };
  }

  const placemarkSet = new Set();
  const placemarks = [];
  for (const folder of targetFolders) {
    for (const pm of Array.from(folder.getElementsByTagName('Placemark'))) {
      if (!placemarkSet.has(pm)) {
        placemarkSet.add(pm);
        placemarks.push(pm);
      }
    }
  }

  const documentName = extractDocumentName(xml);
  if (placemarks.length === 0) {
    return { rows: [], errors: ['Nenhum Placemark encontrado nas folders selecionadas.'], meta: baseMeta };
  }

  return _parseKmlPlacemarks(placemarks, documentName);
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
