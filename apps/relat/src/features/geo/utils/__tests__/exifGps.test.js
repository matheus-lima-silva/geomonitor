import { describe, it, expect } from 'vitest';

import { extractGpsLatLon, isValidLatLon } from '../exifGps';
import { buildMinimalJpegWithGps, buildJpegWithoutExif } from './jpegFixture';

describe('extractGpsLatLon', () => {
  it('extrai lat/lon e aplica sinais S/W (negativos)', () => {
    const result = extractGpsLatLon(buildMinimalJpegWithGps());
    expect(result).not.toBeNull();
    expect(result[0]).toBeCloseTo(-22.5, 6); // 22 + 30/60
    expect(result[1]).toBeCloseTo(-43.25, 6); // 43 + 15/60
  });

  it('mantem positivo para refs N/E', () => {
    const result = extractGpsLatLon(buildMinimalJpegWithGps({ latRef: 'N', lonRef: 'E' }));
    expect(result[0]).toBeCloseTo(22.5, 6);
    expect(result[1]).toBeCloseTo(43.25, 6);
  });

  it('retorna null quando o denominador do rational e zero', () => {
    expect(extractGpsLatLon(buildMinimalJpegWithGps({ breakDen: true }))).toBeNull();
  });

  it('retorna null quando o offset do campo aponta fora do TIFF', () => {
    expect(extractGpsLatLon(buildMinimalJpegWithGps({ badOffset: true }))).toBeNull();
  });

  it('retorna null para JPEG sem EXIF', () => {
    expect(extractGpsLatLon(buildJpegWithoutExif())).toBeNull();
  });

  it('retorna null para bytes que nao sao JPEG', () => {
    expect(extractGpsLatLon(Uint8Array.from([0, 1, 2, 3, 4, 5]))).toBeNull();
    expect(extractGpsLatLon(new Uint8Array(0))).toBeNull();
  });
});

describe('isValidLatLon', () => {
  it('aceita coordenadas reais', () => {
    expect(isValidLatLon(-22.5, -43.25)).toBe(true);
  });

  it('rejeita a "null island" (0,0)', () => {
    expect(isValidLatLon(0, 0)).toBe(false);
  });

  it('rejeita fora de faixa, nao-finito e nulo', () => {
    expect(isValidLatLon(91, 0)).toBe(false);
    expect(isValidLatLon(0, 181)).toBe(false);
    expect(isValidLatLon(Number.NaN, 10)).toBe(false);
    expect(isValidLatLon(null, undefined)).toBe(false);
  });
});
