import { buildSingleErosionFichaPdfDocument } from '../erosionPdfTemplates';

describe('erosionPdfTemplates', () => {
  it('prints criticality summary with title and suggested solutions', () => {
    const documentHtml = buildSingleErosionFichaPdfDocument({
      erosion: {
        id: 'ERS-10',
        projetoId: 'P1',
        torreRef: '12',
        status: 'Ativo',
        impacto: 'Baixo',
        score: 0,
        frequencia: '24 meses',
        criticalidadeV2: {
          criticidade_classe: 'Baixo',
          codigo: 'C1',
          pontos: { T: 0, P: 0, D: 0, S: 0, E: 0 },
          lista_solucoes_sugeridas: ['Cobertura vegetal'],
        },
      },
      project: { id: 'P1', nome: 'Projeto 1' },
      history: [],
      relatedInspections: [],
      generatedAt: '01/03/2026 10:00:00',
    });

    expect(documentHtml).toContain('Resumo de criticidade calculada');
    expect(documentHtml).toContain('Criticidade:</strong> Baixo (C1) | Pontos T/P/D/S/E: 0/0/0/0/0');
    expect(documentHtml).toContain('Solucoes sugeridas:</strong> Cobertura vegetal');
  });
});
