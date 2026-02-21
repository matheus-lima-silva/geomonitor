export const RULES_DATABASE = {
  'tipo|sulco': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento visual' },
  'tipo|ravina': { impacto: 'Médio', score: 2, frequencia: '12 meses', intervencao: 'Reconformação + revegetação' },
  'tipo|voçoroca': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Obra de contenção' },
  'tipo|deslizamento': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Obra emergencial' },
  'estagio|inicial': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento preventivo' },
  'estagio|intermediario': { impacto: 'Médio', score: 2, frequencia: '12 meses', intervencao: 'Intervenção moderada' },
  'estagio|avancado': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Obra corretiva' },
  'estagio|critico': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Intervenção imediata' },
  'profundidade|<0.5': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento' },
  'profundidade|0.5-1.5': { impacto: 'Médio', score: 2, frequencia: '12 meses', intervencao: 'Revegetação' },
  'profundidade|1.5-3.0': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Contenção necessária' },
  'profundidade|>3.0': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Obra urgente' },
  'declividade|<15': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Baixo risco' },
  'declividade|15-30': { impacto: 'Médio', score: 2, frequencia: '12 meses', intervencao: 'Risco moderado' },
  'declividade|30-45': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Alto risco' },
  'declividade|>45': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Risco crítico' },
  'largura|<1': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento' },
  'largura|1-3': { impacto: 'Médio', score: 2, frequencia: '12 meses', intervencao: 'Atenção necessária' },
  'largura|3-5': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Intervenção prioritária' },
  'largura|>5': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Ação imediata' },
};

export function normalizeRulesConfig(rawRules) {
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

export function calculateCriticality(dados, rulesConfig = RULES_DATABASE) {
  let maxScore = 0;
  let resultado = { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento visual' };
  const sourceRules = normalizeRulesConfig(rulesConfig);

  const criterios = [
    { campo: 'tipo', valor: dados.tipo?.toLowerCase() },
    { campo: 'estagio', valor: dados.estagio?.toLowerCase() },
    { campo: 'profundidade', valor: dados.profundidade },
    { campo: 'declividade', valor: dados.declividade },
    { campo: 'largura', valor: dados.largura },
  ];

  criterios.forEach((c) => {
    if (!c.valor) return;
    const chave = `${c.campo}|${c.valor}`;
    const regra = sourceRules[chave];
    if (regra && regra.score > maxScore) {
      maxScore = regra.score;
      resultado = regra;
    }
  });

  return resultado;
}
