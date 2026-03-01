import {
  CRITICALITY_V2_DEFAULTS,
  calculateCriticality as calculateCriticalityV2,
  calcular_criticidade,
  calcularCriticidade,
  mergeCriticalityV2Config,
} from '../erosions/utils/criticalityV2';

export { CRITICALITY_V2_DEFAULTS, calcular_criticidade, calcularCriticidade, mergeCriticalityV2Config };

export const RULES_DATABASE = {
  'tipo|sulco': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento visual' },
  'tipo|ravina': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Reconformacao + revegetacao' },
  'tipo|vocoroca': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Obra de contencao' },
  'tipo|deslizamento': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Obra emergencial' },
  'estagio|inicial': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento preventivo' },
  'estagio|intermediario': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Intervencao moderada' },
  'estagio|avancado': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Obra corretiva' },
  'estagio|critico': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Intervencao imediata' },
  'profundidade|<0.5': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento' },
  'profundidade|0.5-1.5': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Revegetacao' },
  'profundidade|1.5-3.0': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Contencao necessaria' },
  'profundidade|>3.0': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Obra urgente' },
  'declividade|<15': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Baixo risco' },
  'declividade|15-30': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Risco moderado' },
  'declividade|30-45': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Alto risco' },
  'declividade|>45': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Risco critico' },
  'largura|<1': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento' },
  'largura|1-3': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Atencao necessaria' },
  'largura|3-5': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Intervencao prioritaria' },
  'largura|>5': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Acao imediata' },
};

function normalizeLegacyRules(rawRules) {
  const normalized = {};
  Object.keys(RULES_DATABASE).forEach((key) => {
    const defaultRule = RULES_DATABASE[key];
    const inputRule = rawRules?.[key] || {};
    const impacto = String(inputRule.impacto || defaultRule.impacto);
    const scoreValue = Number(inputRule.score ?? defaultRule.score);
    const score = Number.isFinite(scoreValue) ? Math.min(4, Math.max(1, scoreValue)) : defaultRule.score;
    normalized[key] = {
      impacto,
      score,
      frequencia: String(inputRule.frequencia || defaultRule.frequencia),
      intervencao: String(inputRule.intervencao || defaultRule.intervencao),
    };
  });
  return normalized;
}

export function normalizeRulesConfig(rawRules) {
  const legacy = normalizeLegacyRules(rawRules || RULES_DATABASE);
  const criticalityV2 = mergeCriticalityV2Config(rawRules?.criticalityV2 || rawRules);
  return {
    ...legacy,
    criticalityV2,
  };
}

export function calculateCriticality(dados, rulesConfig = RULES_DATABASE) {
  return calculateCriticalityV2(dados, rulesConfig?.criticalityV2 || rulesConfig || CRITICALITY_V2_DEFAULTS);
}
