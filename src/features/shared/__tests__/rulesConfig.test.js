import {
  CRITICALITY_V2_DEFAULTS,
  RULES_DATABASE,
  calculateCriticality,
  calcular_criticidade,
  normalizeRulesConfig,
} from '../rulesConfig';

describe('normalizeRulesConfig', () => {
  it('applies defaults when no input exists', () => {
    const normalized = normalizeRulesConfig(undefined);
    expect(normalized['tipo|sulco']).toEqual(RULES_DATABASE['tipo|sulco']);
    expect(normalized['declividade|>45']).toEqual(RULES_DATABASE['declividade|>45']);
    expect(normalized.criticalityV2).toBeTruthy();
    expect(normalized.criticalityV2.faixas).toEqual(CRITICALITY_V2_DEFAULTS.faixas);
  });

  it('clamps legacy score to 1..4', () => {
    const normalized = normalizeRulesConfig({
      'tipo|ravina': { score: 99, impacto: 'X', frequencia: '1', intervencao: 'I' },
      'tipo|sulco': { score: -5, impacto: 'Y', frequencia: '2', intervencao: 'J' },
    });

    expect(normalized['tipo|ravina'].score).toBe(4);
    expect(normalized['tipo|sulco'].score).toBe(1);
  });
});

describe('calcular_criticidade', () => {
  it('computes V2 score using T+P+D+S+E', () => {
    const out = calcular_criticidade({
      tipo_erosao: 'ravina',
      profundidade_m: 1.2,
      declividade_graus: 21,
      tipo_solo: 'argiloso',
      distancia_estrutura_m: 8,
    });

    expect(out.pontos).toEqual({ T: 4, P: 2, D: 2, S: 2, E: 4 });
    expect(out.criticidade_score).toBe(14);
    expect(out.codigo).toBe('C2');
    expect(out.criticidade_classe).toBe('Médio');
  });

  it('returns validation alerts as non-blocking output', () => {
    const out = calcular_criticidade({
      tipo_erosao: 'laminar',
      profundidade_m: 0.8,
      declividade_graus: 4,
      tipo_solo: 'lateritico',
      distancia_estrutura_m: 60,
      sinais_avanco: true,
      vegetacao_interior: true,
    });

    expect(out.alertas_validacao.length).toBeGreaterThan(0);
    expect(out.codigo).toBe('C1');
  });
});

describe('calculateCriticality (legacy compatibility)', () => {
  it('returns legacy-compatible payload with V2 breakdown', () => {
    const result = calculateCriticality({
      tipo_erosao: 'movimento_massa',
      profundidade_m: 3.2,
      declividade_graus: 27,
      tipo_solo: 'solos_rasos',
      distancia_estrutura_m: 3,
    });

    expect(result.impacto).toBe('Alto');
    expect(result.score).toBe(22);
    expect(result.codigo).toBe('C3');
    expect(result.breakdown).toBeTruthy();
    expect(result.breakdown.criticidade_score).toBe(22);
  });
});
