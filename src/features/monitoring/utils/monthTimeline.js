export const MONTH_STATUS = {
  PAST_OK: 'past-ok',
  PAST_LATE: 'past-late',
  CURRENT: 'current',
  NEXT: 'next',
  FUTURE: 'future',
};

function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(monthKey || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function monthOffset(target, reference) {
  return (target.year - reference.year) * 12 + (target.month - reference.month);
}

function isDetailLate(detail) {
  if (!detail || typeof detail !== 'object') return false;
  const operationalTone = String(detail.operationalStatusTone || '').toLowerCase();
  if (operationalTone === 'ok') return false;
  return true;
}

function countLate(details) {
  if (!Array.isArray(details)) return 0;
  return details.reduce((acc, detail) => (isDetailLate(detail) ? acc + 1 : acc), 0);
}

export function deriveMonthStatus(monthKey, details, now = new Date()) {
  const parsed = parseMonthKey(monthKey);
  const reference = now instanceof Date ? now : new Date(now);
  const referenceParts = { year: reference.getFullYear(), month: reference.getMonth() + 1 };

  if (!parsed) {
    return {
      status: MONTH_STATUS.FUTURE,
      offset: Number.POSITIVE_INFINITY,
      lateCount: 0,
      totalCount: Array.isArray(details) ? details.length : 0,
    };
  }

  const offset = monthOffset(parsed, referenceParts);
  const lateCount = countLate(details);
  const totalCount = Array.isArray(details) ? details.length : 0;

  let status;
  if (offset < 0) {
    status = lateCount > 0 ? MONTH_STATUS.PAST_LATE : MONTH_STATUS.PAST_OK;
  } else if (offset === 0) {
    status = MONTH_STATUS.CURRENT;
  } else if (offset === 1) {
    status = MONTH_STATUS.NEXT;
  } else {
    status = MONTH_STATUS.FUTURE;
  }

  return { status, offset, lateCount, totalCount };
}

export function isHiddenByDefault(status) {
  return status === MONTH_STATUS.PAST_OK;
}
