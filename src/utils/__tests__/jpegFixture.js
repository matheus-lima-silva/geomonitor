/**
 * Builder de JPEG minimo (SOI + APP1/Exif + EOI) montado byte a byte para os
 * testes dos parsers EXIF. Sem `.test.` no nome para o runner ignorar.
 *
 * Evoluiu do port de `build_minimal_jpeg_with_gps` (worker/tests/test_runtime.py):
 * agora e um mini-builder TIFF com offsets calculados, que aceita big-endian
 * ("MM", como as fotos reais do Timestamp Camera) ou little-endian ("II"),
 * tags do IFD0 (ImageDescription, Make, Model, Software, Orientation, DateTime),
 * um Exif SubIFD (DateTimeOriginal, DateTimeDigitized) e o GPS IFD.
 *
 * Layout do bloco TIFF (offsets relativos ao inicio do TIFF):
 *   0   cabecalho (byte order + 42 + offset do IFD0 = 8)
 *   8   IFD0 (entries + ponteiros 0x8769/0x8825 quando houver)
 *   ... Exif SubIFD (se houver tags Exif)
 *   ... GPS IFD (se houver GPS)
 *   ... area de dados (ASCII > 4 bytes, rationals)
 */

const TYPE_ASCII = 2;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

function u16(value, little) {
  const hi = (value >> 8) & 0xff;
  const lo = value & 0xff;
  return little ? [lo, hi] : [hi, lo];
}

function u32(value, little) {
  const b0 = value & 0xff;
  const b1 = (value >> 8) & 0xff;
  const b2 = (value >> 16) & 0xff;
  const b3 = (value >>> 24) & 0xff;
  return little ? [b0, b1, b2, b3] : [b3, b2, b1, b0];
}

function u16be(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function asciiBytes(text) {
  const out = [];
  for (const ch of String(text)) out.push(ch.charCodeAt(0) & 0xff);
  out.push(0); // NUL terminador, como no EXIF real
  return out;
}

function rationalBytes(values, little, { breakDen = false } = {}) {
  const out = [];
  for (const value of values) {
    out.push(...u32(Math.trunc(value), little));
    out.push(...u32(breakDen ? 0 : 1, little));
  }
  return out;
}

/**
 * Serializa uma lista de IFDs. Cada IFD e uma lista de entries
 * `{ tag, type, count, bytes, forceOffset }`; ponteiros entre IFDs sao
 * resolvidos em duas passadas (tamanhos dependem so da contagem de entries).
 */
function buildTiff({ little, ifd0, exif, gps }) {
  const ifdSize = (entries) => 2 + entries.length * 12 + 4;

  const hasExif = exif.length > 0;
  const hasGps = gps.length > 0;

  const ifd0Entries = [...ifd0];
  const ifd0Offset = 8;
  // Reserva os ponteiros no IFD0 antes de medir.
  if (hasExif) ifd0Entries.push({ tag: 0x8769, type: TYPE_LONG, count: 1, pointer: 'exif' });
  if (hasGps) ifd0Entries.push({ tag: 0x8825, type: TYPE_LONG, count: 1, pointer: 'gps' });
  ifd0Entries.sort((a, b) => a.tag - b.tag);

  const exifOffset = ifd0Offset + ifdSize(ifd0Entries);
  const gpsOffset = exifOffset + (hasExif ? ifdSize(exif) : 0);
  const dataStart = gpsOffset + (hasGps ? ifdSize(gps) : 0);

  const data = [];
  const pointers = { exif: exifOffset, gps: gpsOffset };

  const encodeIfd = (entries) => {
    const out = [];
    out.push(...u16(entries.length, little));
    for (const entry of entries) {
      out.push(...u16(entry.tag, little));
      out.push(...u16(entry.type, little));
      out.push(...u32(entry.count, little));
      if (entry.pointer) {
        out.push(...u32(pointers[entry.pointer], little));
        continue;
      }
      const bytes = entry.bytes;
      if (Number.isFinite(entry.forceOffset)) {
        out.push(...u32(entry.forceOffset, little));
        data.push(...bytes); // mantem o dado no lugar, mas o ponteiro aponta errado
      } else if (bytes.length <= 4) {
        out.push(...bytes, ...new Array(4 - bytes.length).fill(0));
      } else {
        out.push(...u32(dataStart + data.length, little));
        data.push(...bytes);
      }
    }
    out.push(...u32(0, little)); // next IFD
    return out;
  };

  const tiff = [];
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42, little), ...u32(ifd0Offset, little));
  tiff.push(...encodeIfd(ifd0Entries));
  if (hasExif) tiff.push(...encodeIfd(exif));
  if (hasGps) tiff.push(...encodeIfd(gps));
  tiff.push(...data);
  return tiff;
}

function wrapJpeg(tiff) {
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + TIFF
  const app1 = [0xff, 0xe1, ...u16be(exif.length + 2), ...exif];
  return Uint8Array.from([0xff, 0xd8, ...app1, 0xff, 0xd9]);
}

/**
 * Builder completo. Todas as tags sao opcionais; `withGps` controla o GPS IFD.
 */
export function buildJpegWithExif({
  bigEndian = false,
  withGps = true,
  latDms = [22, 30, 0],
  latRef = 'S',
  lonDms = [43, 15, 0],
  lonRef = 'W',
  breakDen = false,
  badOffset = false,
  imageDescription,
  make,
  model,
  software,
  orientation,
  dateTime,
  dateTimeOriginal,
  dateTimeDigitized,
} = {}) {
  const little = !bigEndian;

  const ascii = (tag, text) => ({ tag, type: TYPE_ASCII, count: text.length + 1, bytes: asciiBytes(text) });

  const ifd0 = [];
  if (imageDescription != null) ifd0.push(ascii(0x010e, imageDescription));
  if (make != null) ifd0.push(ascii(0x010f, make));
  if (model != null) ifd0.push(ascii(0x0110, model));
  if (orientation != null) ifd0.push({ tag: 0x0112, type: TYPE_SHORT, count: 1, bytes: u16(orientation, little) });
  if (software != null) ifd0.push(ascii(0x0131, software));
  if (dateTime != null) ifd0.push(ascii(0x0132, dateTime));

  const exif = [];
  if (dateTimeOriginal != null) exif.push(ascii(0x9003, dateTimeOriginal));
  if (dateTimeDigitized != null) exif.push(ascii(0x9004, dateTimeDigitized));

  const gps = [];
  if (withGps) {
    gps.push({ tag: 0x0001, type: TYPE_ASCII, count: 2, bytes: [latRef.charCodeAt(0), 0] });
    gps.push({
      tag: 0x0002,
      type: TYPE_RATIONAL,
      count: 3,
      bytes: rationalBytes(latDms, little, { breakDen }),
      forceOffset: badOffset ? 9999 : undefined,
    });
    gps.push({ tag: 0x0003, type: TYPE_ASCII, count: 2, bytes: [lonRef.charCodeAt(0), 0] });
    gps.push({ tag: 0x0004, type: TYPE_RATIONAL, count: 3, bytes: rationalBytes(lonDms, little, { breakDen }) });
  }

  return wrapJpeg(buildTiff({ little, ifd0, exif, gps }));
}

/** Compatibilidade: JPEG so com GPS IFD (little-endian por padrao). */
export function buildMinimalJpegWithGps(options = {}) {
  return buildJpegWithExif({ ...options, withGps: true });
}

/** JPEG com Exif (descricao/data/etc.) mas SEM GPS IFD. */
export function buildJpegWithExifNoGps(options = {}) {
  return buildJpegWithExif({ ...options, withGps: false });
}

// JPEG valido (SOI + EOI) sem qualquer EXIF — serve de "foto sem GPS".
export function buildJpegWithoutExif() {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
}
