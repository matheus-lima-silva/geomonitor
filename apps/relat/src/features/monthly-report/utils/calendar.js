// Logica do calendario do Relatorio Mensal. Periodo de referencia: dia 16 do
// mes anterior ate dia 15 do mes de referencia. No calendario de edicao a
// barra multi-dia e CONTINUA (cobre fins de semana e feriados, indicando
// continuidade — design handoff v2); o pulo de dias nao-uteis vale para os
// quadros do Word/preview, via activitiesVisibleOnDate.

import { dateKey, parseDateKey, isWorkingDay } from './holidays';

const MS_PER_DAY = 86400000;

export function getDateRange(refYear, refMonth) {
  const end = new Date(refYear, refMonth, 15);
  const start = new Date(refYear, refMonth - 1, 16);
  return { start, end };
}

// Segmento visivel de uma atividade dentro de uma semana (domingo->sabado):
// barra continua, no maximo um segmento por semana, recortado nas bordas.
export function getActivitySegments(activity, weekStart, weekEnd) {
  const startKey = activity.startDate;
  const endKey = activity.endDate;

  if (startKey === endKey) {
    const d = parseDateKey(startKey);
    if (d >= weekStart && d <= weekEnd) {
      const col = Math.round((d - weekStart) / MS_PER_DAY) + 1;
      return [{ startCol: col, endCol: col, continuesLeft: false, continuesRight: false, showText: true }];
    }
    return [];
  }

  const actStart = parseDateKey(startKey);
  const actEnd = parseDateKey(endKey);
  if (actEnd < weekStart || actStart > weekEnd) return [];

  const segFrom = actStart > weekStart ? actStart : weekStart;
  const segTo = actEnd < weekEnd ? actEnd : weekEnd;
  const startCol = Math.round((segFrom - weekStart) / MS_PER_DAY) + 1;
  const endCol = Math.round((segTo - weekStart) / MS_PER_DAY) + 1;
  const continuesLeft = actStart < weekStart;
  const continuesRight = actEnd > weekEnd;
  return [{ startCol, endCol, continuesLeft, continuesRight, showText: !continuesLeft }];
}

// Empacota as atividades de uma semana em "lanes" (linhas) sem sobreposicao.
// Retorna [{ activity, segments, lane }].
export function packWeekActivities(activities, weekStart, weekEnd) {
  const weekStartKey = dateKey(weekStart);
  const weekEndKey = dateKey(weekEnd);
  const weekActs = (activities || [])
    .filter((a) => a.endDate >= weekStartKey && a.startDate <= weekEndKey)
    .slice()
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return b.endDate.localeCompare(a.endDate);
    });

  const laneOccupation = [];
  const positioned = [];

  weekActs.forEach((activity) => {
    const segments = getActivitySegments(activity, weekStart, weekEnd);
    if (segments.length === 0) return;

    const cols = new Set();
    segments.forEach((s) => {
      for (let c = s.startCol; c <= s.endCol; c += 1) cols.add(c);
    });

    let lane = 0;
    for (;;) {
      if (!laneOccupation[lane]) laneOccupation[lane] = new Set();
      let free = true;
      for (const c of cols) {
        if (laneOccupation[lane].has(c)) { free = false; break; }
      }
      if (free) {
        cols.forEach((c) => laneOccupation[lane].add(c));
        break;
      }
      lane += 1;
    }
    positioned.push({ activity, segments, lane });
  });

  return positioned;
}

// Dias uteis do periodo do relatorio (seg-sex menos feriados marcados).
export function countWorkingDays(refYear, refMonth, holidaySet) {
  const { start, end } = getDateRange(refYear, refMonth);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(d, holidaySet)) count += 1;
  }
  return count;
}

// Formata Date como DD/MM/AAAA (rotulos de periodo e cabecalhos).
export function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Atividades visiveis num dia (para o render compacto / DOCX): atividade de 1
// dia aparece sempre; multi-dia so em dias uteis.
export function activitiesVisibleOnDate(activities, dateStr, holidaySet) {
  const d = parseDateKey(dateStr);
  return (activities || []).filter((a) => {
    if (dateStr < a.startDate || dateStr > a.endDate) return false;
    if (a.startDate === a.endDate) return true;
    return isWorkingDay(d, holidaySet);
  });
}
