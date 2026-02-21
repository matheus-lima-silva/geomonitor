export const MONTH_OPTIONS_PT = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

export function normalizeReportPeriodicity(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'trimestral') return 'Trimestral';
  if (v === 'semestral') return 'Semestral';
  if (v === 'bienal' || v === 'bi anual' || v === 'bianual') return 'Bienal';
  return 'Anual';
}

export function requiredMonthCount(periodicidade) {
  const periodicity = normalizeReportPeriodicity(periodicidade);
  if (periodicity === 'Trimestral') return 4;
  if (periodicity === 'Semestral') return 2;
  return 1;
}

export function normalizeReportMonths(meses) {
  const arr = Array.isArray(meses) ? meses : [];
  const normalized = arr.map((m) => Number(m)).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return [...new Set(normalized)].sort((a, b) => a - b);
}

export function validateReportSchedule({ periodicidadeRelatorio, mesesEntregaRelatorio, anoBaseBienal }) {
  const periodicidade = normalizeReportPeriodicity(periodicidadeRelatorio);
  const months = normalizeReportMonths(mesesEntregaRelatorio);
  const required = requiredMonthCount(periodicidade);

  if (months.length !== required) {
    return {
      ok: false,
      message: `Para periodicidade ${periodicidade}, selecione exatamente ${required} mês(es) de entrega.`,
    };
  }

  if (periodicidade === 'Bienal') {
    const ano = Number(anoBaseBienal);
    if (!Number.isInteger(ano) || ano < 2000) {
      return {
        ok: false,
        message: 'Informe um ano base válido (>= 2000) para periodicidade bienal.',
      };
    }
  }

  return { ok: true, message: '' };
}

function getLegacyReportMonth(dataEntregaRelatorio) {
  if (!dataEntregaRelatorio) return null;
  const parsed = new Date(`${dataEntregaRelatorio}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getMonth() + 1;
}

function getLegacyReportYear(dataEntregaRelatorio) {
  if (!dataEntregaRelatorio) return null;
  const parsed = new Date(`${dataEntregaRelatorio}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

export function getProjectReportConfig(project) {
  const periodicidadeRelatorio = normalizeReportPeriodicity(project?.periodicidadeRelatorio);
  const mesesConfig = normalizeReportMonths(project?.mesesEntregaRelatorio);
  const legacyMonth = getLegacyReportMonth(project?.dataEntregaRelatorio);
  const mesesEntregaRelatorio = mesesConfig.length > 0 ? mesesConfig : (legacyMonth ? [legacyMonth] : []);
  const rawYear = Number(project?.anoBaseBienal);
  const legacyYear = getLegacyReportYear(project?.dataEntregaRelatorio);
  const anoBaseBienal = Number.isInteger(rawYear) && rawYear >= 2000 ? rawYear : (legacyYear || null);
  return { periodicidadeRelatorio, mesesEntregaRelatorio, anoBaseBienal };
}

export function formatReportMonths(meses) {
  const months = normalizeReportMonths(meses);
  if (months.length === 0) return 'Não definido';
  return months
    .map((month) => MONTH_OPTIONS_PT.find((m) => m.value === Number(month))?.label || String(month))
    .join(', ');
}

function getOccurrencesForMonth(projectId, projectName, month, year) {
  const target = new Date(year, Number(month) - 1, 1);
  return {
    projectId,
    projectName,
    month: Number(month),
    year,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    sortDate: target.getTime(),
  };
}

export function buildProjectReportOccurrences(project, startYear, endYear) {
  const config = getProjectReportConfig(project);
  const months = normalizeReportMonths(config.mesesEntregaRelatorio);
  if (months.length === 0) return [];

  const occurrences = [];
  for (let year = startYear; year <= endYear; year += 1) {
    months.forEach((month) => {
      if (config.periodicidadeRelatorio === 'Bienal') {
        const base = Number(config.anoBaseBienal || startYear);
        if ((year - base) % 2 !== 0) return;
      }
      occurrences.push(getOccurrencesForMonth(project.id, project.nome || project.id, month, year));
    });
  }
  return occurrences;
}
