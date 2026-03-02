const WGS84_A = 6378137.0;
const WGS84_ECC_SQUARED = 0.00669438;
const UTM_SCALE_FACTOR = 0.9996;

function toTrimmedString(value) {
  return String(value ?? '').trim();
}

export function parseCoordinateNumber(value) {
  const normalized = toTrimmedString(value).replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDecimalCoordinate(value, digits = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(digits);
}

export function normalizeLocationCoordinates(erosion = {}) {
  const source = (erosion && typeof erosion.locationCoordinates === 'object' && erosion.locationCoordinates !== null)
    ? erosion.locationCoordinates
    : {};

  return {
    latitude: toTrimmedString(source.latitude || erosion.latitude),
    longitude: toTrimmedString(source.longitude || erosion.longitude),
    utmEasting: toTrimmedString(source.utmEasting),
    utmNorthing: toTrimmedString(source.utmNorthing),
    utmZone: toTrimmedString(source.utmZone),
    utmHemisphere: toTrimmedString(source.utmHemisphere).toUpperCase(),
    altitude: toTrimmedString(source.altitude),
    reference: toTrimmedString(source.reference),
  };
}

export function isCompleteUtmCoordinates(locationCoordinates = {}) {
  const utmEasting = toTrimmedString(locationCoordinates.utmEasting);
  const utmNorthing = toTrimmedString(locationCoordinates.utmNorthing);
  const utmZone = toTrimmedString(locationCoordinates.utmZone);
  const utmHemisphere = toTrimmedString(locationCoordinates.utmHemisphere).toUpperCase();
  return !!utmEasting && !!utmNorthing && !!utmZone && (utmHemisphere === 'N' || utmHemisphere === 'S');
}

export function isPartialUtmCoordinates(locationCoordinates = {}) {
  const values = [
    toTrimmedString(locationCoordinates.utmEasting),
    toTrimmedString(locationCoordinates.utmNorthing),
    toTrimmedString(locationCoordinates.utmZone),
    toTrimmedString(locationCoordinates.utmHemisphere),
  ];
  const filled = values.filter(Boolean).length;
  return filled > 0 && filled < values.length;
}

export function convertUtmToDecimalWgs84({
  zone,
  hemisphere,
  easting,
  northing,
}) {
  const zoneValue = Number.parseInt(String(zone || '').trim(), 10);
  const hemisphereValue = String(hemisphere || '').trim().toUpperCase();
  const eastingValue = parseCoordinateNumber(easting);
  const northingValue = parseCoordinateNumber(northing);

  if (!Number.isInteger(zoneValue) || zoneValue < 1 || zoneValue > 60) return null;
  if (!['N', 'S'].includes(hemisphereValue)) return null;
  if (!Number.isFinite(eastingValue) || !Number.isFinite(northingValue)) return null;

  const eccPrimeSquared = WGS84_ECC_SQUARED / (1 - WGS84_ECC_SQUARED);
  const e1 = (1 - Math.sqrt(1 - WGS84_ECC_SQUARED)) / (1 + Math.sqrt(1 - WGS84_ECC_SQUARED));

  const x = eastingValue - 500000.0;
  let y = northingValue;
  if (hemisphereValue === 'S') {
    y -= 10000000.0;
  }

  const longOrigin = ((zoneValue - 1) * 6) - 180 + 3;

  const m = y / UTM_SCALE_FACTOR;
  const mu = m / (WGS84_A * (1
    - (WGS84_ECC_SQUARED / 4)
    - ((3 * (WGS84_ECC_SQUARED ** 2)) / 64)
    - ((5 * (WGS84_ECC_SQUARED ** 3)) / 256)));

  const phi1Rad = mu
    + ((3 * e1) / 2 - (27 * (e1 ** 3)) / 32) * Math.sin(2 * mu)
    + ((21 * (e1 ** 2)) / 16 - (55 * (e1 ** 4)) / 32) * Math.sin(4 * mu)
    + ((151 * (e1 ** 3)) / 96) * Math.sin(6 * mu)
    + ((1097 * (e1 ** 4)) / 512) * Math.sin(8 * mu);

  const n1 = WGS84_A / Math.sqrt(1 - WGS84_ECC_SQUARED * (Math.sin(phi1Rad) ** 2));
  const t1 = Math.tan(phi1Rad) ** 2;
  const c1 = eccPrimeSquared * (Math.cos(phi1Rad) ** 2);
  const r1 = WGS84_A * (1 - WGS84_ECC_SQUARED)
    / ((1 - WGS84_ECC_SQUARED * (Math.sin(phi1Rad) ** 2)) ** 1.5);
  const d = x / (n1 * UTM_SCALE_FACTOR);

  const latRad = phi1Rad - ((n1 * Math.tan(phi1Rad)) / r1)
    * ((d ** 2) / 2
      - ((5 + (3 * t1) + (10 * c1) - (4 * (c1 ** 2)) - (9 * eccPrimeSquared)) * (d ** 4)) / 24
      + ((61 + (90 * t1) + (298 * c1) + (45 * (t1 ** 2)) - (252 * eccPrimeSquared) - (3 * (c1 ** 2))) * (d ** 6)) / 720);

  const lonRad = ((d
    - ((1 + (2 * t1) + c1) * (d ** 3)) / 6
    + ((5 - (2 * c1) + (28 * t1) - (3 * (c1 ** 2)) + (8 * eccPrimeSquared) + (24 * (t1 ** 2))) * (d ** 5)) / 120)
    / Math.cos(phi1Rad));

  const latitude = latRad * (180 / Math.PI);
  const longitude = longOrigin + (lonRad * (180 / Math.PI));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function hasValidDecimalCoordinates(input = {}) {
  const locationCoordinates = normalizeLocationCoordinates(input);
  const latitude = parseCoordinateNumber(locationCoordinates.latitude);
  const longitude = parseCoordinateNumber(locationCoordinates.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function resolveLocationCoordinatesForSave(input = {}) {
  const locationCoordinates = normalizeLocationCoordinates(input);
  if (isPartialUtmCoordinates(locationCoordinates)) {
    return {
      ok: false,
      error: 'Preencha todos os campos UTM ou deixe todos vazios.',
      locationCoordinates,
    };
  }

  if (isCompleteUtmCoordinates(locationCoordinates)) {
    const converted = convertUtmToDecimalWgs84({
      zone: locationCoordinates.utmZone,
      hemisphere: locationCoordinates.utmHemisphere,
      easting: locationCoordinates.utmEasting,
      northing: locationCoordinates.utmNorthing,
    });
    if (!converted) {
      return {
        ok: false,
        error: 'Coordenadas UTM invalidas.',
        locationCoordinates,
      };
    }
    locationCoordinates.latitude = formatDecimalCoordinate(converted.latitude);
    locationCoordinates.longitude = formatDecimalCoordinate(converted.longitude);
  }

  return {
    ok: true,
    locationCoordinates,
    latitude: locationCoordinates.latitude,
    longitude: locationCoordinates.longitude,
  };
}
