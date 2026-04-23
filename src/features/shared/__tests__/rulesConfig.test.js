import {
  CRITICALITY_DEFAULTS,
  buildFeriadosIndex,
  getFeriadoForDate,
  mergeCriticalityConfig,
  normalizeFeriados,
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

  it('sempre devolve array feriados normalizado', () => {
    const normalized = normalizeRulesConfig({});
    expect(normalized.feriados).toEqual([]);
  });
});

describe('normalizeFeriados', () => {
  it('descarta itens sem data ISO ou nome', () => {
    const feriados = normalizeFeriados([
      { data: '2026-04-21', nome: 'Tiradentes' },
      { data: 'abc', nome: 'Bad date' },
      { data: '2026-01-01', nome: '' },
      { nome: 'Sem data' },
      null,
    ]);

    expect(feriados).toEqual([
      { data: '2026-04-21', nome: 'Tiradentes', tipo: 'personalizado' },
    ]);
  });

  it('preserva tipo valido e defaulta o resto', () => {
    const feriados = normalizeFeriados([
      { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
      { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'xpto' },
    ]);

    expect(feriados[0].tipo).toBe('nacional');
    expect(feriados[1].tipo).toBe('personalizado');
  });

  it('ordena por data ASC', () => {
    const feriados = normalizeFeriados([
      { data: '2026-12-25', nome: 'Natal' },
      { data: '2026-01-01', nome: 'Ano Novo' },
    ]);

    expect(feriados.map((f) => f.data)).toEqual(['2026-01-01', '2026-12-25']);
  });
});

describe('buildFeriadosIndex / getFeriadoForDate', () => {
  it('permite lookup O(1) por data ISO', () => {
    const index = buildFeriadosIndex([
      { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
      { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'nacional' },
    ]);

    expect(getFeriadoForDate('2026-04-21', index)).toEqual({ nome: 'Tiradentes', tipo: 'nacional' });
    expect(getFeriadoForDate('2026-05-01', index)).toEqual({ nome: 'Dia do Trabalho', tipo: 'nacional' });
    expect(getFeriadoForDate('2026-06-01', index)).toBeNull();
  });

  it('em caso de duplicata, a ultima entrada vence', () => {
    const index = buildFeriadosIndex([
      { data: '2026-04-21', nome: 'Original', tipo: 'nacional' },
      { data: '2026-04-21', nome: 'Sobrescrito', tipo: 'personalizado' },
    ]);

    expect(getFeriadoForDate('2026-04-21', index).nome).toBe('Sobrescrito');
  });

  it('retorna null para entradas invalidas', () => {
    const index = buildFeriadosIndex([]);
    expect(getFeriadoForDate('', index)).toBeNull();
    expect(getFeriadoForDate(null, index)).toBeNull();
    expect(getFeriadoForDate('2026-04-21', null)).toBeNull();
  });
});
