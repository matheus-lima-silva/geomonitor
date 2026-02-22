import { getProjectInspectionStats } from '../projectStats';

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
