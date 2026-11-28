// Leitura de tracados (ponto, linha, poligono) a partir de arquivos KML, KMZ e GPX.
//
// Aceita o que sai do Google Earth (KML 2.2), do MAPS.ME (namespace antigo
// earth.google.com/kml/2.2 + ExtendedData proprio) e de apps de trilha (GPX,
// gx:Track). A saida usa GeoJSON (coordenadas [lon, lat]).
import { unzipSync, strFromU8 } from 'fflate';

export const GEOMETRY_FILE_ACCEPT = '.kml,.kmz,.gpx,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/gpx+xml';
export const MAX_GEOMETRY_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_GEOMETRY_VERTICES = 10000;

function byLocalName(root, name) {
  return Array.from(root.getElementsByTagNameNS('*', name));
}

function childByLocalName(node, name) {
  return Array.from(node.childNodes || []).find((child) => child.nodeType === 1 && child.localName === name) || null;
}

function textOf(node) {
  return String(node?.textContent || '').trim();
}

function roundCoord(value) {
  return Math.round(Number(value) * 1e7) / 1e7;
}

function isValidLonLat(lon, lat) {
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function dedupeConsecutive(points) {
  const out = [];
  points.forEach((point) => {
    const last = out[out.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  });
  return out;
}

/** "lon,lat[,alt] lon,lat[,alt] ..." -> [[lon, lat], ...] */
export function parseKmlCoordinateText(text) {
  return dedupeConsecutive(String(text || '')
    .trim()
    .split(/\s+/)
    .map((token) => token.split(',').map(Number))
    .filter(([lon, lat]) => isValidLonLat(lon, lat))
    .map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]));
}

function parseGxTrack(trackNode) {
  return dedupeConsecutive(byLocalName(trackNode, 'coord')
    .map((node) => textOf(node).split(/\s+/).map(Number))
    .filter(([lon, lat]) => isValidLonLat(lon, lat))
    .map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]));
}

function closeRing(ring) {
  if (ring.length < 3) return ring;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function geometriesFromKmlNode(node) {
  switch (node.localName) {
    case 'Point': {
      const [point] = parseKmlCoordinateText(textOf(childByLocalName(node, 'coordinates')));
      return point ? [{ type: 'Point', coordinates: point }] : [];
    }
    case 'LineString': {
      const line = parseKmlCoordinateText(textOf(childByLocalName(node, 'coordinates')));
      return line.length >= 2 ? [{ type: 'LineString', coordinates: line }] : [];
    }
    case 'Track': {
      const line = parseGxTrack(node);
      return line.length >= 2 ? [{ type: 'LineString', coordinates: line }] : [];
    }
    case 'Polygon': {
      const ringOf = (boundaryName) => byLocalName(node, boundaryName)
        .map((boundary) => byLocalName(boundary, 'LinearRing')[0])
        .filter(Boolean)
        .map((ring) => closeRing(parseKmlCoordinateText(textOf(childByLocalName(ring, 'coordinates')))))
        .filter((ring) => ring.length >= 4);
      const outer = ringOf('outerBoundaryIs');
      if (outer.length === 0) return [];
      return [{ type: 'Polygon', coordinates: [outer[0], ...ringOf('innerBoundaryIs')] }];
    }
    case 'MultiGeometry':
    case 'MultiTrack':
      return Array.from(node.childNodes || [])
        .filter((child) => child.nodeType === 1)
        .flatMap((child) => geometriesFromKmlNode(child));
    default:
      return [];
  }
}

const KML_GEOMETRY_NAMES = new Set(['Point', 'LineString', 'Polygon', 'MultiGeometry', 'Track', 'MultiTrack']);

export function parseKmlText(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Arquivo KML invalido (XML mal formado).');
  }
  const features = [];
  byLocalName(doc, 'Placemark').forEach((placemark, placemarkIndex) => {
    const name = textOf(childByLocalName(placemark, 'name')) || `Elemento ${placemarkIndex + 1}`;
    const geometryNode = Array.from(placemark.childNodes || [])
      .find((child) => child.nodeType === 1 && KML_GEOMETRY_NAMES.has(child.localName));
    if (!geometryNode) return;
    const geometries = geometriesFromKmlNode(geometryNode);
    geometries.forEach((geometry, index) => {
      features.push({
        id: `f${features.length}`,
        name: geometries.length > 1 ? `${name} (${index + 1})` : name,
        geometry,
      });
    });
  });
  return features;
}

export function parseGpxText(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Arquivo GPX invalido (XML mal formado).');
  }
  const pointOf = (node) => {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    return isValidLonLat(lon, lat) ? [roundCoord(lon), roundCoord(lat)] : null;
  };
  const features = [];
  const push = (name, geometry) => features.push({ id: `f${features.length}`, name, geometry });

  byLocalName(doc, 'trk').forEach((trk, trkIndex) => {
    const name = textOf(childByLocalName(trk, 'name')) || `Trilha ${trkIndex + 1}`;
    const segments = byLocalName(trk, 'trkseg');
    segments.forEach((seg, segIndex) => {
      const line = dedupeConsecutive(byLocalName(seg, 'trkpt').map(pointOf).filter(Boolean));
      if (line.length >= 2) push(segments.length > 1 ? `${name} (${segIndex + 1})` : name, { type: 'LineString', coordinates: line });
    });
  });
  byLocalName(doc, 'rte').forEach((rte, index) => {
    const line = dedupeConsecutive(byLocalName(rte, 'rtept').map(pointOf).filter(Boolean));
    if (line.length >= 2) push(textOf(childByLocalName(rte, 'name')) || `Rota ${index + 1}`, { type: 'LineString', coordinates: line });
  });
  byLocalName(doc, 'wpt').forEach((wpt, index) => {
    const point = pointOf(wpt);
    if (point) push(textOf(childByLocalName(wpt, 'name')) || `Ponto ${index + 1}`, { type: 'Point', coordinates: point });
  });
  return features;
}

function isZip(bytes) {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function kmlTextFromKmz(bytes) {
  const entries = unzipSync(bytes, { filter: (file) => /\.kml$/i.test(file.name) });
  const names = Object.keys(entries);
  if (names.length === 0) throw new Error('O KMZ nao contem nenhum arquivo .kml.');
  const main = names.find((name) => /(^|\/)doc\.kml$/i.test(name)) || names.sort((a, b) => a.length - b.length)[0];
  return strFromU8(entries[main]);
}

export function countVertices(geometry) {
  if (!geometry) return 0;
  if (geometry.type === 'Point') return 1;
  if (geometry.type === 'LineString') return geometry.coordinates.length;
  if (geometry.type === 'Polygon') return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  return 0;
}

/**
 * Le os bytes de um arquivo de tracado e devolve as feicoes encontradas.
 * @returns {{ format: 'kml'|'kmz'|'gpx', features: Array<{ id, name, geometry }> }}
 */
export function parseGeometryBytes(bytes, fileName = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength > MAX_GEOMETRY_FILE_BYTES) {
    throw new Error('Arquivo muito grande para importar (limite de 30 MB).');
  }
  let format;
  let features;
  if (isZip(data)) {
    format = 'kmz';
    features = parseKmlText(kmlTextFromKmz(data));
  } else {
    const text = strFromU8(data);
    const isGpx = /\.gpx$/i.test(fileName) || /<gpx[\s>]/i.test(text.slice(0, 2000));
    format = isGpx ? 'gpx' : 'kml';
    features = isGpx ? parseGpxText(text) : parseKmlText(text);
  }
  const usable = features.filter((feature) => countVertices(feature.geometry) <= MAX_GEOMETRY_VERTICES);
  if (usable.length === 0) {
    throw new Error(features.length > 0
      ? `As feicoes do arquivo passam de ${MAX_GEOMETRY_VERTICES} vertices.`
      : 'Nenhum ponto, linha ou poligono encontrado no arquivo.');
  }
  return { format, features: usable };
}

export async function parseGeometryFile(file) {
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  const buffer = await file.arrayBuffer();
  return parseGeometryBytes(new Uint8Array(buffer), file.name || '');
}
