import { gerarPeriodoDias, preservarDetalhesDias } from '../dateUtils';

describe('gerarPeriodoDias', () => {
  it('gera período inclusivo entre início e fim', () => {
    expect(gerarPeriodoDias('2025-01-01', '2025-01-03')).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
    ]);
  });

  it('retorna vazio quando entradas são inválidas ou invertidas', () => {
    expect(gerarPeriodoDias('', '2025-01-03')).toEqual([]);
    expect(gerarPeriodoDias('2025-01-03', '2025-01-01')).toEqual([]);
    expect(gerarPeriodoDias('data-invalida', '2025-01-03')).toEqual([]);
  });
});

describe('preservarDetalhesDias', () => {
  it('preserva detalhes existentes e cria defaults para novas datas', () => {
    const existente = {
      data: '2025-01-01',
      clima: 'sol',
      torres: [1, 2],
      torresDetalhadas: [{ torre: 1 }],
    };
    const result = preservarDetalhesDias([existente], ['2025-01-01', '2025-01-02']);

    expect(result[0]).toBe(existente);
    expect(result[1]).toEqual({
      data: '2025-01-02',
      clima: '',
      torres: [],
      torresDetalhadas: [],
      hotelNome: '',
      hotelMunicipio: '',
      hotelLogisticaNota: '',
      hotelReservaNota: '',
      hotelEstadiaNota: '',
      hotelTorreBase: '',
    });
  });
});
