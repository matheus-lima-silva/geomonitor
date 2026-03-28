var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../src/features/shared/erosionCoordinates.js
var erosionCoordinates_exports = {};
__export(erosionCoordinates_exports, {
  convertDecimalToUtm: () => convertDecimalToUtm,
  convertUtmToDecimalWgs84: () => convertUtmToDecimalWgs84,
  decimalToDms: () => decimalToDms,
  dmsToDecimal: () => dmsToDecimal,
  formatDecimalCoordinate: () => formatDecimalCoordinate,
  hasValidDecimalCoordinates: () => hasValidDecimalCoordinates,
  isCompleteUtmCoordinates: () => isCompleteUtmCoordinates,
  isPartialUtmCoordinates: () => isPartialUtmCoordinates,
  normalizeLocationCoordinates: () => normalizeLocationCoordinates,
  parseCoordinateNumber: () => parseCoordinateNumber,
  parseDmsCoordinate: () => parseDmsCoordinate,
  parseUtmNumber: () => parseUtmNumber,
  resolveLocationCoordinatesForSave: () => resolveLocationCoordinatesForSave,
  syncCoordinateFields: () => syncCoordinateFields
});
module.exports = __toCommonJS(erosionCoordinates_exports);
var WGS84_A = 6378137;
var WGS84_ECC_SQUARED = 669438e-8;
var UTM_SCALE_FACTOR = 0.9996;
function toTrimmedString(value) {
  return String(value ?? "").trim();
}
function parseCoordinateNumber(value) {
  const normalized = toTrimmedString(value).replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseUtmNumber(value) {
  let text = toTrimmedString(value);
  if (!text) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  text = text.replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatDecimalCoordinate(value, digits = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(digits);
}
function normalizeLocationCoordinates(erosion = {}) {
  const source = erosion && typeof erosion.locationCoordinates === "object" && erosion.locationCoordinates !== null ? erosion.locationCoordinates : {};
  return {
    latitude: toTrimmedString(source.latitude || erosion.latitude),
    longitude: toTrimmedString(source.longitude || erosion.longitude),
    utmEasting: toTrimmedString(source.utmEasting),
    utmNorthing: toTrimmedString(source.utmNorthing),
    utmZone: toTrimmedString(source.utmZone),
    utmHemisphere: toTrimmedString(source.utmHemisphere).toUpperCase(),
    dmsLatitude: toTrimmedString(source.dmsLatitude),
    dmsLongitude: toTrimmedString(source.dmsLongitude),
    altitude: toTrimmedString(source.altitude),
    reference: toTrimmedString(source.reference)
  };
}
function isCompleteUtmCoordinates(locationCoordinates = {}) {
  const utmEasting = toTrimmedString(locationCoordinates.utmEasting);
  const utmNorthing = toTrimmedString(locationCoordinates.utmNorthing);
  const utmZone = toTrimmedString(locationCoordinates.utmZone);
  const utmHemisphere = toTrimmedString(locationCoordinates.utmHemisphere).toUpperCase();
  return !!utmEasting && !!utmNorthing && !!utmZone && (utmHemisphere === "N" || utmHemisphere === "S");
}
function isPartialUtmCoordinates(locationCoordinates = {}) {
  const values = [
    toTrimmedString(locationCoordinates.utmEasting),
    toTrimmedString(locationCoordinates.utmNorthing),
    toTrimmedString(locationCoordinates.utmZone),
    toTrimmedString(locationCoordinates.utmHemisphere)
  ];
  const filled = values.filter(Boolean).length;
  return filled > 0 && filled < values.length;
}
function convertUtmToDecimalWgs84({
  zone,
  hemisphere,
  easting,
  northing
}) {
  const zoneValue = Number.parseInt(String(zone || "").trim(), 10);
  const hemisphereValue = String(hemisphere || "").trim().toUpperCase();
  const eastingValue = parseUtmNumber(easting);
  const northingValue = parseUtmNumber(northing);
  if (!Number.isInteger(zoneValue) || zoneValue < 1 || zoneValue > 60) return null;
  if (!["N", "S"].includes(hemisphereValue)) return null;
  if (!Number.isFinite(eastingValue) || !Number.isFinite(northingValue)) return null;
  const eccPrimeSquared = WGS84_ECC_SQUARED / (1 - WGS84_ECC_SQUARED);
  const e1 = (1 - Math.sqrt(1 - WGS84_ECC_SQUARED)) / (1 + Math.sqrt(1 - WGS84_ECC_SQUARED));
  const x = eastingValue - 5e5;
  let y = northingValue;
  if (hemisphereValue === "S") {
    y -= 1e7;
  }
  const longOrigin = (zoneValue - 1) * 6 - 180 + 3;
  const m = y / UTM_SCALE_FACTOR;
  const mu = m / (WGS84_A * (1 - WGS84_ECC_SQUARED / 4 - 3 * WGS84_ECC_SQUARED ** 2 / 64 - 5 * WGS84_ECC_SQUARED ** 3 / 256));
  const phi1Rad = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + 151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const n1 = WGS84_A / Math.sqrt(1 - WGS84_ECC_SQUARED * Math.sin(phi1Rad) ** 2);
  const t1 = Math.tan(phi1Rad) ** 2;
  const c1 = eccPrimeSquared * Math.cos(phi1Rad) ** 2;
  const r1 = WGS84_A * (1 - WGS84_ECC_SQUARED) / (1 - WGS84_ECC_SQUARED * Math.sin(phi1Rad) ** 2) ** 1.5;
  const d = x / (n1 * UTM_SCALE_FACTOR);
  const latRad = phi1Rad - n1 * Math.tan(phi1Rad) / r1 * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccPrimeSquared) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccPrimeSquared - 3 * c1 ** 2) * d ** 6 / 720);
  const lonRad = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccPrimeSquared + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(phi1Rad);
  const latitude = latRad * (180 / Math.PI);
  const longitude = longOrigin + lonRad * (180 / Math.PI);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
function convertDecimalToUtm(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -80 || lat > 84) return null;
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const lonOriginRad = lonOrigin * Math.PI / 180;
  const eccPrimeSquared = WGS84_ECC_SQUARED / (1 - WGS84_ECC_SQUARED);
  const N = WGS84_A / Math.sqrt(1 - WGS84_ECC_SQUARED * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = eccPrimeSquared * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);
  const M = WGS84_A * ((1 - WGS84_ECC_SQUARED / 4 - 3 * WGS84_ECC_SQUARED ** 2 / 64 - 5 * WGS84_ECC_SQUARED ** 3 / 256) * latRad - (3 * WGS84_ECC_SQUARED / 8 + 3 * WGS84_ECC_SQUARED ** 2 / 32 + 45 * WGS84_ECC_SQUARED ** 3 / 1024) * Math.sin(2 * latRad) + (15 * WGS84_ECC_SQUARED ** 2 / 256 + 45 * WGS84_ECC_SQUARED ** 3 / 1024) * Math.sin(4 * latRad) - 35 * WGS84_ECC_SQUARED ** 3 / 3072 * Math.sin(6 * latRad));
  const easting = UTM_SCALE_FACTOR * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * eccPrimeSquared) * A ** 5 / 120) + 5e5;
  let northing = UTM_SCALE_FACTOR * (M + N * Math.tan(latRad) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * eccPrimeSquared) * A ** 6 / 720));
  if (lat < 0) northing += 1e7;
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  return {
    easting: Math.round(easting),
    northing: Math.round(northing),
    zone,
    hemisphere: lat >= 0 ? "N" : "S"
  };
}
function parseDmsCoordinate(text) {
  const raw = toTrimmedString(text);
  if (!raw) return null;
  const structured = raw.match(
    /^(-?)(\d{1,3})\s*[°ºd]\s*(\d{1,2})\s*['''m]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["""s])?\s*([NSEWnsew]?)$/
  );
  if (structured) {
    const sign = structured[1] === "-" ? -1 : 1;
    const hemi = structured[5].toUpperCase();
    return {
      degrees: Number(structured[2]),
      minutes: Number(structured[3]),
      seconds: Number(structured[4].replace(",", ".")),
      hemisphere: hemi || (sign < 0 ? "" : ""),
      sign: hemi === "S" || hemi === "W" ? -1 : sign
    };
  }
  const separated = raw.match(
    /^(-?)(\d{1,3})\s*[:°ºd\s]\s*(\d{1,2})\s*[:'''m\s]\s*(\d{1,2}(?:[.,]\d+)?)\s*([NSEWnsew]?)$/
  );
  if (separated) {
    const sign = separated[1] === "-" ? -1 : 1;
    const hemi = separated[5].toUpperCase();
    return {
      degrees: Number(separated[2]),
      minutes: Number(separated[3]),
      seconds: Number(separated[4].replace(",", ".")),
      hemisphere: hemi || "",
      sign: hemi === "S" || hemi === "W" ? -1 : sign
    };
  }
  return null;
}
function dmsToDecimal(dms) {
  if (!dms || !Number.isFinite(dms.degrees)) return null;
  const dec = dms.degrees + (dms.minutes || 0) / 60 + (dms.seconds || 0) / 3600;
  const sign = dms.sign ?? (dms.hemisphere === "S" || dms.hemisphere === "W" ? -1 : 1);
  const result = dec * sign;
  return Number.isFinite(result) ? result : null;
}
function decimalToDms(decimal, axis = "lat") {
  if (!Number.isFinite(decimal)) return "";
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = (minFull - min) * 60;
  const hemi = axis === "lat" ? decimal >= 0 ? "N" : "S" : decimal >= 0 ? "E" : "W";
  return `${deg}\xB0${String(min).padStart(2, "0")}'${sec.toFixed(2).padStart(5, "0")}"${hemi}`;
}
function syncCoordinateFields(changedGroup, coords) {
  const loc = { ...coords };
  if (changedGroup === "decimal") {
    const lat = parseCoordinateNumber(loc.latitude);
    const lon = parseCoordinateNumber(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return loc;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return loc;
    loc.dmsLatitude = decimalToDms(lat, "lat");
    loc.dmsLongitude = decimalToDms(lon, "lon");
    const utm = convertDecimalToUtm(lat, lon);
    if (utm) {
      loc.utmEasting = String(utm.easting);
      loc.utmNorthing = String(utm.northing);
      loc.utmZone = String(utm.zone);
      loc.utmHemisphere = utm.hemisphere;
    }
    return loc;
  }
  if (changedGroup === "utm") {
    if (!isCompleteUtmCoordinates(loc)) return loc;
    const result = convertUtmToDecimalWgs84({
      zone: loc.utmZone,
      hemisphere: loc.utmHemisphere,
      easting: loc.utmEasting,
      northing: loc.utmNorthing
    });
    if (!result) return loc;
    loc.latitude = formatDecimalCoordinate(result.latitude);
    loc.longitude = formatDecimalCoordinate(result.longitude);
    loc.dmsLatitude = decimalToDms(result.latitude, "lat");
    loc.dmsLongitude = decimalToDms(result.longitude, "lon");
    return loc;
  }
  if (changedGroup === "dms") {
    const dmsLat = parseDmsCoordinate(loc.dmsLatitude);
    const dmsLon = parseDmsCoordinate(loc.dmsLongitude);
    if (!dmsLat || !dmsLon) return loc;
    const lat = dmsToDecimal(dmsLat);
    const lon = dmsToDecimal(dmsLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return loc;
    loc.latitude = formatDecimalCoordinate(lat);
    loc.longitude = formatDecimalCoordinate(lon);
    const utm = convertDecimalToUtm(lat, lon);
    if (utm) {
      loc.utmEasting = String(utm.easting);
      loc.utmNorthing = String(utm.northing);
      loc.utmZone = String(utm.zone);
      loc.utmHemisphere = utm.hemisphere;
    }
    return loc;
  }
  return loc;
}
function hasValidDecimalCoordinates(input = {}) {
  const locationCoordinates = normalizeLocationCoordinates(input);
  const latitude = parseCoordinateNumber(locationCoordinates.latitude);
  const longitude = parseCoordinateNumber(locationCoordinates.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
function resolveLocationCoordinatesForSave(input = {}) {
  const locationCoordinates = normalizeLocationCoordinates(input);
  if (isPartialUtmCoordinates(locationCoordinates)) {
    return {
      ok: false,
      error: "Preencha todos os campos UTM ou deixe todos vazios.",
      locationCoordinates
    };
  }
  if (isCompleteUtmCoordinates(locationCoordinates)) {
    const converted = convertUtmToDecimalWgs84({
      zone: locationCoordinates.utmZone,
      hemisphere: locationCoordinates.utmHemisphere,
      easting: locationCoordinates.utmEasting,
      northing: locationCoordinates.utmNorthing
    });
    if (!converted) {
      return {
        ok: false,
        error: "Coordenadas UTM invalidas.",
        locationCoordinates
      };
    }
    locationCoordinates.latitude = formatDecimalCoordinate(converted.latitude);
    locationCoordinates.longitude = formatDecimalCoordinate(converted.longitude);
  }
  if (!locationCoordinates.latitude && !locationCoordinates.longitude) {
    const dmsLat = parseDmsCoordinate(locationCoordinates.dmsLatitude);
    const dmsLon = parseDmsCoordinate(locationCoordinates.dmsLongitude);
    if (dmsLat && dmsLon) {
      const lat = dmsToDecimal(dmsLat);
      const lon = dmsToDecimal(dmsLon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        locationCoordinates.latitude = formatDecimalCoordinate(lat);
        locationCoordinates.longitude = formatDecimalCoordinate(lon);
      }
    }
  }
  return {
    ok: true,
    locationCoordinates,
    latitude: locationCoordinates.latitude,
    longitude: locationCoordinates.longitude
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convertDecimalToUtm,
  convertUtmToDecimalWgs84,
  decimalToDms,
  dmsToDecimal,
  formatDecimalCoordinate,
  hasValidDecimalCoordinates,
  isCompleteUtmCoordinates,
  isPartialUtmCoordinates,
  normalizeLocationCoordinates,
  parseCoordinateNumber,
  parseDmsCoordinate,
  parseUtmNumber,
  resolveLocationCoordinatesForSave,
  syncCoordinateFields
});
