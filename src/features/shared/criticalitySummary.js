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
  if (!source || typeof source !== 'object') return null;
  return source;
}

export function formatCriticalityPoints(pontos = {}) {
  const source = pontos && typeof pontos === 'object' ? pontos : {};
  return `${source.T ?? 0}/${source.P ?? 0}/${source.D ?? 0}/${source.S ?? 0}/${source.E ?? 0}/${source.A ?? 0}`;
}

function buildCriticalitySummary({
  impacto,
  score,
  frequencia,
  breakdown,
  alertsFallback = [],
} = {}) {
  const resolvedBreakdown = sanitizeBreakdown(breakdown);

  return {
    impacto: sanitizeText(impacto, 'Baixo'),
    score: sanitizeScore(score, 0),
    frequencia: sanitizeText(frequencia, '24 meses'),
    hasBreakdown: !!resolvedBreakdown,
    criticidadeClasse: sanitizeText(resolvedBreakdown?.criticidade_classe, '-'),
    criticidadeCodigo: sanitizeText(resolvedBreakdown?.codigo, '-'),
    criticidadeScore: sanitizeScore(resolvedBreakdown?.criticidade_score, '-'),
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

export function buildCriticalitySummaryFromCalculation(criticality = {}) {
  const source = criticality && typeof criticality === 'object' ? criticality : {};
  return buildCriticalitySummary({
    impacto: source.impacto,
    score: source.score,
    frequencia: source.frequencia,
    breakdown: source.breakdown,
    alertsFallback: source.alertas_validacao,
  });
}

export function buildCriticalitySummaryFromErosion(erosion = {}) {
  const source = erosion && typeof erosion === 'object' ? erosion : {};
  const persistedCriticality = source.criticalidadeV2 && typeof source.criticalidadeV2 === 'object'
    ? (source.criticalidadeV2.breakdown && typeof source.criticalidadeV2.breakdown === 'object'
      ? source.criticalidadeV2.breakdown
      : source.criticalidadeV2)
    : null;
  return buildCriticalitySummary({
    impacto: persistedCriticality?.legacy?.impacto || source.impacto,
    score: persistedCriticality?.criticidade_score ?? source.score,
    frequencia: persistedCriticality?.legacy?.frequencia || source.frequencia,
    breakdown: persistedCriticality,
    alertsFallback: source.alertsAtivos,
  });
}
