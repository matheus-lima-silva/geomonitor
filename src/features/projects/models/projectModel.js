export function createEmptyProject() {
  return {
    id: '',
    nome: '',
    tipo: 'Linha de Transmissão',
    tensao: '',
    extensao: '',
    torres: '',
    periodicidadeRelatorio: 'Anual',
    mesesEntregaRelatorio: [],
    anoBaseBienal: '',
    torresCoordenadas: [],
    dataCadastro: new Date().toISOString().split('T')[0],
  };
}

export function normalizeProjectPayload(input) {
  return {
    ...createEmptyProject(),
    ...input,
    id: String(input?.id || '').trim().toUpperCase(),
    nome: String(input?.nome || '').trim(),
    tipo: String(input?.tipo || 'Linha de Transmissão'),
    tensao: String(input?.tensao || ''),
    extensao: String(input?.extensao || ''),
    torres: String(input?.torres || ''),
    torresCoordenadas: Array.isArray(input?.torresCoordenadas) ? input.torresCoordenadas : [],
    dataCadastro: input?.dataCadastro || new Date().toISOString().split('T')[0],
  };
}
