import { describe, expect, it } from 'vitest';
import { normalizeReportMonths, validateReportSchedule } from '../reportSchedule';

describe('reportSchedule', () => {
  it('normalizes months unique sorted', () => {
    expect(normalizeReportMonths([12, '1', 12, 3])).toEqual([1, 3, 12]);
  });

  it('validates trimestral requires 4 months', () => {
    const result = validateReportSchedule({
      periodicidadeRelatorio: 'Trimestral',
      mesesEntregaRelatorio: [1, 4],
      anoBaseBienal: null,
    });
    expect(result.ok).toBe(false);
  });

  it('validates bienal requires year >= 2000', () => {
    const result = validateReportSchedule({
      periodicidadeRelatorio: 'Bienal',
      mesesEntregaRelatorio: [1],
      anoBaseBienal: 1999,
    });
    expect(result.ok).toBe(false);
  });
});
