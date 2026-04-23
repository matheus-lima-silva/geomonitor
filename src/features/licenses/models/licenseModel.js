import {
  BRAZIL_UF_OPTIONS,
  LICENSE_SPHERE_OPTIONS,
} from '../constants/agencies';
import {
  normalizeReportMonths,
  normalizeReportPeriodicity,
  validateReportSchedule,
} from '../../projects/utils/reportSchedule';
import { getProjectTowerList } from '../../../utils/getProjectTowerList';

function normalizeSphere(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'estadual') return 'Estadual';
  return 'Federal';
}

function normalizeUf(value) {
  const uf = String(value || '').trim().toUpperCase();
  return BRAZIL_UF_OPTIONS.includes(uf) ? uf : '';
}

function normalizeCoverage(rows) {
  const raw = Array.isArray(rows) ? rows : [];
  return raw
    .map((row) => {
      const projetoId = String(row?.projetoId || '').trim();
      const torres = [...new Set(
        (Array.isArray(row?.torres) ? row.torres : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      )];
      const descricaoEscopo = String(row?.descricaoEscopo || '').trim();
      if (!projetoId) return null;
      return {
        projetoId,
        torres,
        ...(descricaoEscopo ? { descricaoEscopo } : {}),
      };
    })
    .filter(Boolean);
}

export function createEmptyOperatingLicense() {
  return {
    id: '',
    numero: '',
    apelido: '',
    orgaoAmbiental: '',
    esfera: 'Federal',
    uf: '',
    descricao: '',
    inicioVigencia: '',
    fimVigencia: '',
    status: 'ativa',
    periodicidadeRelatorio: 'Anual',
    mesesEntregaRelatorio: [1],
    anoBaseBienal: '',
    exigeAcompanhamentoErosivo: true,
    cobertura: [],
    observacoes: '',
  };
}

export function normalizeOperatingLicensePayload(input = {}) {
  const base = createEmptyOperatingLicense();
  const esfera = normalizeSphere(input?.esfera || base.esfera);
  const uf = esfera === 'Estadual' ? normalizeUf(input?.uf) : '';
  const periodicidadeRelatorio = normalizeReportPeriodicity(input?.periodicidadeRelatorio || base.periodicidadeRelatorio);
  const mesesEntregaRelatorio = normalizeReportMonths(input?.mesesEntregaRelatorio || base.mesesEntregaRelatorio);
  const anoBaseBienal = periodicidadeRelatorio === 'Bienal'
    ? Number(input?.anoBaseBienal || '')
    : '';

  return {
    ...base,
    ...input,
    id: String(input?.id || '').trim().toUpperCase(),
    numero: String(input?.numero || '').trim(),
    apelido: String(input?.apelido || '').trim(),
    orgaoAmbiental: String(input?.orgaoAmbiental || '').trim(),
    esfera,
    uf,
    descricao: String(input?.descricao || '').trim(),
    inicioVigencia: String(input?.inicioVigencia || '').trim(),
    fimVigencia: String(input?.fimVigencia || '').trim(),
    status: String(input?.status || 'ativa').trim().toLowerCase() === 'inativa' ? 'inativa' : 'ativa',
    periodicidadeRelatorio,
    mesesEntregaRelatorio,
    anoBaseBienal,
    exigeAcompanhamentoErosivo: true,
    cobertura: normalizeCoverage(input?.cobertura),
    observacoes: String(input?.observacoes || '').trim(),
  };
}

export function validateOperatingLicensePayload(payload, { projectsById } = {}) {
  const normalized = normalizeOperatingLicensePayload(payload);

  if (!normalized.numero) return { ok: false, message: 'Informe o número da LO.' };
  if (!normalized.orgaoAmbiental) return { ok: false, message: 'Informe o órgão ambiental.' };
  if (!LICENSE_SPHERE_OPTIONS.includes(normalized.esfera)) return { ok: false, message: 'Esfera inválida.' };
  if (normalized.esfera === 'Estadual' && !normalized.uf) return { ok: false, message: 'UF é obrigatória para esfera estadual.' };
  if (normalized.esfera === 'Federal' && normalized.uf) return { ok: false, message: 'UF deve ficar vazia para esfera federal.' };
  if (!normalized.inicioVigencia) return { ok: false, message: 'Informe a data de início de vigência.' };
  if (normalized.fimVigencia && normalized.fimVigencia < normalized.inicioVigencia) {
    return { ok: false, message: 'Data fim de vigência não pode ser anterior à data de início.' };
  }

  const scheduleValidation = validateReportSchedule({
    periodicidadeRelatorio: normalized.periodicidadeRelatorio,
    mesesEntregaRelatorio: normalized.mesesEntregaRelatorio,
    anoBaseBienal: normalized.anoBaseBienal,
  });
  if (!scheduleValidation.ok) return scheduleValidation;

  if (!Array.isArray(normalized.cobertura) || normalized.cobertura.length === 0) {
    return { ok: false, message: 'Adicione ao menos um escopo de cobertura.' };
  }

  for (let i = 0; i < normalized.cobertura.length; i += 1) {
    const item = normalized.cobertura[i];
    if (!item.projetoId) return { ok: false, message: `Cobertura ${i + 1}: empreendimento obrigatório.` };
    // torres=[] e valido: significa cobertura do empreendimento inteiro.
    // Backend tambem aceita (torres default=[] em licenseSchemas.js).
    if (projectsById && projectsById.has(item.projetoId)) {
      const project = projectsById.get(item.projetoId);
      const validTowers = getProjectTowerList(project);
      if (validTowers.length > 0) {
        const validSet = new Set(validTowers);
        const invalid = item.torres.find((tower) => !validSet.has(String(tower)));
        if (invalid) {
          return {
            ok: false,
            message: `Cobertura ${i + 1}: torre ${invalid} nao pertence ao empreendimento ${item.projetoId}.`,
          };
        }
      }
    }
  }

  return { ok: true, message: '' };
}
