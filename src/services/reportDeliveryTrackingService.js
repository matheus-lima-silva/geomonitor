import { saveDoc, subscribeCollection } from './firestoreClient';
import {
  REPORT_OPERATIONAL_STATUS,
  normalizeOperationalStatus,
  normalizeSourceOverride,
} from '../features/monitoring/utils/reportTracking';

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export function buildReportDeliveryTrackingId(projectId, monthKey) {
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedMonthKey = String(monthKey || '').trim();
  if (!normalizedProjectId || !MONTH_KEY_PATTERN.test(normalizedMonthKey)) {
    throw new Error('projectId e monthKey validos sao obrigatorios.');
  }
  return `${normalizedProjectId}__${normalizedMonthKey}`;
}

export function normalizeReportDeliveryTrackingPayload(payload = {}) {
  const projectId = String(payload?.projectId || '').trim();
  const monthKey = String(payload?.monthKey || '').trim();
  if (!projectId || !MONTH_KEY_PATTERN.test(monthKey)) {
    throw new Error('projectId e monthKey validos sao obrigatorios.');
  }

  const operationalStatus = normalizeOperationalStatus(payload?.operationalStatus);
  const sourceOverride = normalizeSourceOverride(payload?.sourceOverride);
  const notes = String(payload?.notes || '').trim();
  const deliveredAtInput = String(payload?.deliveredAt || '').trim();
  const deliveredAt = operationalStatus === REPORT_OPERATIONAL_STATUS.ENTREGUE
    ? (deliveredAtInput || new Date().toISOString().slice(0, 10))
    : '';

  return {
    projectId,
    monthKey,
    operationalStatus,
    sourceOverride,
    deliveredAt,
    notes,
  };
}

export function subscribeReportDeliveryTracking(onData, onError) {
  return subscribeCollection('reportDeliveryTracking', (rows) => {
    const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => {
      try {
        return {
          id: row?.id,
          ...normalizeReportDeliveryTrackingPayload(row),
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    onData(normalizedRows);
  }, onError);
}

export async function saveReportDeliveryTracking(projectId, monthKey, payload, meta = {}) {
  const normalized = normalizeReportDeliveryTrackingPayload({
    ...payload,
    projectId,
    monthKey,
  });
  const docId = buildReportDeliveryTrackingId(normalized.projectId, normalized.monthKey);
  await saveDoc('reportDeliveryTracking', docId, normalized, { ...meta, merge: true });
  return docId;
}

