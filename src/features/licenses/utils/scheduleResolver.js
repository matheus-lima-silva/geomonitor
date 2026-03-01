import {
  buildProjectReportOccurrences,
  normalizeReportMonths,
  normalizeReportPeriodicity,
} from '../../projects/utils/reportSchedule';

function normalizeCoverage(coverage) {
  return (Array.isArray(coverage) ? coverage : [])
    .map((item) => ({
      projetoId: String(item?.projetoId || '').trim(),
      torres: [...new Set((Array.isArray(item?.torres) ? item.torres : []).map((tower) => String(tower || '').trim()).filter(Boolean))],
      descricaoEscopo: String(item?.descricaoEscopo || '').trim(),
    }))
    .filter((item) => item.projetoId);
}

function isLicenseActiveAt(license, year, month) {
  const ref = new Date(year, month - 1, 1);
  const start = license?.inicioVigencia ? new Date(`${license.inicioVigencia}T00:00:00`) : null;
  const end = license?.fimVigencia ? new Date(`${license.fimVigencia}T23:59:59`) : null;
  if (start && !Number.isNaN(start.getTime()) && ref < start) return false;
  if (end && !Number.isNaN(end.getTime()) && ref > end) return false;
  return true;
}

function shouldIncludeBienal(year, anoBaseBienal) {
  const base = Number(anoBaseBienal);
  if (!Number.isInteger(base) || base < 2000) return false;
  return (year - base) % 2 === 0;
}

function buildCoverageSummary(coverage, projectsById) {
  return coverage
    .map((item) => {
      const projectId = String(item?.projetoId || '').trim();
      const projectName = String(projectsById?.get(projectId)?.nome || '').trim();
      const projectLabel = projectName ? `${projectId}: ${projectName}` : projectId;
      const description = String(item?.descricaoEscopo || '').trim();
      return description ? `${projectLabel} - ${description}` : projectLabel;
    })
    .join(' | ');
}

export function buildLicenseReportOccurrences(license, projectsById, startYear, endYear) {
  const coverage = normalizeCoverage(license?.cobertura);
  if (coverage.length === 0) return [];
  if (String(license?.status || '').trim().toLowerCase() === 'inativa') return [];

  const periodicidade = normalizeReportPeriodicity(license?.periodicidadeRelatorio);
  const meses = normalizeReportMonths(license?.mesesEntregaRelatorio);
  if (meses.length === 0) return [];

  const projectIds = [...new Set(coverage.map((item) => item.projetoId))];
  const projectNames = projectIds.map((id) => projectsById.get(id)?.nome || id);
  const scopeSummary = buildCoverageSummary(coverage, projectsById);

  const occurrences = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let i = 0; i < meses.length; i += 1) {
      const month = meses[i];
      if (periodicidade === 'Bienal' && !shouldIncludeBienal(year, license?.anoBaseBienal)) continue;
      if (!isLicenseActiveAt(license, year, month)) continue;
      const sortDate = new Date(year, month - 1, 1).getTime();
      occurrences.push({
        scopeType: 'lo',
        scopeId: String(license?.id || '').trim(),
        loId: String(license?.id || '').trim(),
        loNumero: String(license?.numero || '').trim(),
        esfera: String(license?.esfera || 'Federal').trim(),
        uf: String(license?.uf || '').trim(),
        orgaoAmbiental: String(license?.orgaoAmbiental || '').trim(),
        projectIds,
        projectNames,
        scopeSummary,
        month,
        year,
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        sortDate,
      });
    }
  }
  return occurrences;
}

export function buildEffectiveReportOccurrences({
  projects,
  operatingLicenses,
  startYear,
  endYear,
} = {}) {
  const listProjects = Array.isArray(projects) ? projects : [];
  const listLicenses = Array.isArray(operatingLicenses) ? operatingLicenses : [];
  const fromYear = Number(startYear);
  const toYear = Number(endYear);
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) return [];

  const projectsById = new Map(listProjects.map((item) => [String(item?.id || '').trim(), item]));

  const loOccurrences = listLicenses
    .flatMap((license) => buildLicenseReportOccurrences(license, projectsById, fromYear, toYear));

  const coveredProjectMonth = new Set();
  loOccurrences.forEach((occ) => {
    (occ.projectIds || []).forEach((projectId) => {
      coveredProjectMonth.add(`${projectId}|${occ.monthKey}`);
    });
  });

  const fallbackOccurrences = listProjects
    .flatMap((project) => buildProjectReportOccurrences(project, fromYear, toYear))
    .filter((occ) => !coveredProjectMonth.has(`${occ.projectId}|${occ.monthKey}`))
    .map((occ) => ({
      scopeType: 'project_fallback',
      scopeId: occ.projectId,
      projectIds: [occ.projectId],
      projectNames: [occ.projectName],
      scopeSummary: occ.projectName ? `${occ.projectId}: ${occ.projectName}` : occ.projectId,
      month: occ.month,
      year: occ.year,
      monthKey: occ.monthKey,
      sortDate: occ.sortDate,
    }));

  return [...loOccurrences, ...fallbackOccurrences].sort((a, b) => a.sortDate - b.sortDate);
}
