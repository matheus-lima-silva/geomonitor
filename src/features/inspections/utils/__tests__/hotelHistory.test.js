import {
  buildHotelHistory,
  extractHotelFields,
  findPreviousDayHotel,
  hasAnyHotelData,
} from '../hotelHistory';

describe('buildHotelHistory', () => {
  it('deduplica por hotel+municipio e ordena por recencia, frequencia e nome', () => {
    const inspections = [
      {
        id: 'VS-1',
        projetoId: 'P1',
        dataInicio: '2026-01-01',
        detalhesDias: [
          {
            data: '2026-01-01',
            hotelNome: 'Hotel Alpha',
            hotelMunicipio: 'Cidade X',
            hotelLogisticaNota: '2',
            hotelReservaNota: '2',
            hotelEstadiaNota: '2',
            hotelTorreBase: '1',
          },
          {
            data: '2026-01-02',
            hotelNome: 'Hotel Beta',
            hotelMunicipio: 'Cidade Y',
            hotelLogisticaNota: '4',
            hotelReservaNota: '4',
            hotelEstadiaNota: '4',
            hotelTorreBase: '3',
          },
        ],
      },
      {
        id: 'VS-2',
        projetoId: 'P1',
        dataInicio: '2026-01-05',
        detalhesDias: [
          {
            data: '2026-01-05',
            hotelNome: 'Hotel Alpha',
            hotelMunicipio: 'Cidade X',
            hotelLogisticaNota: '5',
            hotelReservaNota: '4',
            hotelEstadiaNota: '3',
            hotelTorreBase: '8',
          },
          {
            data: '2026-01-05',
            hotelNome: '',
            hotelMunicipio: 'Sem Nome',
          },
        ],
      },
      {
        id: 'VS-3',
        projetoId: 'P2',
        dataInicio: '2026-01-10',
        detalhesDias: [
          {
            data: '2026-01-10',
            hotelNome: 'Hotel Outro Projeto',
            hotelMunicipio: 'Cidade Z',
          },
        ],
      },
    ];

    const history = buildHotelHistory({ projectId: 'P1', inspections });
    expect(history).toHaveLength(2);
    expect(history[0].hotelNome).toBe('Hotel Alpha');
    expect(history[0].usageCount).toBe(2);
    expect(history[0].lastDate).toBe('2026-01-05');
    expect(history[0].hotelTorreBase).toBe('8');
    expect(history[1].hotelNome).toBe('Hotel Beta');
  });

  it('inclui dados da vistoria em rascunho para o mesmo empreendimento', () => {
    const history = buildHotelHistory({
      projectId: 'PX',
      inspections: [],
      draftInspection: {
        id: '',
        projetoId: 'PX',
        detalhesDias: [
          {
            data: '2026-03-10',
            hotelNome: 'Hotel Draft',
            hotelMunicipio: 'Cidade Draft',
          },
        ],
      },
    });

    expect(history).toHaveLength(1);
    expect(history[0].hotelNome).toBe('Hotel Draft');
  });

  it('prioriza dados do rascunho atual quando ele tem o mesmo id da vistoria salva', () => {
    const history = buildHotelHistory({
      projectId: 'P1',
      inspections: [
        {
          id: 'VS-10',
          projetoId: 'P1',
          detalhesDias: [
            {
              data: '2026-04-10',
              hotelNome: 'Hotel Salvo',
              hotelMunicipio: 'Cidade A',
            },
          ],
        },
      ],
      draftInspection: {
        id: 'VS-10',
        projetoId: 'P1',
        detalhesDias: [
          {
            data: '2026-04-11',
            hotelNome: 'Hotel Rascunho',
            hotelMunicipio: 'Cidade B',
          },
        ],
      },
    });

    expect(history).toHaveLength(1);
    expect(history[0].hotelNome).toBe('Hotel Rascunho');
    expect(history[0].hotelMunicipio).toBe('Cidade B');
    expect(history[0].lastDate).toBe('2026-04-11');
  });
});

describe('hotel helpers', () => {
  it('retorna o hotel do dia imediatamente anterior quando houver dados validos', () => {
    const detailsDays = [
      { data: '2026-02-01', hotelNome: 'Hotel A', hotelMunicipio: 'Cidade A' },
      { data: '2026-02-02', hotelNome: 'Hotel B', hotelMunicipio: 'Cidade B' },
      { data: '2026-02-03', hotelNome: '', hotelMunicipio: '' },
    ];

    const previous = findPreviousDayHotel(detailsDays, '2026-02-03');
    expect(previous?.date).toBe('2026-02-02');
    expect(previous?.hotelNome).toBe('Hotel B');
    expect(findPreviousDayHotel(detailsDays, '2026-02-04')).toBeNull();
  });

  it('normaliza extracao de campos e identificacao de dados de hotel', () => {
    const extracted = extractHotelFields({
      hotelNome: '  Hotel C  ',
      hotelMunicipio: ' Cidade C ',
      hotelLogisticaNota: 5,
      hotelReservaNota: '4',
      hotelEstadiaNota: null,
      hotelTorreBase: 12,
    });

    expect(extracted).toEqual({
      hotelNome: 'Hotel C',
      hotelMunicipio: 'Cidade C',
      hotelLogisticaNota: '5',
      hotelReservaNota: '4',
      hotelEstadiaNota: '',
      hotelTorreBase: '12',
    });
    expect(hasAnyHotelData(extracted)).toBe(true);
    expect(hasAnyHotelData({})).toBe(false);
  });
});
