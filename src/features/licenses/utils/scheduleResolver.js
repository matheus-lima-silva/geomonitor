import {
  buildProjectReportOccurrences,
  normalizeReportMonths,
  normalizeReportPeriodicity,
} from '../../projects/utils/reportSchedule';

const SOURCE_OVERRIDE_OPTIONS = ['AUTO', 'LO', 'PROJECT'];

function normalizeCoverage(coverage) {
  return (Array.isArray(coverage) ? coverage : [])
    .map((item) => ({
      projetoId: String(item?.projetoId || '').trim(),
      torres: [...new Set((Array.isArray(item?.torres) ? item.torres : []).map((tower) => String(tower || '').trim()).filter(Boolean))],
      descricaoEscopo: String(item?.descricaoEscopo || '').trim(),
    }))
    .filter((item) => item.projetoId);
}

function normalizeSourceOverride(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return SOURCE_OVERRIDE_OPTIONS.includes(normalized) ? normalized : 'AUTO';
}

function normalizeMonthKey(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(text)) return '';
  return text;
}

function buildProjectMonthKey(projectId, monthKey) {
  return `${String(projectId || '').trim()}|${String(monthKey || '').trim()}`;
}

function readTrackingMap(deliveryTracking) {
  const list = Array.isArray(deliveryTracking) ? deliveryTracking : [];
  const map = new Map();

  list.forEach((item) => {
    const projectId = String(item?.projectId || '').trim();
    const monthKey = normalizeMonthKey(item?.monthKey);
    if (!projectId || !monthKey) return;
    const key = buildProjectMonthKey(projectId, monthKey);
    map.set(key, {
      projectId,
      monthKey,
      sourceOverride: normalizeSourceOverride(item?.sourceOverride),
    });
  });

  return map;
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

function expandLicenseOccurrencesByProject(licenseOccurrences = [], projectsById = new Map()) {
  const expanded = [];

  licenseOccurrences.forEach((occurrence) => {
    const projectIds = Array.isArray(occurrence?.projectIds) ? occurrence.projectIds : [];
    if (projectIds.length === 0) return;

    projectIds.forEach((projectId, index) => {
      const id = String(projectId || '').trim();
      if (!id) return;
      const resolvedProjectName = String(
        occurrence?.projectNames?.[index]
          || projectsById.get(id)?.nome
          || id,
      ).trim();
      const monthKey = String(occurrence?.monthKey || '').trim();
      expanded.push({
        ...occurrence,
        scopeType: 'lo',
        scopeId: String(occurrence?.scopeId || '').trim(),
        sourceType: 'LO',
        sourceId: String(occurrence?.scopeId || '').trim(),
        projectId: id,
        projectName: resolvedProjectName || id,
        projectIds: [id],
        projectNames: [resolvedProjectName || id],
        monthKey,
      });
    });
  });

  return expanded;
}

function buildProjectFallbackOccurrences(projects = [], startYear, endYear) {
  const listProjects = Array.isArray(projects) ? projects : [];

  return listProjects.flatMap((project) => (
    buildProjectReportOccurrences(project, startYear, endYear).map((occurrence) => ({
      ...occurrence,
      scopeType: 'project_fallback',
      scopeId: occurrence.projectId,
      sourceType: 'PROJECT',
      sourceId: occurrence.projectId,
      projectId: occurrence.projectId,
      projectName: occurrence.projectName || occurrence.projectId,
      projectIds: [occurrence.projectId],
      projectNames: [occurrence.projectName || occurrence.projectId],
      scopeSummary: occurrence.projectName
        ? `${occurrence.projectId}: ${occurrence.projectName}`
        : occurrence.projectId,
    }))
  ));
}

function pushCandidate(map, key, row) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function uniqueSortedRows(rows = []) {
  return [...rows].sort((a, b) => (
    a.sortDate - b.sortDate
    || String(a.sourceType || '').localeCompare(String(b.sourceType || ''))
    || String(a.scopeId || '').localeCompare(String(b.scopeId || ''))
    || String(a.projectId || '').localeCompare(String(b.projectId || ''))
  ));
}

function buildRowWithSelectionMeta(row, selection) {
  return {
    ...row,
    sourceApplied: selection.selectedSource,
    baseSource: selection.baseSource,
    sourceOverride: selection.sourceOverride,
    isOverridden: selection.sourceOverride !== 'AUTO',
    hasLoOption: selection.hasLoOption,
    hasProjectOption: selection.hasProjectOption,
    overrideInvalid: selection.overrideInvalid,
  };
}

function buildSelectionForProjectMonth({
  projectId,
  monthKey,
  baseSource,
  sourceOverride,
  loRows,
  projectRows,
}) {
  const normalizedOverride = normalizeSourceOverride(sourceOverride);
  const hasLoOption = loRows.length > 0;
  const hasProjectOption = projectRows.length > 0;
  const baseRows = baseSource === 'LO' ? loRows : projectRows;

  let selectedSource = baseSource;
  let selectedRows = baseRows;
  let overrideInvalid = false;

  if (normalizedOverride === 'LO') {
    if (hasLoOption) {
      selectedSource = 'LO';
      selectedRows = loRows;
    } else {
      overrideInvalid = true;
    }
  } else if (normalizedOverride === 'PROJECT') {
    if (hasProjectOption) {
      selectedSource = 'PROJECT';
      selectedRows = projectRows;
    } else {
      overrideInvalid = true;
    }
  }

  return {
    key: buildProjectMonthKey(projectId, monthKey),
    projectId,
    monthKey,
    baseSource,
    sourceOverride: normalizedOverride,
    selectedSource,
    hasLoOption,
    hasProjectOption,
    overrideInvalid,
    selectedRows: uniqueSortedRows(selectedRows),
    loRows: uniqueSortedRows(loRows),
    projectRows: uniqueSortedRows(projectRows),
  };
}

export function buildEffectiveReportPlan({
  projects,
  operatingLicenses,
  startYear,
  endYear,
  deliveryTracking,
} = {}) {
  const listProjects = Array.isArray(projects) ? projects : [];
  const listLicenses = Array.isArray(operatingLicenses) ? operatingLicenses : [];
  const fromYear = Number(startYear);
  const toYear = Number(endYear);
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) {
    return {
      selectedOccurrences: [],
      projectMonthRows: [],
      invalidOverrides: [],
    };
  }

  const projectsById = new Map(listProjects.map((item) => [String(item?.id || '').trim(), item]));
  const trackingMap = readTrackingMap(deliveryTracking);

  const loOccurrences = listLicenses
    .flatMap((license) => buildLicenseReportOccurrences(license, projectsById, fromYear, toYear));
  const loProjectRows = expandLicenseOccurrencesByProject(loOccurrences, projectsById);
  const projectRows = buildProjectFallbackOccurrences(listProjects, fromYear, toYear);

  const loRowsByProjectMonth = new Map();
  const projectRowsByProjectMonth = new Map();
  const coveredProjectYear = new Set();

  loProjectRows.forEach((row) => {
    const monthKey = String(row?.monthKey || '').trim();
    const projectId = String(row?.projectId || '').trim();
    if (!projectId || !monthKey) return;
    const key = buildProjectMonthKey(projectId, monthKey);
    pushCandidate(loRowsByProjectMonth, key, row);

    const year = Number(String(monthKey).slice(0, 4));
    if (Number.isInteger(year)) {
      coveredProjectYear.add(buildProjectMonthKey(projectId, String(year)));
    }
  });

  projectRows.forEach((row) => {
    const monthKey = String(row?.monthKey || '').trim();
    const projectId = String(row?.projectId || '').trim();
    if (!projectId || !monthKey) return;
    const key = buildProjectMonthKey(projectId, monthKey);
    pushCandidate(projectRowsByProjectMonth, key, row);
  });

  const allProjectMonthKeys = new Set([
    ...loRowsByProjectMonth.keys(),
    ...projectRowsByProjectMonth.keys(),
  ]);

  const projectMonthRows = Array.from(allProjectMonthKeys)
    .map((key) => {
      const [projectId = '', monthKey = ''] = String(key).split('|');
      const year = Number(String(monthKey).slice(0, 4));
      const baseSource = coveredProjectYear.has(buildProjectMonthKey(projectId, String(year))) ? 'LO' : 'PROJECT';
      const tracking = trackingMap.get(key);
      return buildSelectionForProjectMonth({
        projectId,
        monthKey,
        baseSource,
        sourceOverride: tracking?.sourceOverride || 'AUTO',
        loRows: loRowsByProjectMonth.get(key) || [],
        projectRows: projectRowsByProjectMonth.get(key) || [],
      });
    })
    .filter((row) => Array.isArray(row.selectedRows) && row.selectedRows.length > 0)
    .sort((a, b) => String(a.monthKey || '').localeCompare(String(b.monthKey || ''))
      || String(a.projectId || '').localeCompare(String(b.projectId || '')));

  const selectedOccurrences = projectMonthRows
    .flatMap((row) => row.selectedRows.map((occurrence) => buildRowWithSelectionMeta(occurrence, row)))
    .sort((a, b) => a.sortDate - b.sortDate
      || String(a.scopeId || '').localeCompare(String(b.scopeId || ''))
      || String(a.projectId || '').localeCompare(String(b.projectId || '')));

  const invalidOverrides = projectMonthRows
    .filter((row) => row.overrideInvalid)
    .map((row) => ({
      projectId: row.projectId,
      monthKey: row.monthKey,
      sourceOverride: row.sourceOverride,
      baseSource: row.baseSource,
    }));

  return {
    selectedOccurrences,
    projectMonthRows,
    invalidOverrides,
  };
}

export function buildEffectiveReportOccurrences({
  projects,
  operatingLicenses,
  startYear,
  endYear,
  deliveryTracking,
} = {}) {
  return buildEffectiveReportPlan({
    projects,
    operatingLicenses,
    startYear,
    endYear,
    deliveryTracking,
  }).selectedOccurrences;
}
