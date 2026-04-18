import { describe, it, expect } from 'vitest';
import {
  EROSION_PHOTOS_PRINCIPAIS_LIMIT,
  normalizeFotosPrincipais,
  buildFotosPrincipaisPatch,
  reorderFotosPrincipais,
} from '../erosionPhotosModel';

function makeFoto(overrides = {}) {
  return {
    photoId: 'RWP-1',
    workspaceId: 'RW-1',
    mediaAssetId: 'MA-1',
    caption: 'Vista',
    sortOrder: 0,
    ...overrides,
  };
}

describe('normalizeFotosPrincipais', () => {
  it('retorna lista vazia para valores invalidos', () => {
    expect(normalizeFotosPrincipais(null)).toEqual([]);
    expect(normalizeFotosPrincipais({})).toEqual([]);
    expect(normalizeFotosPrincipais({ fotosPrincipais: 'x' })).toEqual([]);
  });

  it('ignora entradas sem campos obrigatorios', () => {
    const result = normalizeFotosPrincipais({
      fotosPrincipais: [
        makeFoto(),
        { photoId: '', workspaceId: 'RW', mediaAssetId: 'MA' },
        { photoId: 'P', workspaceId: '', mediaAssetId: 'MA' },
      ],
    });
    expect(result).toHaveLength(1);
  });

  it('remove duplicados por photoId preservando o primeiro', () => {
    const result = normalizeFotosPrincipais({
      fotosPrincipais: [
        makeFoto({ photoId: 'A', caption: 'primeira', sortOrder: 0 }),
        makeFoto({ photoId: 'A', caption: 'duplicada', sortOrder: 1 }),
        makeFoto({ photoId: 'B', sortOrder: 1 }),
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0].photoId).toBe('A');
    expect(result[0].caption).toBe('primeira');
  });

  it('ordena por sortOrder e respeita o cap de 6 itens', () => {
    const input = {
      fotosPrincipais: Array.from({ length: 10 }, (_, i) => makeFoto({
        photoId: `RWP-${i}`,
        sortOrder: 9 - i,
      })),
    };
    const result = normalizeFotosPrincipais(input);
    expect(result).toHaveLength(EROSION_PHOTOS_PRINCIPAIS_LIMIT);
    expect(result.map((f) => f.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('trunca caption grande', () => {
    const longCaption = 'a'.repeat(800);
    const result = normalizeFotosPrincipais({
      fotosPrincipais: [makeFoto({ caption: longCaption })],
    });
    expect(result[0].caption).toHaveLength(500);
  });
});

describe('buildFotosPrincipaisPatch', () => {
  it('reindexa sortOrder sequencialmente comecando em zero', () => {
    const out = buildFotosPrincipaisPatch([
      makeFoto({ photoId: 'A', sortOrder: 3 }),
      makeFoto({ photoId: 'B', sortOrder: 5 }),
    ]);
    expect(out.map((f) => f.sortOrder)).toEqual([0, 1]);
  });

  it('filtra entradas invalidas', () => {
    const out = buildFotosPrincipaisPatch([
      makeFoto({ photoId: 'A' }),
      null,
      { photoId: '', workspaceId: 'RW', mediaAssetId: 'MA' },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('reorderFotosPrincipais', () => {
  it('move item e reindexa sortOrder', () => {
    const fotos = [
      makeFoto({ photoId: 'A', sortOrder: 0 }),
      makeFoto({ photoId: 'B', sortOrder: 1 }),
      makeFoto({ photoId: 'C', sortOrder: 2 }),
    ];
    const out = reorderFotosPrincipais(fotos, 2, 0);
    expect(out.map((f) => f.photoId)).toEqual(['C', 'A', 'B']);
    expect(out.map((f) => f.sortOrder)).toEqual([0, 1, 2]);
  });

  it('retorna copia inalterada para indices invalidos', () => {
    const fotos = [makeFoto({ photoId: 'A' })];
    expect(reorderFotosPrincipais(fotos, 5, 0)).toEqual(fotos);
  });
});
