import {
  computeVisitPlanning,
  enrichPlanningItemsWithHotelRecommendation,
  getTargetTowerFromSelection,
  pickPriorityHotelFromItems,
  recommendHotelForTower,
  serializeTowersForInput,
} from '../visitPlanning';

describe('computeVisitPlanning', () => {
  it('calcula meta por faixa', () => {
    const out80 = computeVisitPlanning({ project: { id: 'P1', torres: '80' }, inspections: [], erosions: [], year: 2026 });
    const out150 = computeVisitPlanning({ project: { id: 'P2', torres: '150' }, inspections: [], erosions: [], year: 2026 });
    const out300 = computeVisitPlanning({ project: { id: 'P3', torres: '300' }, inspections: [], erosions: [], year: 2026 });
    const out500 = computeVisitPlanning({ project: { id: 'P4', torres: '500' }, inspections: [], erosions: [], year: 2026 });

    expect(out80.metaAmostragem).toBe(24);
    expect(out150.metaAmostragem).toBe(30);
    expect(out300.metaAmostragem).toBe(54);
    expect(out500.metaAmostragem).toBe(75);
  });

  it('mantem obrigatorias e adiciona 5% extras quando obrigatorias excedem meta', () => {
    const erosions = new Array(30).fill(0).map((_, idx) => ({ projetoId: 'P1', torreRef: String(idx + 1) }));
    const out = computeVisitPlanning({
      project: { id: 'P1', torres: '120' },
      inspections: [],
      erosions,
      year: 2026,
    });

    expect(out.metaAmostragem).toBe(24);
    expect(out.obrigatorias).toHaveLength(30);
    expect(out.amostragemSelecionada).toHaveLength(6);
  });

  it('classifica torre visitada em 1 das 2 ultimas sem erosao como nao priorizar', () => {
    const inspections = [
      {
        id: 'VS2',
        projetoId: 'P1',
        dataInicio: '2026-02-10',
        detalhesDias: [{ torresDetalhadas: [{ numero: '2', temErosao: false }] }],
      },
      {
        id: 'VS1',
        projetoId: 'P1',
        dataInicio: '2026-01-10',
        detalhesDias: [{ torresDetalhadas: [{ numero: '3', temErosao: false }] }],
      },
    ];

    const out = computeVisitPlanning({ project: { id: 'P1', torres: '3' }, inspections, erosions: [], year: 2026 });
    expect(out.naoPriorizar.some((item) => item.torre === '2')).toBe(true);
  });

  it('gera selecao reproduzivel com a mesma seed base', () => {
    const base = {
      project: { id: 'PX', torres: '150' },
      inspections: [],
      erosions: [{ projetoId: 'PX', torreRef: '7' }],
      year: 2026,
    };
    const a = computeVisitPlanning(base);
    const b = computeVisitPlanning(base);

    expect(a.seed).toBe(b.seed);
    expect(a.amostragemSelecionada.map((x) => x.torre)).toEqual(b.amostragemSelecionada.map((x) => x.torre));
  });

  it('inclui mapsLink quando coordenada da torre existe', () => {
    const out = computeVisitPlanning({
      project: {
        id: 'P1',
        torres: '10',
        torresCoordenadas: [{ numero: '1', latitude: '-10.1', longitude: '-40.1' }],
      },
      inspections: [],
      erosions: [{ projetoId: 'P1', torreRef: '1' }],
      year: 2026,
    });

    expect(out.obrigatorias[0].mapsLink).toContain('google.com/maps');
  });

  it('retorna amostragem selecionada em ordem crescente de torre', () => {
    const inspections = [
      {
        id: 'VS2',
        projetoId: 'P1',
        dataInicio: '2026-02-10',
        detalhesDias: [{ torresDetalhadas: [{ numero: '1', temErosao: false }] }],
      },
      {
        id: 'VS1',
        projetoId: 'P1',
        dataInicio: '2026-01-10',
        detalhesDias: [{ torresDetalhadas: [{ numero: '2', temErosao: false }] }],
      },
    ];
    const out = computeVisitPlanning({
      project: { id: 'P1', torres: '10' },
      inspections,
      erosions: [],
      year: 2026,
    });
    const towers = out.amostragemSelecionada.map((item) => Number(item.torre));
    const sorted = [...towers].sort((a, b) => a - b);
    expect(towers).toEqual(sorted);
  });
});

describe('hotel recommendation by tower target', () => {
  const inspections = [
    {
      id: 'VS-1',
      projetoId: 'P1',
      dataInicio: '2026-01-01',
      detalhesDias: [
        {
          data: '2026-01-01',
          torresDetalhadas: [{ numero: '5' }],
          hotelNome: 'Hotel A',
          hotelMunicipio: 'Cidade A',
          hotelTorreBase: '4',
          hotelLogisticaNota: 5,
          hotelReservaNota: 4,
          hotelEstadiaNota: 4,
        },
        {
          data: '2026-01-02',
          torresDetalhadas: [{ numero: '5' }],
          hotelNome: 'Hotel B',
          hotelMunicipio: 'Cidade B',
          hotelTorreBase: '5',
          hotelLogisticaNota: 3,
          hotelReservaNota: 3,
          hotelEstadiaNota: 3,
        },
      ],
    },
  ];

  it('usa ultima torre da selecao como torre-alvo', () => {
    expect(getTargetTowerFromSelection(['1', '3', '5'])).toBe('5');
    expect(getTargetTowerFromSelection(['2'])).toBe('2');
    expect(getTargetTowerFromSelection([])).toBe('');
  });

  it('prioriza menor distancia limítrofe antes da media de notas', () => {
    const recommendation = recommendHotelForTower({
      inspections,
      projectId: 'P1',
      tower: '5',
      targetTower: '5',
    });

    expect(recommendation.hotelSugeridoNome).toBe('Hotel B');
    expect(recommendation.hotelSugeridoTorreBase).toBe('5');
    expect(recommendation.hotelSugeridoDistanciaTorreAlvo).toBe(0);
  });

  it('desempata por media de notas quando a distancia é igual', () => {
    const recommendation = recommendHotelForTower({
      inspections: [
        {
          id: 'VS-AVG-1',
          projetoId: 'P1',
          dataInicio: '2026-02-01',
          detalhesDias: [{
            data: '2026-02-01',
            torresDetalhadas: [{ numero: '10' }],
            hotelNome: 'Hotel Nota Maior',
            hotelMunicipio: 'Cidade M',
            hotelTorreBase: '10',
            hotelLogisticaNota: 5,
            hotelReservaNota: 4,
            hotelEstadiaNota: 4,
          }],
        },
        {
          id: 'VS-AVG-2',
          projetoId: 'P1',
          dataInicio: '2026-02-02',
          detalhesDias: [{
            data: '2026-02-02',
            torresDetalhadas: [{ numero: '10' }],
            hotelNome: 'Hotel Nota Menor',
            hotelMunicipio: 'Cidade M',
            hotelTorreBase: '10',
            hotelLogisticaNota: 3,
            hotelReservaNota: 3,
            hotelEstadiaNota: 3,
          }],
        },
      ],
      projectId: 'P1',
      tower: '10',
      targetTower: '10',
    });

    expect(recommendation.hotelSugeridoNome).toBe('Hotel Nota Maior');
  });

  it('mantem candidatos sem torre base atras de candidatos com torre base', () => {
    const recommendation = recommendHotelForTower({
      inspections: [
        {
          id: 'VS-2',
          projetoId: 'P1',
          dataInicio: '2026-01-03',
          detalhesDias: [
            {
              data: '2026-01-03',
              torresDetalhadas: [{ numero: '7' }],
              hotelNome: 'Hotel sem base',
              hotelMunicipio: 'Cidade C',
              hotelLogisticaNota: 5,
              hotelReservaNota: 5,
              hotelEstadiaNota: 5,
              hotelTorreBase: '',
            },
            {
              data: '2026-01-02',
              torresDetalhadas: [{ numero: '7' }],
              hotelNome: 'Hotel com base',
              hotelMunicipio: 'Cidade D',
              hotelLogisticaNota: 3,
              hotelReservaNota: 3,
              hotelEstadiaNota: 3,
              hotelTorreBase: '7',
            },
          ],
        },
      ],
      projectId: 'P1',
      tower: '7',
      targetTower: '7',
    });

    expect(recommendation.hotelSugeridoNome).toBe('Hotel com base');
  });

  it('mantem recomendacao por nota quando torre base nao e comparavel por distancia', () => {
    const recommendation = recommendHotelForTower({
      inspections: [
        {
          id: 'VS-NN-1',
          projetoId: 'P1',
          dataInicio: '2026-02-03',
          detalhesDias: [{
            data: '2026-02-03',
            torresDetalhadas: [{ numero: '11' }],
            hotelNome: 'Hotel Torre Texto',
            hotelMunicipio: 'Cidade N',
            hotelTorreBase: 'LOOP-A',
            hotelLogisticaNota: 5,
            hotelReservaNota: 5,
            hotelEstadiaNota: 5,
          }],
        },
        {
          id: 'VS-NN-2',
          projetoId: 'P1',
          dataInicio: '2026-02-04',
          detalhesDias: [{
            data: '2026-02-04',
            torresDetalhadas: [{ numero: '11' }],
            hotelNome: 'Hotel Torre Numerica',
            hotelMunicipio: 'Cidade N',
            hotelTorreBase: '11',
            hotelLogisticaNota: 3,
            hotelReservaNota: 3,
            hotelEstadiaNota: 3,
          }],
        },
      ],
      projectId: 'P1',
      tower: '11',
      targetTower: '11',
    });

    expect(recommendation.hotelSugeridoNome).toBe('Hotel Torre Texto');
    expect(recommendation.hotelSugeridoDistanciaTorreAlvo).toBe('');
  });

  it('desempata por media e depois por recencia', () => {
    const recommendation = recommendHotelForTower({
      inspections: [
        {
          id: 'VS-3',
          projetoId: 'P1',
          dataInicio: '2026-01-10',
          detalhesDias: [{
            data: '2026-01-10',
            torresDetalhadas: [{ numero: '9' }],
            hotelNome: 'Hotel C',
            hotelMunicipio: 'Cidade X',
            hotelTorreBase: '9',
            hotelLogisticaNota: 4,
            hotelReservaNota: 4,
            hotelEstadiaNota: 4,
          }],
        },
        {
          id: 'VS-4',
          projetoId: 'P1',
          dataInicio: '2026-01-12',
          detalhesDias: [{
            data: '2026-01-12',
            torresDetalhadas: [{ numero: '9' }],
            hotelNome: 'Hotel D',
            hotelMunicipio: 'Cidade X',
            hotelTorreBase: '9',
            hotelLogisticaNota: 4,
            hotelReservaNota: 4,
            hotelEstadiaNota: 4,
          }],
        },
      ],
      projectId: 'P1',
      tower: '9',
      targetTower: '9',
    });

    expect(recommendation.hotelSugeridoNome).toBe('Hotel D');
  });

  it('anexa metadados de hotel aos itens de planejamento e escolhe destaque', () => {
    const enriched = enrichPlanningItemsWithHotelRecommendation(
      [
        { torre: '5', categoria: 'obrigatoria', motivo: 'x' },
        { torre: '8', categoria: 'amostragem', motivo: 'y' },
      ],
      { inspections, projectId: 'P1', targetTower: '5' },
    );

    expect(enriched[0].hotelSugeridoNome).toBeTruthy();
    const priority = pickPriorityHotelFromItems(enriched, '5');
    expect(priority).toBeTruthy();
    expect(priority.torre).toBe('5');
  });
});

describe('serializeTowersForInput', () => {
  it('serializa em string ordenada', () => {
    expect(serializeTowersForInput([{ torre: '10' }, { torre: '2' }, { torre: '1' }])).toBe('1, 2, 10');
  });
});
