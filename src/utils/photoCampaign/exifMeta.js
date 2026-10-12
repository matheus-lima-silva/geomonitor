/**
 * Metadados EXIF de uma foto de campanha, lidos no navegador a partir do
 * cabecalho do JPEG (sem upload).
 *
 * Alem do GPS (ja coberto por `utils/exifGps.js`), le o que o app Timestamp
 * Camera grava e que preenche a vistoria: `ImageDescription` (etiqueta
 * "SIGLA\nNUMERO_DA_TORRE"), `DateTimeOriginal` (hora LOCAL, sem fuso),
 * Make/Model/Software e Orientation.
 *
 * Tudo best-effort: campos ausentes/invalidos viram `null`; nunca lanca.
 */
import { extractGpsLatLon, isValidLatLon, parseExifStructure } from '../exifGps';

const TAG_IMAGE_DESCRIPTION = 0x010e;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_ORIENTATION = 0x0112;
const TAG_SOFTWARE = 0x0131;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;

export const EMPTY_EXIF_META = Object.freeze({
  gpsLat: null,
  gpsLon: null,
  capturedAt: null,
  capturedDate: null,
  capturedTime: null,
  description: null,
  make: null,
  model: null,
  software: null,
  orientation: null,
});

const EXIF_DATETIME_RE = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

/**
 * Converte o texto EXIF "YYYY:MM:DD HH:MM:SS" (ou ISO sem fuso) em
 * `{ capturedAt, capturedDate, capturedTime }` como STRINGS locais — nunca
 * passa por `Date`/UTC, para o dia nao mudar perto da meia-noite. Placeholders
 * como "0000:00:00 00:00:00" retornam `null`.
 */
export function parseExifDateTime(text) {
  const match = EXIF_DATETIME_RE.exec(String(text || '').trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (h > 23 || mi > 59 || s > 60) return null;
  const capturedDate = `${year}-${month}-${day}`;
  const capturedTime = `${hour}:${minute}`;
  return {
    capturedAt: `${capturedDate}T${hour}:${minute}:${second}`,
    capturedDate,
    capturedTime,
  };
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\r\n?/g, '\n').trim();
  return text ? text : null;
}

/**
 * Extrai os metadados do EXIF de um JPEG (`bytes`: Uint8Array). Retorna sempre
 * um objeto com todas as chaves de `EMPTY_EXIF_META` (valores `null` quando
 * ausentes).
 */
export function extractExifMeta(bytes) {
  const meta = { ...EMPTY_EXIF_META };
  try {
    const parsed = parseExifStructure(bytes);
    if (!parsed) return meta;
    const { ifd0, exif, readAscii, readShort } = parsed;

    meta.description = cleanText(readAscii(ifd0.get(TAG_IMAGE_DESCRIPTION)));
    meta.make = cleanText(readAscii(ifd0.get(TAG_MAKE)));
    meta.model = cleanText(readAscii(ifd0.get(TAG_MODEL)));
    meta.software = cleanText(readAscii(ifd0.get(TAG_SOFTWARE)));

    const orientation = readShort(ifd0.get(TAG_ORIENTATION));
    meta.orientation = Number.isFinite(orientation) && orientation >= 1 && orientation <= 8 ? orientation : null;

    // Ordem de preferencia da data: DateTimeOriginal -> DateTimeDigitized -> DateTime.
    const candidates = [
      exif ? readAscii(exif.get(TAG_DATETIME_ORIGINAL)) : null,
      exif ? readAscii(exif.get(TAG_DATETIME_DIGITIZED)) : null,
      readAscii(ifd0.get(TAG_DATETIME)),
    ];
    for (const candidate of candidates) {
      const parsedDate = parseExifDateTime(candidate);
      if (parsedDate) {
        Object.assign(meta, parsedDate);
        break;
      }
    }

    const coords = extractGpsLatLon(bytes);
    if (coords && isValidLatLon(coords[0], coords[1])) {
      meta.gpsLat = coords[0];
      meta.gpsLon = coords[1];
    }
  } catch {
    // best-effort: devolve o que conseguiu ler
  }
  return meta;
}

/**
 * Le os primeiros `maxBytes` de um File/Blob e devolve `extractExifMeta` do
 * cabecalho, ou `null` para entrada invalida. Nunca lanca.
 */
export async function readExifMetaFromFile(file, maxBytes = 262144) {
  try {
    if (!file || typeof file.slice !== 'function' || typeof file.arrayBuffer !== 'function') {
      return null;
    }
    const head = file.slice(0, maxBytes);
    const buffer = await head.arrayBuffer();
    return extractExifMeta(new Uint8Array(buffer));
  } catch {
    return null;
  }
}
