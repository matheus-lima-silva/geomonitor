import { parseTowerInput } from '../parseTowerInput';

describe('parseTowerInput', () => {
  it('retorna vazio para entrada vazia', () => {
    expect(parseTowerInput('')).toEqual([]);
    expect(parseTowerInput(null)).toEqual([]);
  });

  it('parseia números e separadores mistos', () => {
    expect(parseTowerInput('1, 3;5 7')).toEqual([1, 3, 5, 7]);
  });

  it('expande intervalos, aceita intervalo invertido e remove duplicados', () => {
    expect(parseTowerInput('5-3 4 1-2')).toEqual([1, 2, 3, 4, 5]);
  });

  it('ignora entradas inválidas, não positivas e intervalos muito grandes', () => {
    expect(parseTowerInput('a 0 -1 1-700 8-8 10-b 9')).toEqual([8, 9]);
  });

  it('limita resultado ao máximo de 1200 torres', () => {
    const result = parseTowerInput('1-600 601-1200 1201-1800');
    expect(result).toHaveLength(1200);
    expect(result[0]).toBe(1);
    expect(result[1199]).toBe(1200);
  });
});
