function normalizeCoordinateString(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return '';
  return String(num);
}

function normalizeTowerNumber(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.includes('portico') || lower.includes('pórtico')) return '0';
  const match = text.match(/(\d+)/);
  if (!match) return '';
  return String(Number(match[1]));
}

function extractTowerNumberFromText(...sources) {
  const text = sources.filter(Boolean).join(' ').trim();
  if (!text) return '';
  const explicit = text.match(/(?:torre|tor|t)\s*[-_: ]?\s*0*(\d+)/i);
  if (explicit) return String(Number(explicit[1]));
  return normalizeTowerNumber(text);
}

export function parseKmlTowers(kmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(String(kmlText || ''), 'application/xml');
  if (xml.querySelector('parsererror')) {
    return { rows: [], errors: ['Arquivo KML inválido ou corrompido.'] };
  }

  const placemarks = Array.from(xml.getElementsByTagName('Placemark'));
  if (placemarks.length === 0) {
    return { rows: [], errors: ['Nenhum Placemark encontrado no KML.'] };
  }

  const rows = placemarks.map((placemark, idx) => {
    const name = placemark.getElementsByTagName('name')?.[0]?.textContent || '';
    const description = placemark.getElementsByTagName('description')?.[0]?.textContent || '';
    const coordinatesText = placemark.getElementsByTagName('coordinates')?.[0]?.textContent || '';
    const firstPoint = coordinatesText.trim().split(/\s+/)[0] || '';
    const [lonRaw, latRaw] = firstPoint.split(',');
    const numero = extractTowerNumberFromText(name, description);

    return {
      key: `kml-${idx + 1}`,
      numero: numero || '',
      latitude: normalizeCoordinateString(latRaw || ''),
      longitude: normalizeCoordinateString(lonRaw || ''),
      origem: 'kml',
      sourceName: name || `Placemark ${idx + 1}`,
      error: '',
    };
  });

  return { rows, errors: [] };
}

export function validateTowerCoordinatesAsString(list) {
  const rows = (Array.isArray(list) ? list : []).map((row, idx) => {
    const numero = normalizeTowerNumber(row?.numero ?? '');
    const latitude = normalizeCoordinateString(row?.latitude ?? '');
    const longitude = normalizeCoordinateString(row?.longitude ?? '');
    const lat = Number(latitude);
    const lng = Number(longitude);
    const issues = [];

    if (!numero && numero !== '0') issues.push('Torre inválida');
    if (!latitude || Number.isNaN(lat) || lat < -90 || lat > 90) issues.push('Latitude inválida');
    if (!longitude || Number.isNaN(lng) || lng < -180 || lng > 180) issues.push('Longitude inválida');

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

  return [...mergedMap.values()].sort((a, b) => Number(a.numero) - Number(b.numero));
}
