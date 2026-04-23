export function countWorkdays(dataInicio, dataFim, feriadosIndex = new Map()) {
  if (!dataInicio || !dataFim) return 0;
  const start = new Date(`${dataInicio}T00:00:00`);
  const end = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const iso = cur.toISOString().slice(0, 10);
      if (!feriadosIndex.has(iso)) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function normalizeTowerKey(value) {
  const s = String(value ?? '').trim();
  return s === '' || s === 'undefined' || s === 'null' ? null : s;
}

function parseTowerList(raw) {
  if (!raw) return [];
  return String(raw).split(/[\s,;/|]+/).map((s) => s.trim()).filter(Boolean);
}

export function countVisitedTowersInInspection(inspection) {
  const allTowers = new Set();
  for (const day of Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : []) {
    for (const item of Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : []) {
      const key = normalizeTowerKey(item?.numero);
      if (key) allTowers.add(key);
    }
    if (Array.isArray(day?.torres)) {
      for (const t of day.torres) {
        const key = normalizeTowerKey(t);
        if (key) allTowers.add(key);
      }
    } else {
      for (const t of parseTowerList(day?.torres)) {
        const key = normalizeTowerKey(t);
        if (key) allTowers.add(key);
      }
    }
    for (const t of parseTowerList(day?.torresInput)) {
      const key = normalizeTowerKey(t);
      if (key) allTowers.add(key);
    }
  }
  return allTowers.size;
}

export function computeInspectionRhythm({ inspections = [], feriadosIndex = new Map() } = {}) {
  let totalTowers = 0;
  let totalWorkdays = 0;
  let sampleSize = 0;
  for (const insp of inspections) {
    if (!insp?.dataInicio || !insp?.dataFim) continue;
    const towers = countVisitedTowersInInspection(insp);
    if (towers <= 0) continue;
    const workdays = countWorkdays(insp.dataInicio, insp.dataFim, feriadosIndex);
    if (workdays <= 0) continue;
    totalTowers += towers;
    totalWorkdays += workdays;
    sampleSize++;
  }
  return {
    towersPerWorkday: totalWorkdays > 0 ? totalTowers / totalWorkdays : null,
    sampleSize,
    totalTowersSampled: totalTowers,
    totalWorkdaysSampled: totalWorkdays,
  };
}

export function estimateWorkdaysForTowers(towerCount, rhythm) {
  if (!rhythm || !rhythm.towersPerWorkday || rhythm.towersPerWorkday <= 0) {
    return { workdays: null, source: rhythm?.source || 'none' };
  }
  const workdays = Math.max(1, Math.ceil(towerCount / rhythm.towersPerWorkday));
  return { workdays, source: rhythm.source || 'none' };
}

export function getProjectInspectionStats(projectId, inspections = [], { feriadosIndex, globalInspections } = {}) {
  const related = (inspections || []).filter((i) => i.projetoId === projectId);

  let rhythm;
  if (feriadosIndex !== undefined) {
    const index = feriadosIndex instanceof Map ? feriadosIndex : new Map();
    const projectRhythm = computeInspectionRhythm({ inspections: related, feriadosIndex: index });
    if (projectRhythm.sampleSize >= 2) {
      rhythm = { ...projectRhythm, source: 'project' };
    } else if (globalInspections) {
      const globalRhythm = computeInspectionRhythm({ inspections: globalInspections, feriadosIndex: index });
      rhythm = globalRhythm.sampleSize >= 2
        ? { ...globalRhythm, source: 'global' }
        : { towersPerWorkday: null, sampleSize: 0, source: 'none' };
    } else {
      rhythm = { towersPerWorkday: null, sampleSize: 0, source: 'none' };
    }
  }

  const base = { count: 0, start: null, end: null, spanDays: 0, visitedDays: 0, list: [] };
  if (related.length === 0) {
    return rhythm !== undefined ? { ...base, rhythm } : base;
  }

  const toDate = (v) => (v ? new Date(`${v}T00:00:00`) : null);
  const starts = related.map((i) => toDate(i.dataInicio)).filter(Boolean);
  const ends = related.map((i) => toDate(i.dataFim || i.dataInicio)).filter(Boolean);
  const minStart = starts.sort((a, b) => a - b)[0];
  const maxEnd = ends.sort((a, b) => b - a)[0];
  const spanDays = minStart && maxEnd ? Math.floor((maxEnd - minStart) / (24 * 60 * 60 * 1000)) + 1 : 0;
  const visitedDays = related.reduce((acc, i) => {
    if (Array.isArray(i.detalhesDias) && i.detalhesDias.length > 0) return acc + i.detalhesDias.length;
    return acc + 1;
  }, 0);

  const result = {
    count: related.length,
    start: minStart,
    end: maxEnd,
    spanDays,
    visitedDays,
    list: related.sort((a, b) => new Date(b.dataInicio || '1900-01-01') - new Date(a.dataInicio || '1900-01-01')),
  };
  return rhythm !== undefined ? { ...result, rhythm } : result;
}
