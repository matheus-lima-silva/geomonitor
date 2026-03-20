import {
  CRITICALITY_DEFAULTS,
  mergeCriticalityConfig,
  normalizeRulesConfig,
} from '../rulesConfig';

describe('mergeCriticalityConfig', () => {
  it('retorna defaults quando input e vazio', () => {
    expect(mergeCriticalityConfig(undefined)).toEqual(CRITICALITY_DEFAULTS);
  });

  it('aceita config dentro de criticalidade e faz merge sem perder defaults', () => {
    const merged = mergeCriticalityConfig({
      criticalidade: {
        faixas: [{ codigo: 'CZ', classe: 'Custom', min: 0, max: 999 }],
        pontos: {
          profundidade: {
            PX: { descricao: 'x', pontos: 99 },
          },
        },
      },
    });

    expect(merged.faixas).toEqual([{ codigo: 'CZ', classe: 'Custom', min: 0, max: 999 }]);
    expect(merged.pontos.profundidade.PX.pontos).toBe(99);
    expect(merged.pontos.tipo_erosao).toBeTruthy();
  });

  it('mantem compatibilidade temporaria com criticalityV2', () => {
    const merged = mergeCriticalityConfig({
      criticalityV2: {
        faixas: [{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }],
      },
    });

    expect(merged.faixas).toEqual([{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }]);
  });
});

describe('normalizeRulesConfig', () => {
  it('sempre devolve a chave canonica criticalidade', () => {
    const normalized = normalizeRulesConfig(undefined);

    expect(normalized.criticalidade).toEqual(CRITICALITY_DEFAULTS);
  });

  it('preserva campos extras e normaliza criticidade', () => {
    const normalized = normalizeRulesConfig({
      foo: 'bar',
      criticalidade: {
        faixas: [{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }],
      },
    });

    expect(normalized.foo).toBe('bar');
    expect(normalized.criticalidade.faixas).toEqual([{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }]);
  });
});
