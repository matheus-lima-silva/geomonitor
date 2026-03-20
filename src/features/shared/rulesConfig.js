export const CRITICALITY_V2_DEFAULTS = {
  pontos: {
    profundidade: {
      P1: { descricao: '<= 1', pontos: 0 },
      P2: { descricao: '> 1 - 10', pontos: 2 },
      P3: { descricao: '> 10 - 30', pontos: 4 },
      P4: { descricao: '> 30', pontos: 6 },
    },
    tipo_erosao: {
      T1: { tipos: ['laminar'], pontos: 0 },
      T2: { tipos: ['sulco'], pontos: 2 },
      T3: { tipos: ['ravina'], pontos: 4 },
      T4: { tipos: ['vocoroca', 'movimento_massa'], pontos: 6 },
    },
    declividade: {
      D1: { descricao: '< 10', pontos: 0 },
      D2: { descricao: '10 - 25', pontos: 2 },
      D3: { descricao: '25 - 45', pontos: 4 },
      D4: { descricao: '> 45', pontos: 6 },
    },
    solo: {
      S1: { tipos: ['lateritico'], pontos: 0 },
      S2: { tipos: ['argiloso'], pontos: 2 },
      S3: { tipos: ['solos_rasos'], pontos: 4 },
      S4: { tipos: ['arenoso'], pontos: 6 },
    },
    atividade: {
      A1: { descricao: 'estabilizado (vegetacao interior, sem avanco)', pontos: 0 },
      A2: { descricao: 'indeterminado (sem vegetacao, sem avanco)', pontos: 2 },
      A3: { descricao: 'atividade parcial (avanco com vegetacao)', pontos: 4 },
      A4: { descricao: 'avanco ativo (avanco sem vegetacao)', pontos: 6 },
    },
    exposicao: {
      E1: { descricao: '> 50', pontos: 0 },
      E2: { descricao: '20 - 50', pontos: 2 },
      E3: { descricao: '5 - 20', pontos: 4 },
      E4: { descricao: '< 5', pontos: 6 },
    },
  },
  faixas: [
    { codigo: 'C1', classe: 'Baixo', min: 0, max: 9 },
    { codigo: 'C2', classe: 'Médio', min: 10, max: 18 },
    { codigo: 'C3', classe: 'Alto', min: 19, max: 27 },
    { codigo: 'C4', classe: 'Muito Alto', min: 28, max: Infinity },
  ],
  solucoes_por_criticidade: {
    C1: {
      tipo_medida: 'preventiva',
      solucoes: [
        'Cobertura vegetal (gramíneas, ressemeadura)',
        'Curvas de nível, plantio em faixas',
        'Mulching / palhada / biomanta leve',
        'Controle de tráfego (evitar compactação)',
        'Regularização leve de acesso (coroamento)',
      ],
    },
    C2: {
      tipo_medida: 'corretiva_leve',
      solucoes: [
        'Barraginhas e pequenos terraços',
        'Sangradouros laterais / lombadas de água',
        'Canaletas vegetadas / valetas rasas',
        'Hidrossemeadura + biomantas leves',
        'Reperfilamento de caixa de estrada',
      ],
    },
    C3: {
      tipo_medida: 'corretiva_estrutural',
      solucoes: [
        'Reconformação de taludes (suavizar inclinações)',
        'Sarjetas de crista / canaletas revestidas',
        'Escadas hidráulicas / bacias de dissipação',
        'Check dams (degraus com pedra/gabiões/sacos solo-cimento)',
        'Bioengenharia robusta (biomantas reforçadas + estacas vivas)',
        'Enrocamento lateral em acessos críticos',
        'Proteção de base de torres (anel drenante + enrocamento)',
      ],
    },
    C4: {
      tipo_medida: 'engenharia_PRAD',
      solucoes: [
        'Rede completa de drenagem da bacia (terraços, valas contorno)',
        'Drenos profundos (espinha de peixe) para piping',
        'Diques de terra / barragens com vertedouros protegidos',
        'Estruturas de contenção (muros, gabiões) em taludes críticos',
        'Reperfilamento amplo + revegetação com nativas',
        'Monitoramento periódico com marcos (recuo de cabeceira)',
        'PRAD específico com acompanhamento semestral/anual',
      ],
    },
  },
};

export function mergeCriticalityV2Config(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') return CRITICALITY_V2_DEFAULTS;
  const source = rawConfig.criticalityV2 && typeof rawConfig.criticalityV2 === 'object'
    ? rawConfig.criticalityV2
    : rawConfig;

  return {
    ...CRITICALITY_V2_DEFAULTS,
    ...source,
    pontos: {
      ...CRITICALITY_V2_DEFAULTS.pontos,
      ...(source.pontos || {}),
    },
    solucoes_por_criticidade: {
      ...CRITICALITY_V2_DEFAULTS.solucoes_por_criticidade,
      ...(source.solucoes_por_criticidade || {}),
    },
    faixas: Array.isArray(source.faixas) && source.faixas.length > 0
      ? source.faixas
      : CRITICALITY_V2_DEFAULTS.faixas,
  };
}

export const RULES_DATABASE = {
  'tipo|sulco': { impacto: 'Baixo', score: 1, frequencia: '24 meses', intervencao: 'Monitoramento visual' },
  'tipo|ravina': { impacto: 'Medio', score: 2, frequencia: '12 meses', intervencao: 'Reconformacao + revegetacao' },
  'tipo|vocoroca': { impacto: 'Alto', score: 3, frequencia: '6 meses', intervencao: 'Obra de contencao' },
  'tipo|movimento_massa': { impacto: 'Muito Alto', score: 4, frequencia: '3 meses', intervencao: 'Obra emergencial' },
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
