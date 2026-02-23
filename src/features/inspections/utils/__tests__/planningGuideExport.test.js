import { buildPlanningGuideRows, exportPlanningGuideCsv } from '../planningGuideExport';

describe('buildPlanningGuideRows', () => {
  it('monta linhas com categoria, maps e dados de hotel sugerido', () => {
    const rows = buildPlanningGuideRows(
      {
        obrigatorias: [{
          torre: '1',
          categoria: 'obrigatoria',
          motivo: 'x',
          comentariosAnteriores: [],
          mapsLink: 'https://maps.google.com/?q=-1,-1',
          hotelSugeridoNome: 'Hotel Central',
          hotelSugeridoMunicipio: 'Campos',
          hotelSugeridoLogisticaNota: 4,
          hotelSugeridoReservaNota: 5,
          hotelSugeridoEstadiaNota: 4,
          hotelSugeridoTorreBase: '5',
          hotelSugeridoDistanciaTorreAlvo: 0,
        }],
        amostragemSelecionada: [],
        naoPriorizar: [],
      },
      { id: 'P1', nome: 'Linha 1' },
      2026,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].obrigatoria).toBe('S');
    expect(rows[0].link_maps).toContain('maps');
    expect(rows[0].hotel_sugerido).toBe('Hotel Central');
    expect(rows[0].hotel_torre_base).toBe('5');
    expect(rows[0].distancia_torre_alvo).toBe(0);
  });
});

describe('exportPlanningGuideCsv', () => {
  it('gera csv com novas colunas de hotel', () => {
    const csv = exportPlanningGuideCsv([{
      empreendimento: 'P1',
      ano: 2026,
      torre: '1',
      hotel_sugerido: 'Hotel Central',
      hotel_torre_base: '5',
      distancia_torre_alvo: 0,
    }]);
    expect(csv).toContain('empreendimento;ano;torre');
    expect(csv).toContain('hotel_sugerido;hotel_municipio;hotel_logistica');
    expect(csv).toContain('P1;2026;1');
    expect(csv).toContain('Hotel Central');
  });
});
