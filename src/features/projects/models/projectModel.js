export const TRANSMISSION_VOLTAGE_OPTIONS = ['13', '138', '230', '345', '500', '600', '750'];

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
    linhaCoordenadas: [],
    linhaFonteKml: '',
    dataCadastro: new Date().toISOString().split('T')[0],
  };
}

export function normalizeProjectPayload(input) {
  const normalizeLinePoint = (point) => ({
    latitude: String(point?.latitude ?? ''),
    longitude: String(point?.longitude ?? ''),
    altitude: String(point?.altitude ?? ''),
  });

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
    linhaCoordenadas: Array.isArray(input?.linhaCoordenadas) ? input.linhaCoordenadas.map(normalizeLinePoint) : [],
    linhaFonteKml: String(input?.linhaFonteKml || ''),
    dataCadastro: input?.dataCadastro || new Date().toISOString().split('T')[0],
  };
}
