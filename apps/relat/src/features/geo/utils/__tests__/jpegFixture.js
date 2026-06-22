/**
 * Builder de JPEG minimo (SOI + APP1/Exif + EOI) com um GPS IFD, montado byte a
 * byte — port direto de `build_minimal_jpeg_with_gps` em
 * `worker/tests/test_runtime.py`. Sem `.test.` no nome para o runner ignorar.
 *
 * Layout do bloco TIFF (little-endian), offsets relativos ao inicio do TIFF:
 *   8   IFD0 (1 entry -> GPS IFD pointer @26)
 *   26  GPS IFD (4 entries: LatRef, Lat@80, LonRef, Lon@104)
 *   80  3 rationals da latitude
 *   104 3 rationals da longitude
 */

function u16le(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32le(value) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

function u16be(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

export function buildMinimalJpegWithGps({
  latDms = [22, 30, 0],
  latRef = 'S',
  lonDms = [43, 15, 0],
  lonRef = 'W',
  breakDen = false,
  badOffset = false,
} = {}) {
  const rationals = (dms) => {
    const out = [];
    for (const value of dms) {
      out.push(...u32le(Math.trunc(value)));
      out.push(...u32le(breakDen ? 0 : 1));
    }
    return out;
  };

  const latOff = badOffset ? 9999 : 80;

  const tiff = [];
  // Header TIFF: "II" + magic 42 + offset 8 do IFD0 (8 bytes).
  tiff.push(0x49, 0x49, ...u16le(42), ...u32le(8));
  // IFD0 @8: 1 entry -> GPS IFD pointer @26.
  tiff.push(...u16le(1));
  tiff.push(...u16le(0x8825), ...u16le(4), ...u32le(1), ...u32le(26));
  tiff.push(...u32le(0)); // next IFD = 0
  // GPS IFD @26: 4 entries.
  tiff.push(...u16le(4));
  tiff.push(...u16le(0x0001), ...u16le(2), ...u32le(2), latRef.charCodeAt(0), 0, 0, 0);
  tiff.push(...u16le(0x0002), ...u16le(5), ...u32le(3), ...u32le(latOff));
  tiff.push(...u16le(0x0003), ...u16le(2), ...u32le(2), lonRef.charCodeAt(0), 0, 0, 0);
  tiff.push(...u16le(0x0004), ...u16le(5), ...u32le(3), ...u32le(104));
  tiff.push(...u32le(0)); // next IFD = 0
  // data @80 (lat), @104 (lon).
  tiff.push(...rationals(latDms));
  tiff.push(...rationals(lonDms));

  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + TIFF
  const app1 = [0xff, 0xe1, ...u16be(exif.length + 2), ...exif];
  return Uint8Array.from([0xff, 0xd8, ...app1, 0xff, 0xd9]);
}

// JPEG valido (SOI + EOI) sem qualquer EXIF — serve de "foto sem GPS".
export function buildJpegWithoutExif() {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
}
