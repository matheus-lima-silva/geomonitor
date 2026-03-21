import { parseTowerInput } from '../parseTowerInput';

describe('parseTowerInput', () => {
  it('retorna vazio para entrada vazia', () => {
    expect(parseTowerInput('')).toEqual([]);
    expect(parseTowerInput(null)).toEqual([]);
  });

  it('parseia numeros e separadores mistos', () => {
    expect(parseTowerInput('1, 3;5 7')).toEqual(['1', '3', '5', '7']);
  });

  it('expande intervalos, aceita intervalo invertido e remove duplicados', () => {
    expect(parseTowerInput('5-3 4 1-2')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('aceita torre 0 (portico) como token individual', () => {
    expect(parseTowerInput('0 1 2')).toEqual(['0', '1', '2']);
  });

  it('aceita torres alfanumericas', () => {
    expect(parseTowerInput('1A, 2, 3B')).toEqual(['2', '1A', '3B']);
  });

  it('ignora entradas invalidas e intervalos muito grandes', () => {
    // 'a' is not a valid tower (doesn't start with digit), '-1' is negative
    // '1-700' exceeds MAX_INTERVALO, '10-b' becomes '10' and 'b' (b ignored)
    expect(parseTowerInput('0 -1 1-700 8-8 10-b 9')).toEqual(['0', '8', '9', '10']);
  });

  it('limita resultado ao maximo de 1200 torres', () => {
    const result = parseTowerInput('1-600 601-1200 1201-1800');
    expect(result).toHaveLength(1200);
    expect(result[0]).toBe('1');
    expect(result[1199]).toBe('1200');
  });
});
