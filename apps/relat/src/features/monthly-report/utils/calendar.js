// Logica do calendario do Relatorio Mensal. Periodo de referencia: dia 16 do
// mes anterior ate dia 15 do mes de referencia. Atividades multi-dia ocupam
// barras que pulam fins de semana e feriados. Portado de relatorio_mensal.html,
// adaptado ao shape da API (startDate/endDate) e recebendo o holidaySet.

import { dateKey, parseDateKey, isWorkingDay } from './holidays';

const MS_PER_DAY = 86400000;

export function getDateRange(refYear, refMonth) {
  const end = new Date(refYear, refMonth, 15);
  const start = new Date(refYear, refMonth - 1, 16);
  return { start, end };
}

// Segmentos visiveis de uma atividade dentro de uma semana (domingo->sabado).
// Atividades multi-dia quebram em segmentos pulando dias nao-uteis.
export function getActivitySegments(activity, weekStart, weekEnd, holidaySet) {
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
  const segments = [];
  let segStart = null;
  let firstSegment = true;
  const actStartedBeforeWeek = actStart < weekStart;
  const actEndsAfterWeek = actEnd > weekEnd;

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const inActivity = d >= actStart && d <= actEnd;
    const isWork = isWorkingDay(d, holidaySet);

    if (inActivity && isWork) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      const continuesLeft = firstSegment && actStartedBeforeWeek;
      segments.push({
        startCol: segStart + 1,
        endCol: i,
        continuesLeft,
        continuesRight: false,
        showText: firstSegment && !continuesLeft,
      });
      firstSegment = false;
      segStart = null;
    }
  }

  if (segStart !== null) {
    const continuesLeft = firstSegment && actStartedBeforeWeek;
    segments.push({
      startCol: segStart + 1,
      endCol: 7,
      continuesLeft,
      continuesRight: actEndsAfterWeek,
      showText: firstSegment && !continuesLeft,
    });
  }

  return segments;
}

// Empacota as atividades de uma semana em "lanes" (linhas) sem sobreposicao.
// Retorna [{ activity, segments, lane }].
export function packWeekActivities(activities, weekStart, weekEnd, holidaySet) {
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
    const segments = getActivitySegments(activity, weekStart, weekEnd, holidaySet);
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
