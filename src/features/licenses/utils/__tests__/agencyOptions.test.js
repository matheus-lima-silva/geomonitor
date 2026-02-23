import { describe, expect, it } from 'vitest';
import { getAgencyOptions } from '../agencyOptions';

describe('agencyOptions', () => {
  it('merges catalog with history and deduplicates', () => {
    const options = getAgencyOptions({
      licenses: [{ orgaoAmbiental: 'IBAMA' }, { orgaoAmbiental: 'Órgão Novo' }],
      erosions: [{
        acompanhamentosResumo: [
          { tipoEvento: 'autuacao', orgao: 'inea' },
          { tipoEvento: 'autuacao', orgao: 'Órgão Novo' },
        ],
      }],
    });

    expect(options.find((item) => item.value === 'IBAMA')).toBeTruthy();
    expect(options.find((item) => item.value.toLowerCase() === 'inea')).toBeTruthy();
    expect(options.filter((item) => item.value === 'Órgão Novo')).toHaveLength(1);
  });
});
