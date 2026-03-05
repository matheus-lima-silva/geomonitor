import {
  CRITICALITY_V2_DEFAULTS,
  RULES_DATABASE,
  mergeCriticalityV2Config,
  normalizeRulesConfig,
} from '../rulesConfig';

describe('mergeCriticalityV2Config', () => {
  it('retorna defaults quando input e vazio', () => {
    expect(mergeCriticalityV2Config(undefined)).toEqual(CRITICALITY_V2_DEFAULTS);
  });

  it('aceita config dentro de criticalityV2 e faz merge sem perder defaults', () => {
    const merged = mergeCriticalityV2Config({
      criticalityV2: {
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

  it('aceita config direta (sem criticalityV2)', () => {
    const merged = mergeCriticalityV2Config({
      faixas: [{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }],
    });

    expect(merged.faixas).toEqual([{ codigo: 'C9', classe: 'Extra', min: 90, max: 100 }]);
  });
});

describe('normalizeRulesConfig', () => {
  it('aplica defaults para regras legadas e criticalityV2', () => {
    const normalized = normalizeRulesConfig(undefined);

    expect(normalized['tipo|sulco']).toEqual(RULES_DATABASE['tipo|sulco']);
    expect(normalized['declividade|>45']).toEqual(RULES_DATABASE['declividade|>45']);
    expect(normalized.criticalityV2).toBeTruthy();
    expect(normalized.criticalityV2.faixas).toEqual(CRITICALITY_V2_DEFAULTS.faixas);
  });

  it('limita score legado ao intervalo 1..4', () => {
    const normalized = normalizeRulesConfig({
      'tipo|ravina': { score: 99, impacto: 'X', frequencia: '1', intervencao: 'I' },
      'tipo|sulco': { score: -5, impacto: 'Y', frequencia: '2', intervencao: 'J' },
    });

    expect(normalized['tipo|ravina'].score).toBe(4);
    expect(normalized['tipo|sulco'].score).toBe(1);
  });
});
