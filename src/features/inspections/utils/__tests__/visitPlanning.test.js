import { computeVisitPlanning, serializeTowersForInput } from '../visitPlanning';

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

  it('mantém obrigatórias e adiciona 5% extras quando obrigatórias excedem meta', () => {
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

  it('classifica torre visitada em 1 das 2 últimas sem erosão como não priorizar', () => {
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

  it('gera seleção reprodutível com a mesma seed base', () => {
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

describe('serializeTowersForInput', () => {
  it('serializa em string ordenada', () => {
    expect(serializeTowersForInput([{ torre: '10' }, { torre: '2' }, { torre: '1' }])).toBe('1, 2, 10');
  });
});
