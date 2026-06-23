import { describe, expect, it } from 'vitest';
import { getProjectNextDelivery, normalizeReportMonths, validateReportSchedule } from '../reportSchedule';

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

  describe('getProjectNextDelivery', () => {
    it('returns the next upcoming delivery from the reference date (current month inclusive)', () => {
      const project = { id: 'P1', periodicidadeRelatorio: 'Semestral', mesesEntregaRelatorio: [4, 10] };
      const next = getProjectNextDelivery(project, new Date(2026, 5, 15)); // junho/2026
      expect(next).toEqual({ month: 10, year: 2026, monthsAway: 4, label: 'Out/2026' });
    });

    it('includes a delivery happening in the reference month itself', () => {
      const project = { id: 'P1', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [6] };
      const next = getProjectNextDelivery(project, new Date(2026, 5, 20)); // junho/2026
      expect(next).toEqual({ month: 6, year: 2026, monthsAway: 0, label: 'Jun/2026' });
    });

    it('respects biennial base-year parity', () => {
      const project = {
        id: 'R1', periodicidadeRelatorio: 'Bienal', mesesEntregaRelatorio: [9], anoBaseBienal: 2025,
      };
      // 2026 is odd-offset from base 2025 -> skipped; next valid is 2027
      const next = getProjectNextDelivery(project, new Date(2026, 0, 1));
      expect(next).toEqual({ month: 9, year: 2027, monthsAway: 20, label: 'Set/2027' });
    });

    it('returns null when no delivery months are configured', () => {
      expect(getProjectNextDelivery({ id: 'P', mesesEntregaRelatorio: [] }, new Date(2026, 0, 1))).toBeNull();
    });

    it('returns null for an invalid reference date', () => {
      const project = { id: 'P1', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [6] };
      expect(getProjectNextDelivery(project, new Date('not-a-date'))).toBeNull();
    });
  });
});
