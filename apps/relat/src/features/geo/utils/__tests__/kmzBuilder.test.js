import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';

import { buildKmz, buildKmlDocument, safeFileName } from '../kmzBuilder';
import { buildMinimalJpegWithGps, buildJpegWithoutExif } from './jpegFixture';

// Objeto file-like minimo: buildKmz so usa `name` e `arrayBuffer()`.
function fileLike(name, bytes) {
  return {
    name,
    size: bytes.length,
    lastModified: 0,
    type: 'image/jpeg',
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

// jsdom nao implementa Blob.arrayBuffer(); lemos via FileReader.
function blobToBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function unzipBlob(blob) {
  return unzipSync(await blobToBytes(blob));
}

describe('buildKmlDocument', () => {
  it('gera placemark com Point, estilo e titulo', () => {
    const kml = buildKmlDocument('Lote A', [
      { name: 'torre-1.jpg', filePath: 'files/torre-1.jpg', lat: -22.5, lon: -43.25 },
    ]);
    expect(kml).toContain('<name>Lote A</name>');
    expect(kml).toContain('#photo-marker');
    expect(kml).toContain('<coordinates>-43.25,-22.5,0</coordinates>');
    expect(kml).toContain('files/torre-1.jpg');
  });
});

describe('safeFileName', () => {
  it('troca caracteres invalidos por _ e cai no fallback quando vazio', () => {
    expect(safeFileName('Torre 23 (LT).jpg')).toBe('Torre_23_LT_.jpg');
    expect(safeFileName('   ', 'foto.jpg')).toBe('foto.jpg');
  });
});

describe('buildKmz', () => {
  it('embute so fotos com GPS e lista as sem GPS no README', async () => {
    const files = [
      fileLike('torre-1.jpg', buildMinimalJpegWithGps()),
      fileLike('semgps.jpg', buildJpegWithoutExif()),
    ];

    const result = await buildKmz({ files, title: 'Lote A' });

    expect(result.markerCount).toBe(1);
    expect(result.skipped).toEqual(['semgps.jpg']);

    const entries = await unzipBlob(result.blob);
    expect(Object.keys(entries)).toContain('doc.kml');
    expect(Object.keys(entries)).toContain('files/torre-1.jpg');
    expect(Object.keys(entries)).toContain('README.txt');
    // A foto sem GPS nao deve ser embutida.
    expect(Object.keys(entries)).not.toContain('files/semgps.jpg');

    const kml = strFromU8(entries['doc.kml']);
    expect(kml).toContain('<coordinates>-43.25,-22.5,0</coordinates>');
    expect(kml).toContain('#photo-marker');

    const readme = strFromU8(entries['README.txt']);
    expect(readme).toContain('semgps.jpg');
  });

  it('deduplica nomes de arquivo colidentes', async () => {
    const files = [
      fileLike('foto.jpg', buildMinimalJpegWithGps()),
      fileLike('foto.jpg', buildMinimalJpegWithGps({ latRef: 'N' })),
    ];

    const result = await buildKmz({ files, title: 'Colisao' });
    const entries = await unzipBlob(result.blob);

    expect(result.markerCount).toBe(2);
    expect(Object.keys(entries)).toContain('files/foto.jpg');
    expect(Object.keys(entries)).toContain('files/foto-1.jpg');
  });

  it('rejeita quando nenhuma foto tem GPS', async () => {
    const files = [fileLike('a.jpg', buildJpegWithoutExif())];
    await expect(buildKmz({ files, title: 'Vazio' })).rejects.toThrow(/GPS/);
  });

  it('reporta progresso ate o total', async () => {
    const files = [
      fileLike('torre-1.jpg', buildMinimalJpegWithGps()),
      fileLike('semgps.jpg', buildJpegWithoutExif()),
    ];
    const calls = [];
    await buildKmz({ files, title: 'X', onProgress: (processed, total) => calls.push([processed, total]) });
    expect(calls[calls.length - 1]).toEqual([2, 2]);
  });
});
