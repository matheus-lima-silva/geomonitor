import { describe, it, expect } from 'vitest';

import { EMPTY_EXIF_META, extractExifMeta, parseExifDateTime, readExifMetaFromFile } from '../photoCampaign/exifMeta';
import { buildJpegWithExif, buildJpegWithExifNoGps, buildJpegWithoutExif } from './jpegFixture';

const TIMESTAMP_CAMERA = {
  imageDescription: 'BMDOPR\n126',
  make: 'samsung',
  model: 'SM-S911B',
  software: 'Timestamp Camera',
  orientation: 1,
  dateTime: '2026:09:22 14:14:00',
  dateTimeOriginal: '2026:09:22 14:14:00',
  dateTimeDigitized: '2026:09:22 14:14:00',
  latDms: [20, 4, 27],
  latRef: 'S',
  lonDms: [44, 49, 33],
  lonRef: 'W',
};

describe('parseExifDateTime', () => {
  it('converte o formato EXIF em strings locais sem passar por Date', () => {
    expect(parseExifDateTime('2026:09:22 14:14:00')).toEqual({
      capturedAt: '2026-09-22T14:14:00',
      capturedDate: '2026-09-22',
      capturedTime: '14:14',
    });
  });

  it('aceita ISO sem fuso e ignora sufixos', () => {
    expect(parseExifDateTime('2026-09-22T23:59:30Z').capturedDate).toBe('2026-09-22');
  });

  it('rejeita placeholder, lixo e vazio', () => {
    expect(parseExifDateTime('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDateTime('2026:13:40 10:00:00')).toBeNull();
    expect(parseExifDateTime('ontem')).toBeNull();
    expect(parseExifDateTime('')).toBeNull();
    expect(parseExifDateTime(null)).toBeNull();
  });
});

describe('extractExifMeta', () => {
  it('le descricao, data, modelo, orientacao e GPS de um JPEG big-endian (como o Timestamp Camera)', () => {
    const meta = extractExifMeta(buildJpegWithExif({ ...TIMESTAMP_CAMERA, bigEndian: true }));
    expect(meta.description).toBe('BMDOPR\n126');
    expect(meta.capturedAt).toBe('2026-09-22T14:14:00');
    expect(meta.capturedDate).toBe('2026-09-22');
    expect(meta.capturedTime).toBe('14:14');
    expect(meta.make).toBe('samsung');
    expect(meta.model).toBe('SM-S911B');
    expect(meta.software).toBe('Timestamp Camera');
    expect(meta.orientation).toBe(1);
    expect(meta.gpsLat).toBeCloseTo(-(20 + 4 / 60 + 27 / 3600), 6);
    expect(meta.gpsLon).toBeCloseTo(-(44 + 49 / 60 + 33 / 3600), 6);
  });

  it('le o mesmo conteudo em little-endian', () => {
    const meta = extractExifMeta(buildJpegWithExif({ ...TIMESTAMP_CAMERA, bigEndian: false }));
    expect(meta.description).toBe('BMDOPR\n126');
    expect(meta.capturedDate).toBe('2026-09-22');
    expect(meta.orientation).toBe(1);
  });

  it('apara NUL, espacos e quebras de linha extras da descricao', () => {
    const meta = extractExifMeta(buildJpegWithExifNoGps({ imageDescription: 'BMDOPR\n16\n    ' }));
    expect(meta.description).toBe('BMDOPR\n16');
    const meta2 = extractExifMeta(buildJpegWithExifNoGps({ imageDescription: 'BMDOPR \n319' }));
    expect(meta2.description).toBe('BMDOPR \n319');
  });

  it('usa DateTimeDigitized quando DateTimeOriginal falta e DateTime do IFD0 como ultimo recurso', () => {
    const digitized = extractExifMeta(buildJpegWithExifNoGps({ dateTimeDigitized: '2026:09:23 08:44:35', dateTime: '2026:01:01 00:00:00' }));
    expect(digitized.capturedAt).toBe('2026-09-23T08:44:35');

    const fallback = extractExifMeta(buildJpegWithExifNoGps({ dateTime: '2026:09:24 11:02:13' }));
    expect(fallback.capturedAt).toBe('2026-09-24T11:02:13');
    expect(fallback.capturedTime).toBe('11:02');
  });

  it('pula placeholder 0000:00:00 e cai no proximo candidato', () => {
    const meta = extractExifMeta(buildJpegWithExifNoGps({ dateTimeOriginal: '0000:00:00 00:00:00', dateTime: '2026:09:21 14:31:12' }));
    expect(meta.capturedDate).toBe('2026-09-21');
  });

  it('sem Exif SubIFD e sem GPS devolve so o que o IFD0 tem', () => {
    const meta = extractExifMeta(buildJpegWithExifNoGps({ imageDescription: 'BMDOPR\n53' }));
    expect(meta.description).toBe('BMDOPR\n53');
    expect(meta.capturedAt).toBeNull();
    expect(meta.gpsLat).toBeNull();
    expect(meta.gpsLon).toBeNull();
  });

  it('GPS com denominador zero e descartado sem afetar os outros campos', () => {
    const meta = extractExifMeta(buildJpegWithExif({ imageDescription: 'BMDOPR\n61', breakDen: true }));
    expect(meta.description).toBe('BMDOPR\n61');
    expect(meta.gpsLat).toBeNull();
  });

  it('orientacao fora de 1..8 vira null', () => {
    expect(extractExifMeta(buildJpegWithExifNoGps({ orientation: 42 })).orientation).toBeNull();
    expect(extractExifMeta(buildJpegWithExifNoGps({ orientation: 6 })).orientation).toBe(6);
  });

  it('JPEG sem EXIF, lixo e vazio devolvem o objeto vazio sem lancar', () => {
    expect(extractExifMeta(buildJpegWithoutExif())).toEqual(EMPTY_EXIF_META);
    expect(extractExifMeta(Uint8Array.from([0, 1, 2, 3, 4, 5]))).toEqual(EMPTY_EXIF_META);
    expect(extractExifMeta(new Uint8Array(0))).toEqual(EMPTY_EXIF_META);
    expect(extractExifMeta(null)).toEqual(EMPTY_EXIF_META);
  });
});

// File/Blob fake: expoe slice()->{arrayBuffer()} como nos testes de exifGps.
function fakeFile(bytes, { maxBytesServed } = {}) {
  return {
    slice: (start, end) => {
      const limit = Number.isFinite(maxBytesServed) ? Math.min(end, maxBytesServed) : end;
      const sliced = bytes.subarray(start, limit);
      return { arrayBuffer: async () => sliced.buffer.slice(sliced.byteOffset, sliced.byteOffset + sliced.byteLength) };
    },
    arrayBuffer: async () => bytes.buffer,
  };
}

describe('readExifMetaFromFile', () => {
  it('le o cabecalho e devolve os metadados', async () => {
    const meta = await readExifMetaFromFile(fakeFile(buildJpegWithExif({ ...TIMESTAMP_CAMERA, bigEndian: true })));
    expect(meta.description).toBe('BMDOPR\n126');
    expect(meta.capturedDate).toBe('2026-09-22');
    expect(meta.gpsLat).toBeCloseTo(-20.0742, 3);
  });

  it('cabecalho truncado (maxBytes menor que o APP1) devolve objeto vazio sem lancar', async () => {
    const bytes = buildJpegWithExif({ ...TIMESTAMP_CAMERA });
    const meta = await readExifMetaFromFile(fakeFile(bytes), 16);
    expect(meta).toEqual(EMPTY_EXIF_META);
  });

  it('entrada invalida devolve null', async () => {
    expect(await readExifMetaFromFile(null)).toBeNull();
    expect(await readExifMetaFromFile({})).toBeNull();
  });
});
