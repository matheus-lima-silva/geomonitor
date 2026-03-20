import {
  getCriticalityClass,
  getCriticalityCode,
  getCriticalityScore,
  resolveErosionCriticality,
  unwrapCriticalityPayload,
} from '../../../shared/erosionHelpers';

const IMPACT_BY_CODE = {
  C1: 'Baixo',
  C2: 'Medio',
  C3: 'Alto',
  C4: 'Muito Alto',
};

const FREQUENCY_BY_CODE = {
  C1: '24 meses',
  C2: '12 meses',
  C3: '6 meses',
  C4: '3 meses',
};

function sanitizeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function sanitizeScore(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return value;
}

function sanitizeStringList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function sanitizeBreakdown(source) {
  return unwrapCriticalityPayload(source);
}

export function formatCriticalityPoints(pontos = {}) {
  const source = pontos && typeof pontos === 'object' ? pontos : {};
  return `${source.T ?? 0}/${source.P ?? 0}/${source.D ?? 0}/${source.S ?? 0}/${source.E ?? 0}/${source.A ?? 0}`;
}

export function getCriticalityImpactLabel(criticalidade, fallback = 'Baixo') {
  const resolved = sanitizeBreakdown(criticalidade);
  const explicitImpact = sanitizeText(resolved?.impacto, '');
  if (explicitImpact) return explicitImpact;
  const classe = getCriticalityClass(resolved);
  if (classe) return classe;

  const code = getCriticalityCode(resolved);
  return IMPACT_BY_CODE[code] || fallback;
}

export function getCriticalityFrequencyLabel(criticalidade, fallback = '24 meses') {
  const resolved = sanitizeBreakdown(criticalidade);
  const explicitFrequency = sanitizeText(resolved?.frequencia, '');
  if (explicitFrequency) return explicitFrequency;
  const code = getCriticalityCode(resolved);
  return FREQUENCY_BY_CODE[code] || fallback;
}

export function getCriticalityPrimaryIntervention(criticalidade, fallback = '') {
  const resolved = sanitizeBreakdown(criticalidade);
  const explicitIntervention = sanitizeText(resolved?.intervencao, '');
  if (explicitIntervention) return explicitIntervention;
  const suggested = Array.isArray(resolved?.lista_solucoes_sugeridas)
    ? resolved.lista_solucoes_sugeridas.find((item) => String(item || '').trim())
    : '';
  return sanitizeText(suggested, fallback);
}

function buildCriticalitySummary({
  criticalidade,
  impactFallback = 'Baixo',
  frequencyFallback = '24 meses',
  interventionFallback = '',
  alertsFallback = [],
} = {}) {
  const resolvedBreakdown = sanitizeBreakdown(criticalidade);
  const hasBreakdown = Boolean(
    resolvedBreakdown
      && (
        getCriticalityCode(resolvedBreakdown)
        || getCriticalityClass(resolvedBreakdown)
        || (resolvedBreakdown?.pontos && typeof resolvedBreakdown.pontos === 'object')
      ),
  );

  return {
    impacto: sanitizeText(getCriticalityImpactLabel(resolvedBreakdown, impactFallback), impactFallback),
    score: sanitizeScore(getCriticalityScore(resolvedBreakdown), 0),
    frequencia: sanitizeText(getCriticalityFrequencyLabel(resolvedBreakdown, frequencyFallback), frequencyFallback),
    intervencao: sanitizeText(getCriticalityPrimaryIntervention(resolvedBreakdown, interventionFallback), interventionFallback || '-'),
    hasBreakdown,
    criticidadeClasse: sanitizeText(getCriticalityClass(resolvedBreakdown), '-'),
    criticidadeCodigo: sanitizeText(getCriticalityCode(resolvedBreakdown), '-'),
    criticidadeScore: sanitizeScore(getCriticalityScore(resolvedBreakdown), '-'),
    pontos: formatCriticalityPoints(resolvedBreakdown?.pontos),
    tipoMedidaRecomendada: sanitizeText(resolvedBreakdown?.tipo_medida_recomendada, ''),
    solucoesSugeridas: sanitizeStringList(resolvedBreakdown?.lista_solucoes_sugeridas),
    sugestoesIntervencao: sanitizeStringList(resolvedBreakdown?.lista_solucoes_possiveis_intervencao),
    alertas: sanitizeStringList(
      resolvedBreakdown?.alertas_validacao?.length
        ? resolvedBreakdown.alertas_validacao
        : alertsFallback,
    ),
    regraContextual: sanitizeText(resolvedBreakdown?.recomendacao_contextual, ''),
  };
}

export function buildCriticalitySummaryFromCalculation(criticalidade = {}) {
  return buildCriticalitySummary({
    criticalidade,
    alertsFallback: criticalidade?.alertas_validacao,
  });
}

export function buildCriticalitySummaryFromErosion(erosion = {}) {
  const source = erosion && typeof erosion === 'object' ? erosion : {};
  const persistedCriticality = resolveErosionCriticality(source);
  return buildCriticalitySummary({
    criticalidade: persistedCriticality,
    impactFallback: sanitizeText(source.impacto, 'Baixo'),
    frequencyFallback: sanitizeText(source.frequencia, '24 meses'),
    interventionFallback: sanitizeText(source.intervencao, ''),
    alertsFallback: source.alertsAtivos,
  });
}
