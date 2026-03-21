import { parseTowerInput } from '../../../utils/parseTowerInput';
import { compareTowerNumbers } from '../../projects/utils/kmlUtils';

export { compareTowerNumbers };

export function normalizeInspectionPendencies(value) {
  const raw = Array.isArray(value) ? value : [];
  const dedup = new Map();
  raw.forEach((item) => {
    const vistoriaId = String(item?.vistoriaId || '').trim();
    if (!vistoriaId) return;
    dedup.set(vistoriaId, {
      vistoriaId,
      status: String(item?.status || '').trim().toLowerCase() === 'visitada' ? 'visitada' : 'pendente',
      dia: String(item?.dia || '').trim(),
    });
  });
  return [...dedup.values()];
}

export function getInspectionPendency(erosion, inspectionId) {
  const vistoriaId = String(inspectionId || '').trim();
  if (!vistoriaId) return null;
  return normalizeInspectionPendencies(erosion?.pendenciasVistoria)
    .find((item) => item.vistoriaId === vistoriaId) || null;
}

export function upsertInspectionPendency(erosion, inspectionId, patch = {}) {
  const vistoriaId = String(inspectionId || '').trim();
  if (!vistoriaId) return normalizeInspectionPendencies(erosion?.pendenciasVistoria);
  const current = normalizeInspectionPendencies(erosion?.pendenciasVistoria);
  const map = new Map(current.map((item) => [item.vistoriaId, item]));
  const prev = map.get(vistoriaId) || { vistoriaId, status: 'pendente', dia: '' };
  map.set(vistoriaId, { ...prev, ...patch, vistoriaId });
  return [...map.values()];
}

export function normalizeLinkedInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || '').trim();
  const fromList = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const fromPendencies = normalizeInspectionPendencies(erosion?.pendenciasVistoria).map((item) => item.vistoriaId);
  return [...new Set([
    primary,
    ...fromList.map((item) => String(item || '').trim()),
    ...fromPendencies.map((item) => String(item || '').trim()),
  ].filter(Boolean))];
}

export function isErosionLinkedToInspection(erosion, inspectionId) {
  const iid = String(inspectionId || '').trim();
  if (!iid) return false;
  return normalizeLinkedInspectionIds(erosion).includes(iid);
}

export function toBrDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return text;
  return '';
}

export function isBrDateValid(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function normalizeTowerKey(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return String(numeric);
  return text.toUpperCase();
}

export function collectDayTowerKeys(day) {
  const detailed = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas.map((item) => item?.numero) : [];
  let source = detailed;
  if (source.length === 0 && Array.isArray(day?.torres)) source = day.torres;
  if (source.length === 0) {
    const typed = String(day?.torresInput ?? day?.torres ?? '').trim();
    if (typed) source = parseTowerInput(typed);
  }
  return [...new Set(source.map((item) => normalizeTowerKey(item)).filter(Boolean))];
}

export function findDuplicateTowersAcrossDays(details) {
  const days = Array.isArray(details) ? details : [];
  const map = new Map();
  days.forEach((day) => {
    const dayLabel = toBrDate(day?.data) || String(day?.data || '').trim() || 'Dia sem data';
    collectDayTowerKeys(day).forEach((tower) => {
      if (!map.has(tower)) map.set(tower, new Set());
      map.get(tower).add(dayLabel);
    });
  });

  return [...map.entries()]
    .map(([tower, daySet]) => ({ tower, days: [...daySet] }))
    .filter((item) => item.days.length > 1)
    .sort((a, b) => compareTowerNumbers(a.tower, b.tower));
}

export function buildInspectionId(projetoId, dataInicio, inspections = []) {
  if (!projetoId || !dataInicio) return '';

  const [yyyy, mm, dd] = String(dataInicio).split('-');
  if (!yyyy || !mm || !dd) return '';
  const dateTag = `${dd}${mm}${yyyy}`;
  const projectTag = String(projetoId).trim().toUpperCase();
  const prefix = `VS-${projectTag}-${dateTag}-`;
  const pattern = new RegExp(`^${prefix}(\\d{4})$`);

  let maxSeq = 0;
  (inspections || []).forEach((ins) => {
    const match = String(ins?.id || '').match(pattern);
    if (!match) return;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

export function findExistingInspections(projetoId, dataInicio, inspections) {
  const pid = String(projetoId || '').trim();
  const date = String(dataInicio || '').trim();
  if (!pid || !date) return [];
  return (inspections || []).filter((ins) =>
    String(ins?.projetoId || '').trim() === pid
    && String(ins?.dataInicio || '').trim() === date
  );
}

export function getPendingErosionsForInspection({ erosions, projectId, inspectionId }) {
  const pid = String(projectId || '').trim();
  const iid = String(inspectionId || '').trim();
  if (!pid || !iid) return [];
  return (erosions || []).filter((erosion) => {
    if (String(erosion?.projetoId || '').trim() !== pid) return false;
    const pendency = getInspectionPendency(erosion, iid);
    if (!pendency) return false;
    const hasVisitDate = pendency?.status === 'visitada' && String(pendency?.dia || '').trim();
    return !hasVisitDate;
  });
}

export function ensurePendingTowersVisibleInDays({ detailsDays, pendingErosions, targetDay }) {
  const days = Array.isArray(detailsDays) ? detailsDays : [];
  if (days.length === 0) return days;

  const dayTarget = String(targetDay || '').trim() || String(days[0]?.data || '').trim();
  if (!dayTarget) return days;

  const pendingByKey = new Map();
  (pendingErosions || []).forEach((item) => {
    const towerRaw = String(item?.torreRef || '').trim();
    const towerKey = normalizeTowerKey(towerRaw);
    if (!towerKey) return;
    if (!pendingByKey.has(towerKey)) pendingByKey.set(towerKey, towerRaw || towerKey);
  });
  if (pendingByKey.size === 0) return days;

  const foundTowerKeys = new Set();
  const markedDays = days.map((day) => {
    const existingDetailed = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [];
    const map = new Map(existingDetailed.map((item) => [normalizeTowerKey(item?.numero), item]));
    let changed = false;

    pendingByKey.forEach((_, towerKey) => {
      const existing = map.get(towerKey);
      if (!existing) return;
      foundTowerKeys.add(towerKey);
      if (existing.temErosao) return;
      map.set(towerKey, { ...existing, temErosao: true });
      changed = true;
    });

    if (!changed) return day;
    const merged = [...map.values()].sort((a, b) => compareTowerNumbers(a.numero, b.numero));
    const towerInput = merged.map((item) => item.numero).join(', ');
    return {
      ...day,
      torres: merged.map((item) => item.numero),
      torresDetalhadas: merged,
      ...(towerInput ? { torresInput: towerInput } : {}),
    };
  });

  const missingEntries = [...pendingByKey.entries()].filter(([towerKey]) => !foundTowerKeys.has(towerKey));
  if (missingEntries.length === 0) return markedDays;

  let targetIndex = markedDays.findIndex((day) => String(day?.data || '').trim() === dayTarget);
  if (targetIndex < 0) targetIndex = 0;
  const targetDayItem = markedDays[targetIndex];
  if (!targetDayItem) return markedDays;

  const targetMap = new Map(
    (targetDayItem?.torresDetalhadas || []).map((item) => [normalizeTowerKey(item?.numero), item]),
  );

  let changedTarget = false;
  missingEntries.forEach(([towerKey, towerValue]) => {
    const existing = targetMap.get(towerKey);
    if (existing) {
      if (existing.temErosao) return;
      targetMap.set(towerKey, { ...existing, temErosao: true });
      changedTarget = true;
      return;
    }
    targetMap.set(towerKey, { numero: towerValue || towerKey, obs: '', temErosao: true });
    changedTarget = true;
  });

  if (!changedTarget) return markedDays;

  const mergedTarget = [...targetMap.values()].sort((a, b) => compareTowerNumbers(a.numero, b.numero));
  const targetInput = mergedTarget.map((item) => item.numero).join(', ');

  return markedDays.map((day, index) => {
    if (index !== targetIndex) return day;
    return {
      ...day,
      torres: mergedTarget.map((item) => item.numero),
      torresDetalhadas: mergedTarget,
      ...(targetInput ? { torresInput: targetInput } : {}),
    };
  });
}

export function hasHotelData(day) {
  return !!String(day?.hotelNome || '').trim()
    || !!String(day?.hotelMunicipio || '').trim()
    || String(day?.hotelLogisticaNota || '').trim() !== ''
    || String(day?.hotelReservaNota || '').trim() !== ''
    || String(day?.hotelEstadiaNota || '').trim() !== ''
    || !!String(day?.hotelTorreBase || '').trim();
}

export function formatHotelNote(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '-';
}
