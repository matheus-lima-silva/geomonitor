import { describe, expect, it } from 'vitest';
import {
  isHistoricalErosionRecord,
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
    expect(result.fieldErrors.estagio).toMatch(/estagio/i);
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
});
