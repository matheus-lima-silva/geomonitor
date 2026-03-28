const { DOMParser } = require('@xmldom/xmldom');

function normalizeCoordinateString(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const normalized = raw.replace(',', '.');
    const num = Number(normalized);
    if (!Number.isFinite(num)) return '';
    return String(num);
}

function hasPorticoMarker(text) {
    const raw = String(text ?? '').toLowerCase();
    if (!raw) return false;
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
        const isSingleMixedToken = tokens.length === 1 && /[A-Za-z]/.test(token) && /\d/.test(token);
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

function parseCoordinateTuple(raw) {
    const tuple = String(raw ?? '').trim();
    if (!tuple) return null;
    const parts = tuple.split(',');
    const lonRaw = parts[0];
    const latRaw = parts[1];
    const altRaw = parts.length > 2 ? parts[2] : undefined;
    const lat = Number(String(latRaw ?? '').trim().replace(',', '.'));
    const lon = Number(String(lonRaw ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (altRaw === undefined || altRaw === null) return { lat, lon, alt: null };
    const alt = Number(String(altRaw).trim().replace(',', '.'));
    return { lat, lon, alt: Number.isFinite(alt) ? alt : null };
}

function inferTowerIdFromPath(internalPath) {
    const segments = String(internalPath || '')
        .split(/[\\/]/)
        .map((s) => s.trim())
        .filter(Boolean);

    for (let index = segments.length - 2; index >= 0; index -= 1) {
        const inferred = normalizeTowerNumber(segments[index]);
        if (inferred) return inferred;
    }
    return '';
}

function getElementText(parent, tagName) {
    const elements = parent.getElementsByTagName(tagName);
    if (!elements || elements.length === 0) return '';
    return (elements[0].textContent || '').trim();
}

function getFolderPath(node) {
    const parts = [];
    let current = node?.parentNode;
    while (current) {
        const tagName = current.nodeName || current.tagName || '';
        if (tagName === 'Folder') {
            const name = getElementText(current, 'name');
            if (name) parts.unshift(name);
        }
        current = current.parentNode;
    }
    return parts.join('/');
}

function parseKmlPlacemarks(kmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(String(kmlText || ''), 'application/xml');

    const placemarks = [];
    const warnings = [];

    const allPlacemarks = xml.getElementsByTagName('Placemark');
    if (!allPlacemarks || allPlacemarks.length === 0) {
        return { placemarks: [], warnings: ['Nenhum Placemark encontrado no KML.'] };
    }

    let ignoredCount = 0;

    for (let i = 0; i < allPlacemarks.length; i += 1) {
        const pm = allPlacemarks[i];
        const name = getElementText(pm, 'name');
        const description = getElementText(pm, 'description');
        const folderPath = getFolderPath(pm);

        const pointNode = pm.getElementsByTagName('Point');
        if (!pointNode || pointNode.length === 0) {
            ignoredCount += 1;
            continue;
        }

        const coordsText = getElementText(pointNode[0], 'coordinates');
        const firstCoord = coordsText.trim().split(/\s+/)[0] || '';
        const tuple = parseCoordinateTuple(firstCoord);
        if (!tuple) {
            ignoredCount += 1;
            continue;
        }

        placemarks.push({
            name,
            description,
            lat: tuple.lat,
            lon: tuple.lon,
            folderPath,
        });
    }

    if (ignoredCount > 0) {
        warnings.push(`${ignoredCount} Placemark(s) ignorado(s) por tipo de geometria ou coordenadas invalidas.`);
    }

    return { placemarks, warnings };
}

module.exports = {
    extractTowerNumberFromText,
    findTowerIdFromSource,
    formatTowerId,
    hasPorticoMarker,
    inferTowerIdFromPath,
    normalizeCoordinateString,
    normalizeTowerNumber,
    normalizeTowerToken,
    parseCoordinateTuple,
    parseKmlPlacemarks,
};
