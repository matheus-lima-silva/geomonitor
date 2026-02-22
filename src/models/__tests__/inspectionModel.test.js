import { createEmptyInspection, normalizeInspectionPayload } from '../inspectionModel';

describe('inspectionModel', () => {
  it('createEmptyInspection retorna estrutura padrão', () => {
    expect(createEmptyInspection()).toEqual({
      id: null,
      projetoId: '',
      dataInicio: '',
      dataFim: '',
      status: 'aberta',
      detalhesDias: [],
    });
  });

  it('normalizeInspectionPayload preserva contrato esperado', () => {
    const normalized = normalizeInspectionPayload({
      projetoId: 'P-01',
      dataInicio: '2025-01-01',
      dataFim: '2025-01-03',
      status: 'concluida',
      detalhesDias: [{ data: '2025-01-01' }],
      extra: 'ignorado',
    });

    expect(normalized).toEqual({
      projetoId: 'P-01',
      dataInicio: '2025-01-01',
      dataFim: '2025-01-03',
      status: 'concluida',
      detalhesDias: [{ data: '2025-01-01' }],
    });
  });
});
