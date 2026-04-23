import {
  countWorkdays,
  countVisitedTowersInInspection,
  computeInspectionRhythm,
  estimateWorkdaysForTowers,
  getProjectInspectionStats,
} from '../projectStats';

describe('getProjectInspectionStats', () => {
  it('retorna estrutura vazia quando projeto não tem inspeções', () => {
    expect(getProjectInspectionStats('P1', [])).toEqual({
      count: 0,
      start: null,
      end: null,
      spanDays: 0,
      visitedDays: 0,
      list: [],
    });
  });

  it('calcula estatísticas agregadas e ordena lista por dataInicio desc', () => {
    const inspections = [
      { id: 'i1', projetoId: 'P1', dataInicio: '2025-01-01', dataFim: '2025-01-03', detalhesDias: [{}, {}] },
      { id: 'i2', projetoId: 'P1', dataInicio: '2025-02-10', dataFim: '2025-02-10', detalhesDias: [] },
      { id: 'i3', projetoId: 'P2', dataInicio: '2025-03-01', dataFim: '2025-03-02', detalhesDias: [{}] },
    ];

    const stats = getProjectInspectionStats('P1', inspections);

    expect(stats.count).toBe(2);
    expect(stats.spanDays).toBe(41);
    expect(stats.visitedDays).toBe(3);
    expect(stats.start?.toISOString().slice(0, 10)).toBe('2025-01-01');
    expect(stats.end?.toISOString().slice(0, 10)).toBe('2025-02-10');
    expect(stats.list.map((item) => item.id)).toEqual(['i2', 'i1']);
  });
});

describe('countWorkdays', () => {
  it('conta dias úteis segunda a sexta sem feriados', () => {
    // 2026-04-20 (seg) a 2026-04-24 (sex) = 5 dias úteis
    expect(countWorkdays('2026-04-20', '2026-04-24')).toBe(5);
  });

  it('exclui sábado e domingo', () => {
    // 2026-04-18 (sab) a 2026-04-20 (seg) = 1 dia útil (seg)
    expect(countWorkdays('2026-04-18', '2026-04-20')).toBe(1);
  });

  it('exclui datas presentes no feriadosIndex', () => {
    const feriadosIndex = new Map([['2026-04-21', { nome: 'Tiradentes', tipo: 'nacional' }]]);
    // 2026-04-20 (seg) a 2026-04-24 (sex) = 5 dias, menos Tiradentes (ter) = 4
    expect(countWorkdays('2026-04-20', '2026-04-24', feriadosIndex)).toBe(4);
  });

  it('retorna 0 para datas inválidas', () => {
    expect(countWorkdays('', '2026-04-24')).toBe(0);
    expect(countWorkdays('2026-04-24', '')).toBe(0);
    expect(countWorkdays('invalid', '2026-04-24')).toBe(0);
  });

  it('retorna 0 quando dataFim < dataInicio', () => {
    expect(countWorkdays('2026-04-24', '2026-04-20')).toBe(0);
  });

  it('inclui ambos os extremos no intervalo', () => {
    // um único dia útil
    expect(countWorkdays('2026-04-20', '2026-04-20')).toBe(1);
  });
});

describe('countVisitedTowersInInspection', () => {
  it('retorna 0 sem detalhesDias', () => {
    expect(countVisitedTowersInInspection({})).toBe(0);
    expect(countVisitedTowersInInspection({ detalhesDias: [] })).toBe(0);
  });

  it('conta torres via torresDetalhadas', () => {
    const insp = {
      detalhesDias: [
        { torresDetalhadas: [{ numero: '10' }, { numero: '11' }] },
        { torresDetalhadas: [{ numero: '12' }] },
      ],
    };
    expect(countVisitedTowersInInspection(insp)).toBe(3);
  });

  it('deduplica torres repetidas entre dias', () => {
    const insp = {
      detalhesDias: [
        { torresDetalhadas: [{ numero: '10' }, { numero: '11' }] },
        { torresDetalhadas: [{ numero: '11' }, { numero: '12' }] },
      ],
    };
    expect(countVisitedTowersInInspection(insp)).toBe(3);
  });

  it('deduplica entre torresDetalhadas, torres e torresInput', () => {
    const insp = {
      detalhesDias: [
        {
          torresDetalhadas: [{ numero: '10' }],
          torres: ['10', '11'],
          torresInput: '11 12',
        },
      ],
    };
    expect(countVisitedTowersInInspection(insp)).toBe(3);
  });

  it('ignora valores vazios e nulos', () => {
    const insp = {
      detalhesDias: [
        { torresDetalhadas: [{ numero: '' }, { numero: null }], torresInput: '  ' },
      ],
    };
    expect(countVisitedTowersInInspection(insp)).toBe(0);
  });
});

describe('computeInspectionRhythm', () => {
  it('retorna towersPerWorkday null quando sampleSize < 1', () => {
    const result = computeInspectionRhythm({ inspections: [] });
    expect(result.towersPerWorkday).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it('ignora inspeções sem dataFim ou sem torres', () => {
    const inspections = [
      { dataInicio: '2026-04-20' }, // sem dataFim
      { dataInicio: '2026-04-20', dataFim: '2026-04-24', detalhesDias: [] }, // 0 torres
    ];
    const result = computeInspectionRhythm({ inspections });
    expect(result.sampleSize).toBe(0);
    expect(result.towersPerWorkday).toBeNull();
  });

  it('usa média ponderada (total torres / total dias uteis), não média de médias', () => {
    // Insp A: 10 torres em 5 dias (2 torres/dia)
    // Insp B: 6 torres em 2 dias (3 torres/dia)
    // Média de médias = (2+3)/2 = 2.5
    // Média ponderada = 16/7 ≈ 2.286
    const inspections = [
      {
        dataInicio: '2026-04-20',
        dataFim: '2026-04-24', // 5 dias úteis (seg-sex)
        detalhesDias: [
          { torresDetalhadas: [{ numero: '1' }, { numero: '2' }] },
          { torresDetalhadas: [{ numero: '3' }, { numero: '4' }] },
          { torresDetalhadas: [{ numero: '5' }, { numero: '6' }] },
          { torresDetalhadas: [{ numero: '7' }, { numero: '8' }] },
          { torresDetalhadas: [{ numero: '9' }, { numero: '10' }] },
        ],
      },
      {
        dataInicio: '2026-04-27',
        dataFim: '2026-04-28', // 2 dias úteis (seg-ter)
        detalhesDias: [
          { torresDetalhadas: [{ numero: '11' }, { numero: '12' }, { numero: '13' }] },
          { torresDetalhadas: [{ numero: '14' }, { numero: '15' }, { numero: '16' }] },
        ],
      },
    ];
    const result = computeInspectionRhythm({ inspections });
    expect(result.sampleSize).toBe(2);
    expect(result.totalTowersSampled).toBe(16);
    expect(result.totalWorkdaysSampled).toBe(7);
    expect(result.towersPerWorkday).toBeCloseTo(16 / 7, 5);
  });
});

describe('estimateWorkdaysForTowers', () => {
  it('retorna null quando rhythm está vazio', () => {
    expect(estimateWorkdaysForTowers(10, null).workdays).toBeNull();
    expect(estimateWorkdaysForTowers(10, { towersPerWorkday: null, source: 'none' }).workdays).toBeNull();
  });

  it('arredonda para cima', () => {
    const rhythm = { towersPerWorkday: 3, source: 'project' };
    expect(estimateWorkdaysForTowers(10, rhythm).workdays).toBe(4); // ceil(10/3)=4
  });

  it('retorna mínimo 1', () => {
    const rhythm = { towersPerWorkday: 100, source: 'global' };
    expect(estimateWorkdaysForTowers(1, rhythm).workdays).toBe(1);
  });

  it('propaga o source do rhythm', () => {
    const rhythm = { towersPerWorkday: 5, source: 'global' };
    expect(estimateWorkdaysForTowers(10, rhythm).source).toBe('global');
  });
});

describe('getProjectInspectionStats com rhythm', () => {
  const inspecaoComTorres = (id, projetoId, dataInicio, dataFim, torrePrefixo, numTorres) => ({
    id,
    projetoId,
    dataInicio,
    dataFim,
    detalhesDias: [
      {
        torresDetalhadas: Array.from({ length: numTorres }, (_, k) => ({ numero: `${torrePrefixo}-${k + 1}` })),
      },
    ],
  });

  const feriadosIndex = new Map();

  it('project com >= 2 inspeções → rhythm.source = project', () => {
    const inspections = [
      inspecaoComTorres('i1', 'P1', '2026-04-20', '2026-04-24', 'A', 10),
      inspecaoComTorres('i2', 'P1', '2026-04-27', '2026-04-28', 'B', 6),
    ];
    const stats = getProjectInspectionStats('P1', inspections, { feriadosIndex, globalInspections: inspections });
    expect(stats.rhythm.source).toBe('project');
    expect(stats.rhythm.towersPerWorkday).toBeGreaterThan(0);
  });

  it('project com 1 inspeção → fallback global → rhythm.source = global', () => {
    const globalInspections = [
      inspecaoComTorres('g1', 'P2', '2026-04-20', '2026-04-24', 'X', 8),
      inspecaoComTorres('g2', 'P2', '2026-04-27', '2026-04-28', 'Y', 4),
      inspecaoComTorres('i1', 'P1', '2026-04-20', '2026-04-22', 'A', 5),
    ];
    const stats = getProjectInspectionStats('P1', globalInspections, { feriadosIndex, globalInspections });
    expect(stats.rhythm.source).toBe('global');
  });

  it('project e global sem dados suficientes → rhythm.source = none, towersPerWorkday = null', () => {
    const inspections = [];
    const stats = getProjectInspectionStats('P1', inspections, { feriadosIndex, globalInspections: inspections });
    expect(stats.rhythm.source).toBe('none');
    expect(stats.rhythm.towersPerWorkday).toBeNull();
  });

  it('sem feriadosIndex → não inclui rhythm no retorno', () => {
    const inspections = [inspecaoComTorres('i1', 'P1', '2026-04-20', '2026-04-24', 'A', 5)];
    const stats = getProjectInspectionStats('P1', inspections);
    expect(stats.rhythm).toBeUndefined();
  });
});
