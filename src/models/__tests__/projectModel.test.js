import { createEmptyProject, normalizeProjectPayload } from '../projectModel';

describe('projectModel legado', () => {
  it('createEmptyProject retorna defaults esperados', () => {
    expect(createEmptyProject()).toEqual({
      nome: '',
      codigo: '',
      totalTorres: 0,
      coordenadasPorTorre: '{}',
    });
  });

  it('normalizeProjectPayload aplica trim e conversões de tipo', () => {
    const normalized = normalizeProjectPayload({
      nome: ' Linha Sul ',
      codigo: '  LT-01 ',
      totalTorres: '12',
      coordenadasPorTorre: '{"1":{"lat":-1,"lng":-2}}',
    });

    expect(normalized).toEqual({
      nome: 'Linha Sul',
      codigo: 'LT-01',
      totalTorres: 12,
      coordenadasPorTorre: { 1: { lat: -1, lng: -2 } },
    });
  });

  it('retorna objeto vazio para coordenadas inválidas', () => {
    const normalized = normalizeProjectPayload({
      nome: 'X',
      codigo: 'Y',
      totalTorres: 0,
      coordenadasPorTorre: '{json invalido',
    });

    expect(normalized.coordenadasPorTorre).toEqual({});
  });
});
