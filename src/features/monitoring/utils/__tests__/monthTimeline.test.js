import { describe, it, expect } from 'vitest';
import { deriveMonthStatus, isHiddenByDefault, MONTH_STATUS } from '../monthTimeline';

const now = new Date(2026, 3, 15); // April 15, 2026 (month index 3 -> month number 4)

describe('deriveMonthStatus', () => {
  it('classifies a past month with all details delivered as PAST_OK', () => {
    const result = deriveMonthStatus('2026-02', [
      { operationalStatusTone: 'ok' },
      { operationalStatusTone: 'ok' },
    ], now);

    expect(result.status).toBe(MONTH_STATUS.PAST_OK);
    expect(result.offset).toBe(-2);
    expect(result.lateCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it('classifies a past month with any pending detail as PAST_LATE', () => {
    const result = deriveMonthStatus('2026-03', [
      { operationalStatusTone: 'ok' },
      { operationalStatusTone: 'warning' },
    ], now);

    expect(result.status).toBe(MONTH_STATUS.PAST_LATE);
    expect(result.lateCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it('classifies a past month with missing details as PAST_OK (nothing to deliver)', () => {
    const result = deriveMonthStatus('2026-01', [], now);

    expect(result.status).toBe(MONTH_STATUS.PAST_OK);
    expect(result.lateCount).toBe(0);
  });

  it('classifies the current month as CURRENT regardless of delivery status', () => {
    const delivered = deriveMonthStatus('2026-04', [{ operationalStatusTone: 'ok' }], now);
    const pending = deriveMonthStatus('2026-04', [{ operationalStatusTone: 'warning' }], now);

    expect(delivered.status).toBe(MONTH_STATUS.CURRENT);
    expect(pending.status).toBe(MONTH_STATUS.CURRENT);
    expect(pending.lateCount).toBe(1);
  });

  it('classifies the next month as NEXT', () => {
    const result = deriveMonthStatus('2026-05', [{ operationalStatusTone: 'neutral' }], now);

    expect(result.status).toBe(MONTH_STATUS.NEXT);
    expect(result.offset).toBe(1);
  });

  it('classifies later months as FUTURE', () => {
    const result = deriveMonthStatus('2026-09', undefined, now);

    expect(result.status).toBe(MONTH_STATUS.FUTURE);
    expect(result.offset).toBe(5);
    expect(result.totalCount).toBe(0);
  });

  it('treats undefined / malformed monthKey as FUTURE with infinite offset', () => {
    const result = deriveMonthStatus('nao-existe', [{ operationalStatusTone: 'ok' }], now);

    expect(result.status).toBe(MONTH_STATUS.FUTURE);
    expect(result.offset).toBe(Number.POSITIVE_INFINITY);
  });

  it('handles year boundaries correctly', () => {
    const decemberRef = new Date(2026, 11, 10); // December 2026
    const nextJanuary = deriveMonthStatus('2027-01', [{ operationalStatusTone: 'ok' }], decemberRef);
    const previousNovember = deriveMonthStatus('2026-11', [], decemberRef);

    expect(nextJanuary.status).toBe(MONTH_STATUS.NEXT);
    expect(previousNovember.status).toBe(MONTH_STATUS.PAST_OK);
  });
});

describe('isHiddenByDefault', () => {
  it('hides only PAST_OK by default', () => {
    expect(isHiddenByDefault(MONTH_STATUS.PAST_OK)).toBe(true);
    expect(isHiddenByDefault(MONTH_STATUS.PAST_LATE)).toBe(false);
    expect(isHiddenByDefault(MONTH_STATUS.CURRENT)).toBe(false);
    expect(isHiddenByDefault(MONTH_STATUS.NEXT)).toBe(false);
    expect(isHiddenByDefault(MONTH_STATUS.FUTURE)).toBe(false);
  });
});
