export const CRITICALITY_DEFAULTS = {
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
    modificador_via: {
      obstrucao_total: { descricao: 'obstrucao total da via', pontos: 3 },
      obstrucao_parcial_sem_rota: { descricao: 'obstrucao parcial sem rota alternativa', pontos: 2 },
      obstrucao_parcial_com_rota: { descricao: 'obstrucao parcial com rota alternativa', pontos: 1 },
      ruptura_plataforma: { descricao: 'ruptura de plataforma', pontos: 2 },
      via_terra: { descricao: 'via de terra', pontos: 1 },
      cap_maximo: { descricao: 'cap maximo do modificador de via', pontos: 4 },
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
    { codigo: 'C2', classe: 'Medio', min: 10, max: 18 },
    { codigo: 'C3', classe: 'Alto', min: 19, max: 27 },
    { codigo: 'C4', classe: 'Muito Alto', min: 28, max: Infinity },
  ],
  solucoes_por_criticidade: {
    C1: {
      tipo_medida: 'preventiva',
      solucoes: [
        'Cobertura vegetal (gramineas, ressemeadura)',
        'Curvas de nivel, plantio em faixas',
        'Mulching / palhada / biomanta leve',
        'Controle de trafego (evitar compactacao)',
        'Regularizacao leve de acesso (coroamento)',
      ],
    },
    C2: {
      tipo_medida: 'corretiva_leve',
      solucoes: [
        'Barraginhas e pequenos terracos',
        'Sangradouros laterais / lombadas de agua',
        'Canaletas vegetadas / valetas rasas',
        'Hidrossemeadura + biomantas leves',
        'Reperfilamento de caixa de estrada',
      ],
    },
    C3: {
      tipo_medida: 'corretiva_estrutural',
      solucoes: [
        'Reconformacao de taludes (suavizar inclinacoes)',
        'Sarjetas de crista / canaletas revestidas',
        'Escadas hidraulicas / bacias de dissipacao',
        'Check dams (degraus com pedra/gabioes/sacos solo-cimento)',
        'Bioengenharia robusta (biomantas reforcadas + estacas vivas)',
        'Enrocamento lateral em acessos criticos',
        'Protecao de base de torres (anel drenante + enrocamento)',
      ],
    },
    C4: {
      tipo_medida: 'engenharia_PRAD',
      solucoes: [
        'Rede completa de drenagem da bacia (terracos, valas contorno)',
        'Drenos profundos (espinha de peixe) para piping',
        'Diques de terra / barragens com vertedouros protegidos',
        'Estruturas de contencao (muros, gabioes) em taludes criticos',
        'Reperfilamento amplo + revegetacao com nativas',
        'Monitoramento periodico com marcos (recuo de cabeceira)',
        'PRAD especifico com acompanhamento semestral/anual',
      ],
    },
  },
};

function normalizeRangeBand(band = {}) {
  return {
    ...band,
    min: Number.isFinite(band.min) ? band.min : 0,
    max: Number.isFinite(band.max) ? band.max : Infinity,
  };
}

export function mergeCriticalityConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') return CRITICALITY_DEFAULTS;

  const source = rawConfig.criticalidade && typeof rawConfig.criticalidade === 'object'
    ? rawConfig.criticalidade
    : (rawConfig.criticalityV2 && typeof rawConfig.criticalityV2 === 'object'
      ? rawConfig.criticalityV2
      : rawConfig);

  return {
    ...CRITICALITY_DEFAULTS,
    ...source,
    pontos: {
      ...CRITICALITY_DEFAULTS.pontos,
      ...(source.pontos || {}),
    },
    solucoes_por_criticidade: {
      ...CRITICALITY_DEFAULTS.solucoes_por_criticidade,
      ...(source.solucoes_por_criticidade || {}),
    },
    faixas: Array.isArray(source.faixas) && source.faixas.length > 0
      ? source.faixas.map(normalizeRangeBand)
      : CRITICALITY_DEFAULTS.faixas,
  };
}

export function normalizeRulesConfig(rawRules) {
  const source = rawRules && typeof rawRules === 'object' ? rawRules : {};
  return {
    ...source,
    criticalidade: mergeCriticalityConfig(source),
  };
}
