import { buildPlanningGuideRows, exportPlanningGuideCsv } from '../planningGuideExport';

describe('buildPlanningGuideRows', () => {
  it('monta linhas com categoria e link de maps', () => {
    const rows = buildPlanningGuideRows(
      {
        obrigatorias: [{ torre: '1', categoria: 'obrigatoria', motivo: 'x', comentariosAnteriores: [], mapsLink: 'https://maps.google.com/?q=-1,-1' }],
        amostragemSelecionada: [],
        naoPriorizar: [],
      },
      { id: 'P1', nome: 'Linha 1' },
      2026,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].obrigatoria).toBe('S');
    expect(rows[0].link_maps).toContain('maps');
  });
});

describe('exportPlanningGuideCsv', () => {
  it('gera csv com cabeçalho', () => {
    const csv = exportPlanningGuideCsv([{ empreendimento: 'P1', ano: 2026, torre: '1' }]);
    expect(csv).toContain('empreendimento;ano;torre');
    expect(csv).toContain('P1;2026;1');
  });
});
