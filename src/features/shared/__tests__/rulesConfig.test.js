import { RULES_DATABASE, calculateCriticality, normalizeRulesConfig } from '../rulesConfig';

describe('normalizeRulesConfig', () => {
  it('aplica defaults quando não há entrada', () => {
    const normalized = normalizeRulesConfig(undefined);
    expect(normalized['tipo|sulco']).toEqual(RULES_DATABASE['tipo|sulco']);
    expect(normalized['declividade|>45']).toEqual(RULES_DATABASE['declividade|>45']);
  });

  it('faz clamp do score para o intervalo de 1 a 4', () => {
    const normalized = normalizeRulesConfig({
      'tipo|ravina': { score: 99, impacto: 'X', frequencia: '1', intervencao: 'I' },
      'tipo|sulco': { score: -5, impacto: 'Y', frequencia: '2', intervencao: 'J' },
    });

    expect(normalized['tipo|ravina'].score).toBe(4);
    expect(normalized['tipo|sulco'].score).toBe(1);
  });
});

describe('calculateCriticality', () => {
  it('seleciona o critério com maior score', () => {
    const result = calculateCriticality({
      tipo: 'ravina',
      declividade: '>45',
      profundidade: '<0.5',
    });

    expect(result).toEqual(RULES_DATABASE['declividade|>45']);
  });

  it('retorna fallback quando não há critérios válidos', () => {
    const result = calculateCriticality({});
    expect(result).toEqual({
      impacto: 'Baixo',
      score: 1,
      frequencia: '24 meses',
      intervencao: 'Monitoramento visual',
    });
  });
});
