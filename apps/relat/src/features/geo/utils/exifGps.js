/**
 * Extracao de coordenadas GPS do EXIF de um JPEG, 100% no navegador.
 *
 * Port direto de `worker/exif_gps.py` (stdlib Python) para JS com `DataView`:
 * parseia o segmento APP1/Exif -> bloco TIFF -> IFD0 -> GPS IFD na mao, com
 * bounds-check em cada passo. Tudo best-effort: qualquer dado ausente ou
 * malformado retorna `null` (nunca levanta). Mantem o mesmo escopo do worker
 * (JPEG/APP1) para que as duas pontas tratem GPS da mesma forma.
 */

// Tamanho em bytes de cada tipo de campo EXIF/TIFF.
const TYPE_SIZES = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL (2x uint32: num/den)
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

// Tags do GPS IFD.
const GPS_LAT_REF = 0x0001;
const GPS_LAT = 0x0002;
const GPS_LON_REF = 0x0003;
const GPS_LON = 0x0004;
// Ponteiro para o GPS IFD dentro do IFD0.
const GPS_IFD_POINTER = 0x8825;

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function hasExifHeader(data, offset) {
  for (let k = 0; k < EXIF_HEADER.length; k += 1) {
    if (data[offset + k] !== EXIF_HEADER[k]) return false;
  }
  return true;
}

/**
 * Localiza o bloco TIFF do segmento APP1/Exif e retorna seus bytes (subarray).
 * Todos os offsets de IFD do EXIF sao relativos ao inicio desse bloco TIFF
 * (logo apos `Exif\0\0`). Retorna `null` se nao houver Exif.
 */
function findExifTiff(data) {
  const n = data.length;
  if (n < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= n) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1];
    // Marcadores sem payload (SOI/EOI/RST/TEM): nao tem campo de tamanho.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start of Scan: acabou a area de metadados.
    if (marker === 0xda) break;
    const segLen = (data[i + 2] << 8) | data[i + 3]; // big-endian uint16
    if (segLen < 2) break;
    const segStart = i + 4;
    const segEnd = i + 2 + segLen;
    if (segEnd > n) break;
    if (marker === 0xe1 && segStart + 6 <= n && hasExifHeader(data, segStart)) {
      return data.subarray(segStart + 6, segEnd);
    }
    i = segEnd;
  }
  return null;
}

/** Le um IFD em `offset` e retorna a lista de entradas {tag, typ, cnt, valOffset}. */
function readIfd(view, len, little, offset) {
  if (offset < 0 || offset + 2 > len) return null;
  const count = view.getUint16(offset, little);
  const entries = [];
  const base = offset + 2;
  for (let k = 0; k < count; k += 1) {
    const e = base + k * 12;
    if (e + 12 > len) break;
    entries.push({
      tag: view.getUint16(e, little),
      typ: view.getUint16(e + 2, little),
      cnt: view.getUint32(e + 4, little),
      valOffset: e + 8, // posicao dos 4 bytes do val_field
    });
  }
  return entries;
}

/**
 * Resolve a posicao dos bytes de um campo: inline (<=4 bytes) ou no offset
 * apontado. Retorna {offset, size} dentro do mesmo `view`, ou `null`.
 */
function entryData(view, len, little, typ, cnt, valOffset) {
  const size = (TYPE_SIZES[typ] || 0) * cnt;
  if (size <= 0) return null;
  if (size <= 4) {
    return { offset: valOffset, size };
  }
  const off = view.getUint32(valOffset, little);
  if (off < 0 || off + size > len) return null;
  return { offset: off, size };
}

/** Converte 3 RATIONALs (graus, minutos, segundos) para graus decimais. */
function rationalsToDegrees(view, little, offset, size) {
  if (size < 24) return null;
  const parts = [];
  for (let k = 0; k < 3; k += 1) {
    const num = view.getUint32(offset + k * 8, little);
    const den = view.getUint32(offset + k * 8 + 4, little);
    if (den === 0) return null;
    parts.push(num / den);
  }
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}

/**
 * Retorna `[lat, lon]` em graus decimais a partir do EXIF, ou `null`.
 *
 * Best-effort: qualquer ausencia/erro -> `null`. Aplica o sinal pelos refs
 * (S/W negativos) e descarta coordenadas fora de faixa. `bytes` e um Uint8Array.
 */
export function extractGpsLatLon(bytes) {
  try {
    const tiff = findExifTiff(bytes);
    if (!tiff || tiff.length < 8) return null;

    let little;
    if (tiff[0] === 0x49 && tiff[1] === 0x49) {
      little = true; // "II"
    } else if (tiff[0] === 0x4d && tiff[1] === 0x4d) {
      little = false; // "MM"
    } else {
      return null;
    }

    const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
    const len = tiff.byteLength;

    const ifd0Offset = view.getUint32(4, little);
    const ifd0 = readIfd(view, len, little, ifd0Offset);
    if (!ifd0) return null;

    let gpsPointer = null;
    for (const entry of ifd0) {
      if (entry.tag === GPS_IFD_POINTER) {
        gpsPointer = view.getUint32(entry.valOffset, little);
        break;
      }
    }
    if (gpsPointer === null) return null;

    const gpsEntries = readIfd(view, len, little, gpsPointer);
    if (!gpsEntries) return null;

    const fields = new Map();
    for (const entry of gpsEntries) fields.set(entry.tag, entry);

    const refOf = (tag) => {
      const entry = fields.get(tag);
      if (!entry) return '';
      const data = entryData(view, len, little, entry.typ, entry.cnt, entry.valOffset);
      if (!data) return '';
      return String.fromCharCode(view.getUint8(data.offset)).toUpperCase();
    };

    const degreesOf = (tag) => {
      const entry = fields.get(tag);
      if (!entry) return null;
      const data = entryData(view, len, little, entry.typ, entry.cnt, entry.valOffset);
      if (!data) return null;
      return rationalsToDegrees(view, little, data.offset, data.size);
    };

    let latitude = degreesOf(GPS_LAT);
    let longitude = degreesOf(GPS_LON);
    if (latitude === null || longitude === null) return null;

    if (refOf(GPS_LAT_REF) === 'S') latitude = -latitude;
    if (refOf(GPS_LON_REF) === 'W') longitude = -longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return [latitude, longitude];
  } catch {
    // Parser defensivo: nunca propaga.
    return null;
  }
}

/**
 * Rejeita o sentinela "null island" (0,0) e coordenadas fora de faixa/nao-finitas.
 * Espelha `is_valid_latlon` de `worker/kmz_renderer.py` para nao jogar marcadores
 * no meio do Atlantico quando o EXIF traz placeholder 0/0.
 */
export function isValidLatLon(latitude, longitude) {
  if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}
