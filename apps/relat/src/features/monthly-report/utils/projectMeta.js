// Metadados auto-computados por projeto (categorias + dias uteis cobertos),
// ex.: "VISTORIA, RELATÓRIO · 16, 17, 20 E 24/04 (4 DIAS ÚTEIS)".
// Portado de relatorio_mensal.html, adaptado ao shape da API.

import { dateKey, parseDateKey, isWorkingDay } from './holidays';
import { getDateRange } from './calendar';
import { CATEGORIES } from './constants';

export function activitiesOfProject(activities, projectId) {
  return (activities || []).filter((a) => a.projectId === projectId);
}

// Dias (chaves) cobertos por atividades dentro do periodo de referencia.
// Atividade de 1 dia conta sempre; multi-dia conta so dias uteis.
export function workingDaysCoveredByActivities(acts, refYear, refMonth, holidaySet) {
  const { start, end } = getDateRange(refYear, refMonth);
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const days = new Set();

  (acts || []).forEach((a) => {
    const d = parseDateKey(a.startDate);
    const endD = parseDateKey(a.endDate);
    while (d <= endD) {
      const key = dateKey(d);
      if (key >= startKey && key <= endKey) {
        if (a.startDate === a.endDate || isWorkingDay(d, holidaySet)) {
          days.add(key);
        }
      }
      d.setDate(d.getDate() + 1);
    }
  });

  return [...days].sort();
}

export function formatDayList(days) {
  const dayStrs = days.map((d) => String(d).padStart(2, '0'));
  if (dayStrs.length === 1) return dayStrs[0];
  if (dayStrs.length === 2) return `${dayStrs[0]} E ${dayStrs[1]}`;
  return `${dayStrs.slice(0, -1).join(', ')} E ${dayStrs[dayStrs.length - 1]}`;
}

// Agrupa por mes: "16, 17, 20, 22 E 24/04" ou "16, 24/04 E 04, 11/05".
export function formatDateLabel(dayKeys) {
  if (dayKeys.length === 0) return '';
  const byMonth = {};
  dayKeys.forEach((k) => {
    const [y, m, d] = k.split('-');
    const monthKey = `${m}/${y.slice(2)}`;
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(parseInt(d, 10));
  });

  const monthsOrdered = Object.keys(byMonth).sort((a, b) => {
    const [ma, ya] = a.split('/');
    const [mb, yb] = b.split('/');
    return (ya + ma).localeCompare(yb + mb);
  });

  return monthsOrdered
    .map((mk) => {
      const days = byMonth[mk].sort((a, b) => a - b);
      return `${formatDayList(days)}/${mk.split('/')[0]}`;
    })
    .join(' E ');
}

// Categorias (rotulos curtos) ordenadas por frequencia.
export function categoriesOfProject(acts) {
  if (!acts || acts.length === 0) return [];
  const counts = {};
  acts.forEach((a) => {
    counts[a.category] = (counts[a.category] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => CATEGORIES[key]?.shortLabel || String(key).toUpperCase());
}

export function computedMetaForProject(activities, projectId, refYear, refMonth, holidaySet) {
  const acts = activitiesOfProject(activities, projectId);
  if (acts.length === 0) return '';
  const cats = categoriesOfProject(acts);
  const days = workingDaysCoveredByActivities(acts, refYear, refMonth, holidaySet);
  const dateLabel = formatDateLabel(days);
  const dayCount = days.length;
  const dayCountLabel = dayCount > 0
    ? ` (${dayCount} DIA${dayCount !== 1 ? 'S' : ''} ÚTE${dayCount !== 1 ? 'IS' : 'L'})`
    : '';
  return `${cats.join(', ')} · ${dateLabel}${dayCountLabel}`;
}
