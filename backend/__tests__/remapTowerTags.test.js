'use strict';

const {
  TAG_MAP,
  remapTag,
  remapTorresInput,
  remapInspectionPayload,
} = require('../scripts/lib/remapTowerTags');

describe('remapTowerTags', () => {
  test('remapTag aplica o mapa confirmado e resolve os ambiguos', () => {
    expect(remapTag('605')).toBe('605A');
    expect(remapTag('610')).toBe('610A');
    expect(remapTag('637')).toBe('637B');
    expect(remapTag('638')).toBe('638A');
  });

  test('remapTag deixa tags fora do mapa inalteradas (604, torres fora do trecho)', () => {
    expect(remapTag('604')).toBe('604');
    expect(remapTag('100')).toBe('100');
    expect(remapTag('700')).toBe('700');
    expect(remapTag(' 610 ')).toBe('610A');
    expect(remapTag('')).toBe('');
  });

  test('remap e idempotente (rodar 2x nao re-mapeia)', () => {
    const once = remapTag('610');
    expect(remapTag(once)).toBe('610A');
    // nenhuma chave do mapa e tambem valor
    const values = new Set(Object.values(TAG_MAP));
    for (const key of Object.keys(TAG_MAP)) {
      expect(values.has(key)).toBe(false);
    }
  });

  test('remapTorresInput preserva o formato "a, b, c"', () => {
    expect(remapTorresInput('607, 610, 615, 637, 638')).toBe('607A, 610A, 615A, 637B, 638A');
    expect(remapTorresInput('')).toBe('');
  });

  test('remapInspectionPayload remapeia torres, torresInput, torresDetalhadas e hotelTorreBase', () => {
    const payload = {
      projetoId: 'IABTPR2',
      detalhesDias: [
        {
          data: '2026-05-07',
          torres: ['607', '610', '637', '638'],
          torresInput: '607, 610, 637, 638',
          hotelTorreBase: '607',
          torresDetalhadas: [
            { numero: '607', obs: '', temErosao: false },
            { numero: '638', obs: 'x', temErosao: true },
          ],
        },
      ],
    };

    const { payload: out, changes } = remapInspectionPayload(payload);

    expect(out.detalhesDias[0].torres).toEqual(['607A', '610A', '637B', '638A']);
    expect(out.detalhesDias[0].torresInput).toBe('607A, 610A, 637B, 638A');
    expect(out.detalhesDias[0].hotelTorreBase).toBe('607A');
    expect(out.detalhesDias[0].torresDetalhadas).toEqual([
      { numero: '607A', obs: '', temErosao: false },
      { numero: '638A', obs: 'x', temErosao: true },
    ]);
    expect(changes.length).toBeGreaterThan(0);
  });

  test('remapInspectionPayload nao muta o payload original', () => {
    const payload = {
      detalhesDias: [{ torres: ['610'], torresDetalhadas: [{ numero: '610' }] }],
    };
    const { payload: out } = remapInspectionPayload(payload);
    expect(payload.detalhesDias[0].torres).toEqual(['610']);
    expect(payload.detalhesDias[0].torresDetalhadas[0].numero).toBe('610');
    expect(out).not.toBe(payload);
  });

  test('remapInspectionPayload tolera payload sem detalhesDias', () => {
    const payload = { foo: 'bar' };
    const { payload: out, changes } = remapInspectionPayload(payload);
    expect(out).toBe(payload);
    expect(changes).toEqual([]);
  });
});
