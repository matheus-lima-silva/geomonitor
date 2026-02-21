export const createEmptyInspection = () => ({
  id: null,
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  status: 'aberta',
  detalhesDias: [],
});

export const normalizeInspectionPayload = (inspection) => ({
  projetoId: inspection.projetoId,
  dataInicio: inspection.dataInicio,
  dataFim: inspection.dataFim,
  status: inspection.status,
  detalhesDias: inspection.detalhesDias,
});
