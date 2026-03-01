import { buildEffectiveReportOccurrences } from '../../licenses/utils/scheduleResolver';
import { MONTH_OPTIONS_PT } from '../../projects/utils/reportSchedule';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const IMPACT_LEVELS = ['Muito Alto', 'Alto', 'Médio', 'Baixo'];

function toTimestamp(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

function normalizeImpactLabel(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return 'Baixo';

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('muito alto') || normalized.includes('critico')) return 'Muito Alto';
  if (normalized.includes('alto')) return 'Alto';
  if (normalized.includes('medio')) return 'Médio';
  if (normalized.includes('baixo')) return 'Baixo';
  return text;
}

function matchesDashboardSearch(erosion, searchTerm) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return true;
  return String(erosion?.id || '').toLowerCase().includes(term)
    || String(erosion?.projetoId || '').toLowerCase().includes(term);
}

export function getErosionImpact(erosion) {
  return normalizeImpactLabel(erosion?.grauFinal || erosion?.grauTecnico || erosion?.impacto || '');
}

export function getErosionSortTimestamp(erosion) {
  return Math.max(
    toTimestamp(erosion?.ultimaAtualizacao),
    toTimestamp(erosion?.updatedAt),
    toTimestamp(erosion?.createdAt),
    toTimestamp(erosion?.dataCadastro),
    toTimestamp(erosion?.data),
  );
}

export function formatTowerLabel(value) {
  const tower = String(value ?? '').trim();
  if (!tower) return 'Não informado';
  if (tower === '0') return 'Pórtico (T0)';
  return `Torre ${tower}`;
}

export function formatMonitoringMonthLabel(monthValue) {
  const month = Number(monthValue);
  const found = MONTH_OPTIONS_PT.find((item) => item.value === month);
  return found?.label || String(monthValue || '-');
}

function getOccurrenceSourceLabel(item) {
  if (item?.scopeType === 'lo') {
    const loLabel = String(item?.loNumero || item?.loId || item?.scopeId || '').trim();
    return loLabel ? `LO ${loLabel}` : 'LO';
  }
  return 'Empreendimento vinculado';
}

function normalizeOccurrenceProjects(item) {
  const ids = Array.isArray(item?.projectIds)
    ? item.projectIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const names = Array.isArray(item?.projectNames)
    ? item.projectNames.map((value) => String(value || '').trim())
    : [];

  if (ids.length === 0) {
    const fallbackId = String(item?.scopeId || '').trim();
    if (fallbackId) ids.push(fallbackId);
  }

  return ids.map((projectId, index) => ({
    projectId,
    projectName: names[index] || projectId,
  }));
}

function buildReportMonthDetails(reportOccurrences) {
  const monthBuckets = new Map();
  const list = Array.isArray(reportOccurrences) ? reportOccurrences : [];

  list.forEach((item) => {
    const monthKey = String(item?.monthKey || '').trim();
    if (!monthKey) return;

    if (!monthBuckets.has(monthKey)) {
      monthBuckets.set(monthKey, new Map());
    }
    const projectsMap = monthBuckets.get(monthKey);
    const sourceLabel = getOccurrenceSourceLabel(item);
    const scopeLabel = String(item?.scopeSummary || '').trim() || '-';
    const projects = normalizeOccurrenceProjects(item);

    projects.forEach(({ projectId, projectName }) => {
      if (!projectId) return;

      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          projectId,
          projectName: projectName || projectId,
          sourceSet: new Set(),
          scopeSet: new Set(),
        });
      }

      const detail = projectsMap.get(projectId);
      if (!detail.projectName && projectName) detail.projectName = projectName;
      detail.sourceSet.add(sourceLabel);
      if (scopeLabel !== '-') {
        detail.scopeSet.add(scopeLabel);
      }
    });
  });

  const detailsByMonth = {};
  monthBuckets.forEach((projectsMap, monthKey) => {
    const rows = Array.from(projectsMap.values())
      .sort((a, b) => {
        const byProjectId = String(a.projectId || '').localeCompare(String(b.projectId || ''));
        if (byProjectId !== 0) return byProjectId;
        return String(a.projectName || '').localeCompare(String(b.projectName || ''));
      })
      .map((detail) => ({
        projectId: detail.projectId,
        projectName: detail.projectName || detail.projectId,
        sourceSummary: Array.from(detail.sourceSet).join(' | ') || '-',
        scopeSummary: Array.from(detail.scopeSet).join(' | ') || '-',
      }));

    detailsByMonth[monthKey] = rows;
  });

  return detailsByMonth;
}

export function buildMonitoringViewModel({
  projects,
  inspections,
  erosions,
  operatingLicenses,
  searchTerm,
  nowMs = Date.now(),
} = {}) {
  const projectsList = Array.isArray(projects) ? projects : [];
  const inspectionsList = Array.isArray(inspections) ? inspections : [];
  const erosionsList = Array.isArray(erosions) ? erosions : [];
  const licensesList = Array.isArray(operatingLicenses) ? operatingLicenses : [];
  const currentYear = new Date(nowMs).getFullYear();

  const filteredErosions = erosionsList.filter((item) => matchesDashboardSearch(item, searchTerm));

  const reportOccurrences = buildEffectiveReportOccurrences({
    projects: projectsList,
    operatingLicenses: licensesList,
    startYear: currentYear,
    endYear: currentYear + 1,
  }).sort((a, b) => a.sortDate - b.sortDate || String(a.scopeId || '').localeCompare(String(b.scopeId || '')));

  const reportByMonth = reportOccurrences.reduce((acc, item) => {
    const monthKey = String(item?.monthKey || '').trim();
    if (!monthKey) return acc;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {});

  const reportMonthRows = Object.entries(reportByMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const reportMonthDetailsByKey = buildReportMonthDetails(reportOccurrences);

  const reportPlanningAlerts = reportOccurrences
    .map((item) => {
      const target = new Date(item.year, Number(item.month) - 1, 1).getTime();
      const days = Math.ceil((target - nowMs) / DAY_IN_MS);
      return { ...item, days };
    })
    .filter((item) => item.days >= 0 && item.days <= 45)
    .sort((a, b) => a.days - b.days);

  const impactCounts = {
    'Muito Alto': 0,
    Alto: 0,
    Médio: 0,
    Baixo: 0,
  };

  filteredErosions.forEach((item) => {
    const impact = getErosionImpact(item);
    if (Object.prototype.hasOwnProperty.call(impactCounts, impact)) {
      impactCounts[impact] += 1;
    } else {
      impactCounts.Baixo += 1;
    }
  });

  const recentErosions = [...filteredErosions]
    .sort((a, b) => {
      const byDate = getErosionSortTimestamp(b) - getErosionSortTimestamp(a);
      if (byDate !== 0) return byDate;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    })
    .slice(0, 10);

  const projectsById = new Map(projectsList.map((item) => [String(item?.id || '').trim(), item]));

  return {
    reportOccurrences,
    reportPlanningAlerts,
    reportMonthRows,
    reportMonthDetailsByKey,
    impactCounts,
    criticalCount: impactCounts['Muito Alto'] + impactCounts.Alto,
    recentErosions,
    projectsById,
    projectCount: projectsList.length,
    inspectionCount: inspectionsList.length,
    erosionCount: filteredErosions.length,
  };
}
