export function getProjectInspectionStats(projectId, inspections = []) {
  const related = (inspections || []).filter((i) => i.projetoId === projectId);
  if (related.length === 0) {
    return { count: 0, start: null, end: null, spanDays: 0, visitedDays: 0, list: [] };
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

  return {
    count: related.length,
    start: minStart,
    end: maxEnd,
    spanDays,
    visitedDays,
    list: related.sort((a, b) => new Date(b.dataInicio || '1900-01-01') - new Date(a.dataInicio || '1900-01-01')),
  };
}
