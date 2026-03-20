import { describe, expect, it } from 'vitest';
import {
  buildCriticalityInputFromErosion,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
  validateErosionRequiredFields,
} from '../viewUtils';

describe('viewUtils erosion validation', () => {
  it('marca Estabilizado como registro historico automaticamente', () => {
    expect(isHistoricalErosionRecord({ status: 'Estabilizado' })).toBe(true);
    expect(isHistoricalErosionRecord({ registroHistorico: true })).toBe(true);
    expect(isHistoricalErosionRecord({ status: 'Ativo' })).toBe(false);
  });

  it('valida campos obrigatorios do cadastro tecnico', () => {
    const result = validateErosionRequiredFields({
      projetoId: 'P1',
      torreRef: '7',
      estagio: '',
      localContexto: {
        localTipo: '',
        exposicao: '',
        estruturaProxima: '',
        localDescricao: '',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.estagio).toMatch(/(grau erosivo|estagio)/i);
    expect(result.fieldErrors['localContexto.localTipo']).toMatch(/local da erosao/i);
  });

  it('aceita registro historico com contexto sem exigir caracterizacao tecnica', () => {
    const result = validateErosionRequiredFields({
      projetoId: 'P1',
      torreRef: '12',
      status: 'Estabilizado',
      obs: 'Intervencao executada em 2025.',
    });

    expect(result.historical).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('normaliza dimensionamento e o repassa para o input de criticidade', () => {
    const technical = normalizeErosionTechnicalFields({
      dimensionamento: '  Reconformar 8 m de talude e prever drenagem superficial.  ',
    });
    const criticalityInput = buildCriticalityInputFromErosion({
      dimensionamento: '  Reconformar 8 m de talude e prever drenagem superficial.  ',
    });

    expect(technical.dimensionamento).toBe('Reconformar 8 m de talude e prever drenagem superficial.');
    expect(criticalityInput.dimensionamento).toBe('Reconformar 8 m de talude e prever drenagem superficial.');
  });
});
