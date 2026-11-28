// Medidas de tracados GeoJSON (coordenadas [lon, lat]) em metros.
const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function lineLengthMeters(coords = []) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) total += haversineMeters(coords[i - 1], coords[i]);
  return total;
}

// Area esferica de um anel (mesma formula do @mapbox/geojson-area).
function ringAreaM2(ring = []) {
  if (ring.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    sum += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** { comprimentoMetros, perimetroMetros, areaM2, vertices } conforme o tipo. */
export function computeGeometryMetrics(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const round = (value) => Math.round(value * 10) / 10;
  if (geometry.type === 'Point') return { vertices: 1 };
  if (geometry.type === 'LineString') {
    return { comprimentoMetros: round(lineLengthMeters(geometry.coordinates)), vertices: geometry.coordinates.length };
  }
  if (geometry.type === 'Polygon') {
    const [outer = [], ...holes] = geometry.coordinates;
    const area = ringAreaM2(outer) - holes.reduce((sum, ring) => sum + ringAreaM2(ring), 0);
    return {
      areaM2: round(Math.max(0, area)),
      perimetroMetros: round(lineLengthMeters(outer)),
      vertices: geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0),
    };
  }
  return null;
}

function segmentsOf(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  return [];
}

/**
 * Ponto do tracado mais proximo de `target` ([lon, lat]), com projecao local
 * equiretangular (erro desprezivel na escala de uma erosao/acesso).
 * @returns {{ point: [lon, lat], distanceM: number } | null}
 */
export function nearestPointOnGeometry(geometry, target) {
  if (!geometry || !Array.isArray(target)) return null;
  if (geometry.type === 'Point') {
    return { point: geometry.coordinates, distanceM: haversineMeters(geometry.coordinates, target) };
  }
  const kx = 111320 * Math.cos(toRad(target[1]));
  const ky = 110540;
  const project = ([lon, lat]) => [(lon - target[0]) * kx, (lat - target[1]) * ky];
  let best = null;
  segmentsOf(geometry).forEach((coords) => {
    for (let i = 1; i < coords.length; i += 1) {
      const [ax, ay] = project(coords[i - 1]);
      const [bx, by] = project(coords[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const dist = Math.hypot(px, py);
      if (!best || dist < best.distanceM) {
        best = { point: [target[0] + px / kx, target[1] + py / ky], distanceM: dist };
      }
    }
  });
  return best;
}

/** Ponto representativo: meio do comprimento (linha), media do anel (poligono). */
export function representativePoint(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates;
    const half = lineLengthMeters(coords) / 2;
    let walked = 0;
    for (let i = 1; i < coords.length; i += 1) {
      const step = haversineMeters(coords[i - 1], coords[i]);
      if (walked + step >= half) {
        const t = step === 0 ? 0 : (half - walked) / step;
        return [
          coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
          coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
        ];
      }
      walked += step;
    }
    return coords[coords.length - 1];
  }
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0].slice(0, -1);
    const sum = ring.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  return null;
}

/** GeoJSON -> posicoes Leaflet ([lat, lon]). */
export function toLeafletPositions(geometry) {
  if (!geometry) return [];
  const flip = ([lon, lat]) => [lat, lon];
  if (geometry.type === 'Point') return [flip(geometry.coordinates)];
  if (geometry.type === 'LineString') return geometry.coordinates.map(flip);
  if (geometry.type === 'Polygon') return geometry.coordinates.map((ring) => ring.map(flip));
  return [];
}

export function geometryBounds(geometry) {
  const flat = geometry?.type === 'Polygon' ? geometry.coordinates.flat()
    : geometry?.type === 'LineString' ? geometry.coordinates
      : geometry?.type === 'Point' ? [geometry.coordinates] : [];
  return flat.map(([lon, lat]) => [lat, lon]);
}

export const GEOMETRY_TYPE_LABELS = { Point: 'Ponto', LineString: 'Linha', Polygon: 'Polígono' };

export function formatMeters(value) {
  if (!Number.isFinite(value)) return '-';
  return value >= 1000 ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
    : `${Math.round(value).toLocaleString('pt-BR')} m`;
}

export function formatArea(value) {
  if (!Number.isFinite(value)) return '-';
  return value >= 10000 ? `${(value / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`
    : `${Math.round(value).toLocaleString('pt-BR')} m²`;
}
