import { buildEffectiveReportPlan } from '../../licenses/utils/scheduleResolver';
import { MONTH_OPTIONS_PT } from '../../projects/utils/reportSchedule';
import { normalizeFollowupEventType, normalizeFollowupHistory } from '../../shared/viewUtils';
import {
  REPORT_OPERATIONAL_STATUS,
  REPORT_SOURCE_OVERRIDE,
  getOperationalStatusPresentation,
  normalizeSourceOverride,
  getSourceOverrideLabel,
} from './reportTracking';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const IMPACT_LEVELS = ['Muito Alto', 'Alto', 'Medio', 'Baixo'];
export const CRITICALITY_LEVELS = ['C1', 'C2', 'C3', 'C4'];

function toTimestamp(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

function normalizeImpactLabel(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return 'Baixo';

  const normalized = text
    .toLowerCase()
    .replace(/[\-_]+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.includes('muito alto') || normalized.includes('critico')) return 'Muito Alto';
  if (normalized.includes('alto')) return 'Alto';
  if (normalized.includes('medio')) return 'Medio';
  if (normalized.includes('baixo')) return 'Baixo';
  return text;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function getPersistedCriticality(erosion) {
  const source = erosion?.criticalidade
    || erosion?.criticalidadeV2
    || erosion?.criticidadeV2
    || erosion?.criticalityV2
    || erosion?.criticality
    || null;
  if (!source || typeof source !== 'object') return null;

  const nestedCandidates = [
    source.breakdown,
    source.campos_calculados,
    source.calculation,
    source.resultado,
  ];

  for (const candidate of nestedCandidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }

  return source;
}

function mapCriticalityCodeToImpact(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (normalizedCode === 'C4') return 'Muito Alto';
  if (normalizedCode === 'C3') return 'Alto';
  if (normalizedCode === 'C2') return 'Medio';
  if (normalizedCode === 'C1') return 'Baixo';
  return '';
}

function mapImpactToCriticalityCode(impact) {
  const normalizedImpact = normalizeImpactLabel(impact);
  if (normalizedImpact === 'Muito Alto') return 'C4';
  if (normalizedImpact === 'Alto') return 'C3';
  if (normalizedImpact === 'Medio') return 'C2';
  if (normalizedImpact === 'Baixo') return 'C1';
  return '';
}

function mapScoreToCriticalityCode(score) {
  const safeScore = Number(score);
  if (!Number.isFinite(safeScore)) return '';
  if (safeScore >= 28) return 'C4';
  if (safeScore >= 19) return 'C3';
  if (safeScore >= 10) return 'C2';
  if (safeScore >= 0) return 'C1';
  return '';
}

function resolveCriticalityCode(erosion, persistedCriticality, impact) {
  const directCode = String(pickFirst(
    persistedCriticality?.codigo,
    persistedCriticality?.criticidade_codigo,
    persistedCriticality?.criticidadeCodigo,
    persistedCriticality?.criticality_code,
    persistedCriticality?.criticalityCode,
    erosion?.criticidadeCodigo,
    erosion?.criticalityCode,
  )).trim().toUpperCase();
  if (CRITICALITY_LEVELS.includes(directCode)) return directCode;

  const impactDerivedCode = mapImpactToCriticalityCode(
    pickFirst(
      persistedCriticality?.criticidade_classe,
      persistedCriticality?.criticidadeClasse,
      persistedCriticality?.criticality_class,
      persistedCriticality?.criticalityClass,
      persistedCriticality?.impacto,
      impact,
      erosion?.impacto,
      erosion?.grauFinal,
      erosion?.grauTecnico,
    ),
  );
  if (impactDerivedCode) return impactDerivedCode;

  return mapScoreToCriticalityCode(
    pickFirst(
      persistedCriticality?.criticidade_score,
      persistedCriticality?.criticidadeScore,
      persistedCriticality?.criticality_score,
      persistedCriticality?.criticalityScore,
      erosion?.score,
      erosion?.criticidadeScore,
      erosion?.criticalityScore,
    ),
  );
}

function parseNumeric(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function dedupeById(list = [], idSelector = (item) => item?.id) {
  const rows = Array.isArray(list) ? list : [];
  const seen = new Set();
  const unique = [];

  rows.forEach((item) => {
    const rawId = String(idSelector(item) || '').trim();
    if (!rawId) {
      unique.push(item);
      return;
    }

    const normalizedId = rawId.toUpperCase();
    if (seen.has(normalizedId)) return;
    seen.add(normalizedId);
    unique.push(item);
  });

  return unique;
}

function matchesDashboardSearch(erosion, searchTerm) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return true;
  return String(erosion?.id || '').toLowerCase().includes(term)
    || String(erosion?.projetoId || '').toLowerCase().includes(term);
}

function buildProjectMonthKey(projectId, monthKey) {
  return `${String(projectId || '').trim()}|${String(monthKey || '').trim()}`;
}

function normalizeTrackingRows(deliveryTracking) {
  const list = Array.isArray(deliveryTracking) ? deliveryTracking : [];
  const map = new Map();
  list.forEach((item) => {
    const projectId = String(item?.projectId || '').trim();
    const monthKey = String(item?.monthKey || '').trim();
    if (!projectId || !/^\d{4}-\d{2}$/.test(monthKey)) return;
    map.set(buildProjectMonthKey(projectId, monthKey), {
      projectId,
      monthKey,
      operationalStatus: String(item?.operationalStatus || '').trim().toUpperCase(),
      sourceOverride: normalizeSourceOverride(item?.sourceOverride),
      deliveredAt: String(item?.deliveredAt || '').trim(),
      notes: String(item?.notes || '').trim(),
    });
  });
  return map;
}

export function getErosionImpact(erosion) {
  const persistedCriticality = getPersistedCriticality(erosion);
  return normalizeImpactLabel(
    pickFirst(
      erosion?.grauFinal,
      erosion?.grauTecnico,
      erosion?.impacto,
      persistedCriticality?.impacto,
      persistedCriticality?.criticidade_classe,
      persistedCriticality?.criticidadeClasse,
      persistedCriticality?.criticality_class,
      persistedCriticality?.criticalityClass,
      mapCriticalityCodeToImpact(pickFirst(
        persistedCriticality?.codigo,
        persistedCriticality?.criticidade_codigo,
        persistedCriticality?.criticidadeCodigo,
        persistedCriticality?.criticality_code,
        persistedCriticality?.criticalityCode,
      )),
    ),
  );
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
  if (!tower) return 'Nao informado';
  if (tower === '0') return 'Portico (T0)';
  return `Torre ${tower}`;
}

export function formatMonitoringMonthLabel(monthValue) {
  const month = Number(monthValue);
  const found = MONTH_OPTIONS_PT.find((item) => item.value === month);
  return found?.label || String(monthValue || '-');
}

export function getReportTrackingStatus(days) {
  const safeDays = Number(days);
  if (!Number.isFinite(safeDays)) {
    return { label: 'Sem prazo', tone: 'neutral' };
  }
  if (safeDays < 0) {
    return { label: 'Atrasado', tone: 'danger' };
  }
  if (safeDays <= 15) {
    return { label: 'Urgente', tone: 'critical' };
  }
  if (safeDays <= 45) {
    return { label: 'Em acompanhamento', tone: 'warning' };
  }
  return { label: 'No prazo', tone: 'ok' };
}

function getOccurrenceSourceLabel(item) {
  if (String(item?.sourceApplied || '').toUpperCase() === 'LO' || item?.scopeType === 'lo') {
    const loLabel = String(item?.loNumero || item?.loId || item?.scopeId || '').trim();
    return loLabel ? `LO ${loLabel}` : 'LO';
  }
  return 'Empreendimento vinculado';
}

function getAggregatedOperationalStatus(projectBreakdown) {
  const list = Array.isArray(projectBreakdown) ? projectBreakdown : [];
  if (list.length === 0) return getOperationalStatusPresentation(REPORT_OPERATIONAL_STATUS.NAO_INICIADO);

  const values = [...new Set(list.map((item) => String(item?.operationalStatusValue || '').trim().toUpperCase()).filter(Boolean))];
  if (values.length === 1) {
    return getOperationalStatusPresentation(values[0]);
  }
  return {
    value: 'MISTO',
    label: 'Misto',
    tone: 'warning',
  };
}

function buildProjectBreakdownByMonth(reportProjectMonthRows) {
  const monthBuckets = new Map();
  (reportProjectMonthRows || []).forEach((row) => {
    const monthKey = String(row?.monthKey || '').trim();
    if (!monthKey) return;
    if (!monthBuckets.has(monthKey)) monthBuckets.set(monthKey, []);
    monthBuckets.get(monthKey).push(row);
  });
  return monthBuckets;
}

function buildReportMonthDetails(reportProjectMonthRows = []) {
  const byMonth = buildProjectBreakdownByMonth(reportProjectMonthRows);
  const detailsByMonth = {};

  byMonth.forEach((rows, monthKey) => {
    const details = [...rows]
      .sort((a, b) => String(a.projectId || '').localeCompare(String(b.projectId || '')))
      .map((row) => {
        const sourceSummary = row.sourceApplied === 'LO'
          ? (row.loSourceSummary || 'LO')
          : 'Empreendimento vinculado';

        return {
          projectId: row.projectId,
          projectName: row.projectName,
          sourceSummary,
          scopeSummary: row.projectName ? `${row.projectId}: ${row.projectName}` : row.projectId,
          dueInDays: row.daysUntilDue,
          deadlineStatusLabel: row.deadlineStatusLabel,
          deadlineStatusTone: row.deadlineStatusTone,
          operationalStatusLabel: row.operationalStatusLabel,
          operationalStatusTone: row.operationalStatusTone,
          sourceApplied: row.sourceApplied,
          sourceOverride: row.sourceOverride,
          sourceOverrideLabel: row.sourceOverrideLabel,
          isOverridden: row.isOverridden,
          notes: row.notes || '',
          deliveredAt: row.deliveredAt || '',
        };
      });

    detailsByMonth[monthKey] = details;
  });

  return detailsByMonth;
}

function buildWorkTrackingRows(erosions = [], projectsById = new Map()) {
  return (Array.isArray(erosions) ? erosions : [])
    .map((erosion) => {
      const history = normalizeFollowupHistory(erosion?.acompanhamentosResumo)
        .slice()
        .sort((a, b) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')));
      const latestWorkEvent = history.find((event) => normalizeFollowupEventType(event) === 'obra');
      if (!latestWorkEvent) return null;

      const stage = String(latestWorkEvent?.obraEtapa || '').trim();
      const normalizedStage = stage.toLowerCase();
      const isActive = normalizedStage === 'projeto' || normalizedStage === 'em andamento';
      if (!isActive) return null;

      const projectId = String(erosion?.projetoId || '').trim();
      const project = projectsById.get(projectId);
      return {
        erosionId: String(erosion?.id || '').trim(),
        projectId,
        projectName: String(project?.nome || '').trim(),
        towerRef: String(erosion?.torreRef || '').trim(),
        stage,
        description: String(latestWorkEvent?.descricao || '').trim(),
        timestamp: String(latestWorkEvent?.timestamp || '').trim(),
        status: String(erosion?.status || '').trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}

function enrichSelectedOccurrences(selectedOccurrences, nowMs, trackingMap) {
  return (Array.isArray(selectedOccurrences) ? selectedOccurrences : []).map((item) => {
    const monthKey = String(item?.monthKey || '').trim();
    const projectId = String(item?.projectId || '').trim();
    const tracking = trackingMap.get(buildProjectMonthKey(projectId, monthKey));
    const target = new Date(item.year, Number(item.month) - 1, 1).getTime();
    const daysUntilDue = Math.ceil((target - nowMs) / DAY_IN_MS);
    const deadline = getReportTrackingStatus(daysUntilDue);
    const operational = getOperationalStatusPresentation(tracking?.operationalStatus);
    const sourceOverride = normalizeSourceOverride(tracking?.sourceOverride || item?.sourceOverride);

    return {
      ...item,
      daysUntilDue,
      deadlineStatusLabel: deadline.label,
      deadlineStatusTone: deadline.tone,
      trackingStatusLabel: deadline.label,
      trackingStatusTone: deadline.tone,
      operationalStatusValue: operational.value,
      operationalStatusLabel: operational.label,
      operationalStatusTone: operational.tone,
      sourceApplied: String(item?.sourceApplied || '').toUpperCase() === 'LO' ? 'LO' : 'PROJECT',
      sourceOverride,
      sourceOverrideLabel: getSourceOverrideLabel(sourceOverride),
      isOverridden: sourceOverride !== REPORT_SOURCE_OVERRIDE.AUTO,
      notes: tracking?.notes || '',
      deliveredAt: tracking?.deliveredAt || '',
    };
  });
}

function buildReportProjectMonthRows(planRows, selectedOccurrences, projectsById, nowMs, trackingMap) {
  const occurrenceByProjectMonth = new Map();
  (selectedOccurrences || []).forEach((item) => {
    const key = buildProjectMonthKey(item?.projectId, item?.monthKey);
    if (!occurrenceByProjectMonth.has(key)) {
      occurrenceByProjectMonth.set(key, []);
    }
    occurrenceByProjectMonth.get(key).push(item);
  });

  return (Array.isArray(planRows) ? planRows : [])
    .map((row) => {
      const key = buildProjectMonthKey(row?.projectId, row?.monthKey);
      const selectedRows = occurrenceByProjectMonth.get(key) || [];
      if (selectedRows.length === 0) return null;

      const firstRow = selectedRows[0];
      const tracking = trackingMap.get(key);
      const sourceOverride = normalizeSourceOverride(tracking?.sourceOverride || row?.sourceOverride);
      const target = new Date(firstRow.year, Number(firstRow.month) - 1, 1).getTime();
      const daysUntilDue = Math.ceil((target - nowMs) / DAY_IN_MS);
      const deadline = getReportTrackingStatus(daysUntilDue);
      const operational = getOperationalStatusPresentation(tracking?.operationalStatus);
      const projectId = String(row?.projectId || firstRow?.projectId || '').trim();
      const projectName = String(
        firstRow?.projectName
        || firstRow?.projectNames?.[0]
        || projectsById.get(projectId)?.nome
        || projectId,
      ).trim() || projectId;
      const loSourceSummary = [...new Set(selectedRows
        .filter((item) => item.sourceApplied === 'LO')
        .map((item) => getOccurrenceSourceLabel(item)))]
        .join(' | ');

      return {
        key,
        projectId,
        projectName,
        month: Number(firstRow.month),
        year: Number(firstRow.year),
        monthKey: String(firstRow.monthKey || ''),
        sourceApplied: String(row?.selectedSource || firstRow?.sourceApplied || 'PROJECT').toUpperCase() === 'LO' ? 'LO' : 'PROJECT',
        sourceOverride,
        sourceOverrideLabel: getSourceOverrideLabel(sourceOverride),
        isOverridden: sourceOverride !== REPORT_SOURCE_OVERRIDE.AUTO,
        baseSource: String(row?.baseSource || '').toUpperCase() === 'LO' ? 'LO' : 'PROJECT',
        hasLoOption: Boolean(row?.hasLoOption),
        hasProjectOption: Boolean(row?.hasProjectOption),
        overrideInvalid: Boolean(row?.overrideInvalid),
        loSourceSummary,
        daysUntilDue,
        deadlineStatusLabel: deadline.label,
        deadlineStatusTone: deadline.tone,
        operationalStatusValue: operational.value,
        operationalStatusLabel: operational.label,
        operationalStatusTone: operational.tone,
        notes: tracking?.notes || '',
        deliveredAt: tracking?.deliveredAt || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.monthKey || '').localeCompare(String(b.monthKey || ''))
      || String(a.projectId || '').localeCompare(String(b.projectId || '')));
}

function buildAggregatedReportOccurrences(selectedOccurrences, reportProjectMonthRows) {
  const projectMonthMap = new Map(reportProjectMonthRows.map((row) => [row.key, row]));
  const groups = new Map();

  (selectedOccurrences || []).forEach((item) => {
    const sourceApplied = String(item?.sourceApplied || '').toUpperCase() === 'LO' ? 'LO' : 'PROJECT';
    const monthKey = String(item?.monthKey || '').trim();
    const groupKey = sourceApplied === 'LO'
      ? `LO|${String(item?.scopeId || '').trim()}|${monthKey}`
      : `PROJECT|${String(item?.projectId || '').trim()}|${monthKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        ...item,
        sourceApplied,
        projectBreakdown: [],
      });
    }

    const group = groups.get(groupKey);
    const projectKey = buildProjectMonthKey(item?.projectId, item?.monthKey);
    const projectRow = projectMonthMap.get(projectKey);
    if (projectRow) {
      group.projectBreakdown.push({
        projectId: projectRow.projectId,
        projectName: projectRow.projectName,
        sourceApplied: projectRow.sourceApplied,
        sourceOverride: projectRow.sourceOverride,
        sourceOverrideLabel: projectRow.sourceOverrideLabel,
        isOverridden: projectRow.isOverridden,
        daysUntilDue: projectRow.daysUntilDue,
        deadlineStatusLabel: projectRow.deadlineStatusLabel,
        deadlineStatusTone: projectRow.deadlineStatusTone,
        operationalStatusValue: projectRow.operationalStatusValue,
        operationalStatusLabel: projectRow.operationalStatusLabel,
        operationalStatusTone: projectRow.operationalStatusTone,
        notes: projectRow.notes,
        deliveredAt: projectRow.deliveredAt,
      });
    }
  });

  return Array.from(groups.values())
    .map((group) => {
      const uniqueBreakdown = group.projectBreakdown
        .filter((item, index, array) => array.findIndex((other) => (
          other.projectId === item.projectId
        )) === index)
        .sort((a, b) => String(a.projectId || '').localeCompare(String(b.projectId || '')));

      const sourceSummary = uniqueBreakdown
        .map((item) => (item.projectName ? `${item.projectId}: ${item.projectName}` : item.projectId))
        .join(' | ');
      const operational = getAggregatedOperationalStatus(uniqueBreakdown);

      return {
        ...group,
        projectBreakdown: uniqueBreakdown,
        projectIds: uniqueBreakdown.map((item) => item.projectId),
        projectNames: uniqueBreakdown.map((item) => item.projectName),
        scopeSummary: sourceSummary || group.scopeSummary || '-',
        operationalStatusValue: operational.value,
        operationalStatusLabel: operational.label,
        operationalStatusTone: operational.tone,
        isOverridden: uniqueBreakdown.some((item) => item.isOverridden),
      };
    })
    .sort((a, b) => a.sortDate - b.sortDate
      || String(a.scopeId || '').localeCompare(String(b.scopeId || '')));
}

export function buildMonitoringViewModel({
  projects,
  inspections,
  erosions,
  operatingLicenses,
  deliveryTracking,
  searchTerm,
  nowMs = Date.now(),
} = {}) {
  const projectsList = dedupeById(projects);
  const inspectionsList = dedupeById(inspections);
  const erosionsList = dedupeById(erosions);
  const licensesList = dedupeById(operatingLicenses);
  const trackingRows = Array.isArray(deliveryTracking) ? deliveryTracking : [];
  const currentYear = new Date(nowMs).getFullYear();
  const searchTermApplied = String(searchTerm || '').trim();

  const filteredErosions = erosionsList.filter((item) => matchesDashboardSearch(item, searchTermApplied));
  const projectsById = new Map(projectsList.map((item) => [String(item?.id || '').trim(), item]));
  const trackingMap = normalizeTrackingRows(trackingRows);

  const reportPlan = buildEffectiveReportPlan({
    projects: projectsList,
    operatingLicenses: licensesList,
    startYear: currentYear,
    endYear: currentYear + 1,
    deliveryTracking: trackingRows,
  });

  const selectedOccurrences = enrichSelectedOccurrences(reportPlan.selectedOccurrences, nowMs, trackingMap);
  const reportProjectMonthRows = buildReportProjectMonthRows(
    reportPlan.projectMonthRows,
    selectedOccurrences,
    projectsById,
    nowMs,
    trackingMap,
  );

  const reportOccurrences = buildAggregatedReportOccurrences(selectedOccurrences, reportProjectMonthRows);

  const reportByMonth = reportProjectMonthRows.reduce((acc, item) => {
    const monthKey = String(item?.monthKey || '').trim();
    if (!monthKey) return acc;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {});

  const reportMonthRows = Object.entries(reportByMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const reportMonthDetailsByKey = buildReportMonthDetails(reportProjectMonthRows);

  const reportPlanningAlerts = reportOccurrences
    .filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 45)
    .map((item) => ({ ...item, days: item.daysUntilDue }))
    .sort((a, b) => a.days - b.days);

  const impactCounts = {
    'Muito Alto': 0,
    Alto: 0,
    Medio: 0,
    Baixo: 0,
  };

  const criticalityDistribution = {
    C1: 0,
    C2: 0,
    C3: 0,
    C4: 0,
  };

  let stabilizedCount = 0;
  let totalWithCriticality = 0;
  const heatPoints = [];
  let heatPointsWithoutCoordinates = 0;

  filteredErosions.forEach((item) => {
    const persistedCriticality = getPersistedCriticality(item);
    const impact = getErosionImpact(item);
    if (Object.prototype.hasOwnProperty.call(impactCounts, impact)) {
      impactCounts[impact] += 1;
    } else {
      impactCounts.Baixo += 1;
    }

    const code = resolveCriticalityCode(item, persistedCriticality, impact);
    if (Object.prototype.hasOwnProperty.call(criticalityDistribution, code)) {
      criticalityDistribution[code] += 1;
      totalWithCriticality += 1;
    }

    const situacao = String(item?.situacao || item?.status || '').trim().toLowerCase();
    if (situacao === 'estabilizado' || situacao === 'estabilizada') {
      stabilizedCount += 1;
    }

    const latitude = parseNumeric(item?.locationCoordinates?.latitude ?? item?.latitude);
    const longitude = parseNumeric(item?.locationCoordinates?.longitude ?? item?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      heatPointsWithoutCoordinates += 1;
      return;
    }

    const score = Number(pickFirst(
      persistedCriticality?.criticidade_score,
      persistedCriticality?.criticidadeScore,
      persistedCriticality?.criticality_score,
      persistedCriticality?.criticalityScore,
      item?.score,
      item?.criticidadeScore,
      item?.criticalityScore,
      0,
    ));
    const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(40, score)) : 0;
    heatPoints.push({
      id: String(item?.id || ''),
      projetoId: String(item?.projetoId || ''),
      towerRef: String(item?.torreRef || '').trim(),
      latitude,
      longitude,
      score: safeScore,
      peso: safeScore / 40,
      criticidade: String(pickFirst(
        persistedCriticality?.criticidade_classe,
        persistedCriticality?.criticidadeClasse,
        persistedCriticality?.criticality_class,
        persistedCriticality?.criticalityClass,
        impact,
        'Baixo',
      )),
    });
  });

  const recentErosions = [...filteredErosions]
    .sort((a, b) => {
      const byDate = getErosionSortTimestamp(b) - getErosionSortTimestamp(a);
      if (byDate !== 0) return byDate;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    })
    .slice(0, 10);

  const workTrackingRows = buildWorkTrackingRows(filteredErosions, projectsById);

  return {
    searchTermApplied,
    reportOccurrences,
    reportProjectMonthRows,
    reportInvalidOverrides: reportPlan.invalidOverrides,
    reportPlanningAlerts,
    reportMonthRows,
    reportMonthDetailsByKey,
    workTrackingRows,
    impactCounts,
    criticalCount: criticalityDistribution.C3 + criticalityDistribution.C4,
    criticalityDistribution,
    criticalityDistributionRows: CRITICALITY_LEVELS.map((level) => ({
      level,
      total: criticalityDistribution[level] || 0,
    })),
    stabilizationRate: totalWithCriticality > 0 ? (stabilizedCount / totalWithCriticality) * 100 : 0,
    heatPoints,
    heatPointsWithoutCoordinates,
    recentErosions,
    projectsById,
    projectCount: projectsList.length,
    inspectionCount: inspectionsList.length,
    erosionCount: filteredErosions.length,
  };
}
