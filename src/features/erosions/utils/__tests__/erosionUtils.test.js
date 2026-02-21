import { buildErosionsCsv, filterErosionsForReport, validateErosionLocation } from '../erosionUtils';

describe('validateErosionLocation', () => {
  it('falha sem localTipo', () => {
    expect(validateErosionLocation({ localTipo: '' }).ok).toBe(false);
  });

  it('exige descrição quando Outros', () => {
    expect(validateErosionLocation({ localTipo: 'Outros', localDescricao: '' }).ok).toBe(false);
    expect(validateErosionLocation({ localTipo: 'Outros', localDescricao: 'Talude lateral' }).ok).toBe(true);
  });
});

describe('buildErosionsCsv', () => {
  it('gera cabeçalho e linha', () => {
    const csv = buildErosionsCsv([{ id: 'E1', projetoId: 'P1' }]);
    expect(csv).toContain('id;projetoId');
    expect(csv).toContain('E1;P1');
  });
});

describe('filterErosionsForReport', () => {
  it('inclui erosão com projeto resolvido por vistoria e ignora case de projeto', () => {
    const erosions = [
      { id: 'E1', vistoriaId: 'VS-1', projetoId: '', ultimaAtualizacao: '' },
    ];
    const inspections = [
      { id: 'VS-1', projetoId: 'Emp-01', dataInicio: '2026-02-10' },
    ];

    const out = filterErosionsForReport(erosions, { projetoId: 'emp-01', dataInicio: '2026-02-01', dataFim: '2026-02-28' }, inspections);
    expect(out).toHaveLength(1);
  });
});
