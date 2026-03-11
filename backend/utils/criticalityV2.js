import { normalizeLocationCoordinates } from './erosionCoordinates';

const TYPE_POINTS = {
  laminar: { classe: 'T1', pontos: 0 },
  sulco: { classe: 'T2', pontos: 2 },
  ravina: { classe: 'T3', pontos: 4 },
  vocoroca: { classe: 'T4', pontos: 6 },
  movimento_massa: { classe: 'T4', pontos: 6 },
};

const SOIL_POINTS = {
  lateritico: { classe: 'S1', pontos: 0 },
  argiloso: { classe: 'S2', pontos: 2 },
  solos_rasos: { classe: 'S3', pontos: 4 },
  arenoso: { classe: 'S3', pontos: 4 },
};

const DISTANCE_POINTS = {
  E1: { classe: 'E1', pontos: 0, min: 50, max: Infinity, minInclusive: false, maxInclusive: true },
  E2: { classe: 'E2', pontos: 2, min: 20, max: 50, minInclusive: true, maxInclusive: true },
  E3: { classe: 'E3', pontos: 4, min: 5, max: 20, minInclusive: true, maxInclusive: false },
  E4: { classe: 'E4', pontos: 6, min: -Infinity, max: 5, minInclusive: true, maxInclusive: false },
};

const SLOPE_POINTS = {
  D1: { classe: 'D1', pontos: 0, min: -Infinity, max: 10, minInclusive: true, maxInclusive: false },
  D2: { classe: 'D2', pontos: 2, min: 10, max: 25, minInclusive: true, maxInclusive: true },
  D3: { classe: 'D3', pontos: 4, min: 25, max: Infinity, minInclusive: false, maxInclusive: true },
};

const DEPTH_POINTS = {
  P1: { classe: 'P1', pontos: 0, min: -Infinity, max: 1, minInclusive: true, maxInclusive: true },
  P2: { classe: 'P2', pontos: 2, min: 1, max: 10, minInclusive: false, maxInclusive: true },
  P3: { classe: 'P3', pontos: 4, min: 10, max: 30, minInclusive: false, maxInclusive: true },
  P4: { classe: 'P4', pontos: 6, min: 30, max: Infinity, minInclusive: false, maxInclusive: true },
};

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
      D3: { descricao: '> 25', pontos: 4 },
    },
    solo: {
      S1: { tipos: ['lateritico'], pontos: 0 },
      S2: { tipos: ['argiloso'], pontos: 2 },
      S3: { tipos: ['solos_rasos', 'arenoso'], pontos: 4 },
    },
    exposicao: {
      E1: { descricao: '> 50', pontos: 0 },
      E2: { descricao: '20 - 50', pontos: 2 },
      E3: { descricao: '5 - 20', pontos: 4 },
      E4: { descricao: '< 5', pontos: 6 },
    },
  },
  faixas: [
    { codigo: 'C1', classe: 'Baixo', min: 0, max: 7 },
    { codigo: 'C2', classe: 'Médio', min: 8, max: 15 },
    { codigo: 'C3', classe: 'Alto', min: 16, max: 23 },
    { codigo: 'C4', classe: 'Muito Alto', min: 24, max: Infinity },
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

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeTextLower(value) {
  return normalizeText(value).toLowerCase();
}

function toAscii(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const text = normalizeText(value).replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanFromUnknown(value) {
  if (typeof value === 'boolean') return value;
  const text = normalizeTextLower(value);
  if (!text) return false;
  return ['sim', 'true', '1', 'yes', 'y'].includes(text);
}

function resolveRange(rangeMap, value, fallbackClass) {
  if (!Number.isFinite(value)) {
    return { classe: fallbackClass, pontos: 0, inferred: true };
  }

  const entries = Object.values(rangeMap);
  const found = entries.find((item) => {
    const gtMin = item.minInclusive ? value >= item.min : value > item.min;
    const ltMax = item.maxInclusive ? value <= item.max : value < item.max;
    return gtMin && ltMax;
  });

  if (!found) return { classe: fallbackClass, pontos: 0, inferred: true };
  return { classe: found.classe, pontos: found.pontos, inferred: false };
}

function resolveCriticalityBand(score, config) {
  const bands = Array.isArray(config?.faixas) ? config.faixas : CRITICALITY_V2_DEFAULTS.faixas;
  const found = bands.find((item) => score >= item.min && score <= item.max);
  return found || { codigo: 'C1', classe: 'Baixo' };
}

function normalizeFeicaoTipo(input) {
  const direct = normalizeTextLower(input?.feicao?.tipo || input?.tipo || input?.tipo_erosao || input?.tipoErosao);
  if (direct) {
    if (direct === 'voçoroca') return 'vocoroca';
    return direct;
  }

  const fromListRaw = Array.isArray(input?.tiposFeicao)
    ? input.tiposFeicao
    : (Array.isArray(input?.feicao?.tiposFeicao) ? input.feicao.tiposFeicao : []);

  const fromList = fromListRaw
    .map((item) => normalizeTextLower(item).replace('voçoroca', 'vocoroca'))
    .filter(Boolean);

  if (fromList.includes('vocoroca')) return 'vocoroca';
  if (fromList.includes('ravina')) return 'ravina';
  if (fromList.includes('sulco')) return 'sulco';
  if (fromList.includes('laminar')) return 'laminar';
  if (fromList.includes('movimento_massa') || fromList.includes('deslizamento') || fromList.includes('escorregamento') || fromList.includes('fluxo_lama')) {
    return 'movimento_massa';
  }

  return '';
}

function normalizeSolo(input) {
  const value = normalizeTextLower(input?.contexto_fisico?.tipo_solo || input?.tipo_solo || input?.tipoSolo || input?.tipoSoloClasse);
  if (!value) return '';
  if (value === 'solo_raso') return 'solos_rasos';
  return value;
}

function normalizeLocation(input) {
  const locationRaw = normalizeTextLower(
    input?.localContexto?.exposicao
    || input?.exposicao?.localizacao
    || input?.localizacao
    || input?.localizacao_exposicao,
  );
  if (!locationRaw) return '';
  if (locationRaw.includes('faixa')) return 'faixa_servidao';
  if (locationRaw.includes('terceiro')) return 'area_terceiros';
  return locationRaw;
}

function normalizeLocalTipo(input) {
  return normalizeTextLower(input?.localContexto?.localTipo || input?.localTipo || input?.local_tipo || input?.local || '');
}

function normalizeStructure(input) {
  return normalizeTextLower(
    input?.localContexto?.estruturaProxima
    || input?.exposicao?.estrutura_proxima
    || input?.estrutura_proxima
    || input?.estruturaProxima,
  );
}

function normalizeAguaFundo(input) {
  const raw = normalizeTextLower(input?.contexto_fisico?.agua_fundo || input?.agua_fundo || input?.presencaAguaFundo);
  if (!raw) return '';
  if (raw === 'não' || raw === 'nao') return 'nao';
  if (raw === 'não_verificado') return 'nao_verificado';
  return raw;
}

function buildNormalizedInput(vistoriaData = {}) {
  const locationCoordinates = normalizeLocationCoordinates(vistoriaData || {});

  return {
    tipo_erosao: normalizeFeicaoTipo(vistoriaData),
    profundidade_m: parseNumeric(vistoriaData?.feicao?.profundidade_m ?? vistoriaData?.profundidade_m ?? vistoriaData?.profundidadeMetros ?? vistoriaData?.profundidadeM),
    declividade_graus: parseNumeric(vistoriaData?.contexto_fisico?.declividade_graus ?? vistoriaData?.declividade_graus ?? vistoriaData?.declividadeGraus),
    distancia_estrutura_m: parseNumeric(vistoriaData?.exposicao?.distancia_estrutura_m ?? vistoriaData?.distancia_estrutura_m ?? vistoriaData?.distanciaEstruturaMetros),
    tipo_solo: normalizeSolo(vistoriaData),
    estrutura_proxima: normalizeStructure(vistoriaData),
    localizacao_exposicao: normalizeLocation(vistoriaData),
    local_tipo: normalizeLocalTipo(vistoriaData),
    sinais_avanco: booleanFromUnknown(vistoriaData?.contexto_fisico?.sinais_avanco ?? vistoriaData?.sinais_avanco),
    vegetacao_interior: booleanFromUnknown(vistoriaData?.contexto_fisico?.vegetacao_interior ?? vistoriaData?.vegetacao_interior),
    agua_fundo: normalizeAguaFundo(vistoriaData),
    latitude: parseNumeric(locationCoordinates.latitude),
    longitude: parseNumeric(locationCoordinates.longitude),
  };
}

function buildValidationAlerts(normalized, classification) {
  const alerts = [];

  if (normalized.tipo_erosao === 'laminar' && Number.isFinite(normalized.profundidade_m) && normalized.profundidade_m > 0.5) {
    alerts.push('Inconsistência: tipo laminar com profundidade acima de 0.50m.');
  }

  if (normalized.tipo_erosao === 'vocoroca' && Number.isFinite(normalized.profundidade_m) && normalized.profundidade_m < 1) {
    alerts.push('Possível erro de medição: voçoroca com profundidade abaixo de 1.00m.');
  }

  if (Number.isFinite(normalized.distancia_estrutura_m)
    && normalized.distancia_estrutura_m < 5
    && ['C1', 'C2'].includes(classification.codigo)) {
    alerts.push('Revisar exposição: distância menor que 5m com criticidade abaixo de C3.');
  }

  if (normalized.sinais_avanco && normalized.vegetacao_interior) {
    alerts.push('Há sinais de avanço e vegetação interior; verificar possível estabilização parcial.');
  }

  return alerts;
}

function mapLegacyImpact(codigo) {
  if (codigo === 'C4') return 'Muito Alto';
  if (codigo === 'C3') return 'Alto';
  if (codigo === 'C2') return 'Médio';
  return 'Baixo';
}

function mapLegacyFrequency(codigo) {
  if (codigo === 'C4') return '3 meses';
  if (codigo === 'C3') return '6 meses';
  if (codigo === 'C2') return '12 meses';
  return '24 meses';
}

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

function resolveTypeScore(tipo) {
  const key = normalizeTextLower(tipo).replace('voçoroca', 'vocoroca');
  if (!key) return { classe: 'T1', pontos: 0, inferred: true };
  const out = TYPE_POINTS[key];
  if (!out) return { classe: 'T1', pontos: 0, inferred: true };
  return { ...out, inferred: false };
}

function resolveSoilScore(tipoSolo) {
  const key = normalizeTextLower(tipoSolo);
  if (!key) return { classe: 'S1', pontos: 0, inferred: true };
  const out = SOIL_POINTS[key];
  if (!out) return { classe: 'S1', pontos: 0, inferred: true };
  return { ...out, inferred: false };
}

function getSolutionsForCode(config, codigo) {
  const source = config?.solucoes_por_criticidade?.[codigo] || CRITICALITY_V2_DEFAULTS.solucoes_por_criticidade[codigo] || {
    tipo_medida: 'preventiva',
    solucoes: [],
  };
  const lista = Array.isArray(source.solucoes) ? source.solucoes.map((item) => toAscii(item)).filter(Boolean) : [];
  return {
    tipo_medida_recomendada: toAscii(source.tipo_medida || ''),
    lista_solucoes_sugeridas: lista,
  };
}

function applySolutionContextFilters(baseSolutions, normalized) {
  const list = Array.isArray(baseSolutions?.lista_solucoes_sugeridas)
    ? baseSolutions.lista_solucoes_sugeridas
    : [];
  const estrutura = normalizeTextLower(normalized?.estrutura_proxima);
  const localTipo = normalizeTextLower(normalized?.local_tipo);
  const distancia = Number.isFinite(normalized?.distancia_estrutura_m) ? normalized.distancia_estrutura_m : null;
  const isAccessContext = estrutura === 'acesso' || localTipo.includes('acesso');
  const isFarFromTower = Number.isFinite(distancia) ? distancia >= 20 : false;
  const isTowerContext = ['torre', 'fundacao'].includes(estrutura) || localTipo.includes('torre');
  const shouldHideTowerProtection = isAccessContext && isFarFromTower && !isTowerContext;

  if (!shouldHideTowerProtection) {
    return {
      ...baseSolutions,
      recomendacao_contextual_filtros: '',
    };
  }

  const filtered = list.filter((item) => {
    const text = normalizeTextLower(toAscii(item));
    if (text.includes('base de torres')) return false;
    if (text.includes('base de torre')) return false;
    if (text.includes('anel drenante')) return false;
    return true;
  });

  return {
    ...baseSolutions,
    lista_solucoes_sugeridas: filtered.length > 0 ? filtered : list,
    recomendacao_contextual_filtros: 'Solucoes especificas para protecao de torre removidas por contexto de acesso distante.',
  };
}

function joinContextMessages(...messages) {
  const clean = messages
    .map((item) => toAscii(item || ''))
    .filter(Boolean);
  return clean.join(' ');
}

function applyRecommendationPolicy({
  normalized,
  declividadeClasse,
  criticidadeCodigo,
  config,
  baseSolutions,
}) {
  const filteredBaseSolutions = applySolutionContextFilters(baseSolutions, normalized);
  if (!['C1', 'C2'].includes(criticidadeCodigo)) {
    return {
      ...filteredBaseSolutions,
      lista_solucoes_possiveis_intervencao: [],
      recomendacao_contextual: filteredBaseSolutions.recomendacao_contextual_filtros || '',
    };
  }

  const outsideServidao = normalized.localizacao_exposicao === 'area_terceiros';
  const lowOrMediumSlope = ['D1', 'D2'].includes(declividadeClasse);
  const shouldCapAtMonitoring = outsideServidao || lowOrMediumSlope;
  if (!shouldCapAtMonitoring) {
    return {
      ...filteredBaseSolutions,
      lista_solucoes_possiveis_intervencao: [],
      recomendacao_contextual: filteredBaseSolutions.recomendacao_contextual_filtros || '',
    };
  }

  const monitoring = getSolutionsForCode(config, 'C1');
  const suggestions = Array.isArray(monitoring.lista_solucoes_sugeridas) && monitoring.lista_solucoes_sugeridas.length > 0
    ? monitoring.lista_solucoes_sugeridas
    : ['Monitoramento visual periodico'];
  const optionalInterventions = (filteredBaseSolutions.lista_solucoes_sugeridas || [])
    .filter((item) => !suggestions.includes(item));

  return {
    tipo_medida_recomendada: 'monitoramento',
    lista_solucoes_sugeridas: suggestions,
    lista_solucoes_possiveis_intervencao: optionalInterventions,
    recomendacao_contextual: joinContextMessages(
      'Monitoramento recomendado por contexto de exposicao/declividade. Intervencoes permanecem como opcoes.',
      filteredBaseSolutions.recomendacao_contextual_filtros,
    ),
  };
}

function buildLegacyCompatPayload(score, classification, solutions) {
  return {
    impacto: mapLegacyImpact(classification.codigo),
    score,
    frequencia: mapLegacyFrequency(classification.codigo),
    intervencao: solutions.lista_solucoes_sugeridas[0] || 'Monitoramento visual',
  };
}

export function calcular_criticidade(vistoriaData = {}, config = CRITICALITY_V2_DEFAULTS) {
  const mergedConfig = mergeCriticalityV2Config(config);
  const normalized = buildNormalizedInput(vistoriaData);

  const tipo = resolveTypeScore(normalized.tipo_erosao);
  const profundidade = resolveRange(DEPTH_POINTS, normalized.profundidade_m, 'P1');
  const declividade = resolveRange(SLOPE_POINTS, normalized.declividade_graus, 'D1');
  const solo = resolveSoilScore(normalized.tipo_solo);
  const exposicao = resolveRange(DISTANCE_POINTS, normalized.distancia_estrutura_m, 'E1');

  const criticidade_score = tipo.pontos + profundidade.pontos + declividade.pontos + solo.pontos + exposicao.pontos;
  const classification = resolveCriticalityBand(criticidade_score, mergedConfig);
  const baseSolutions = getSolutionsForCode(mergedConfig, classification.codigo);
  const solutions = applyRecommendationPolicy({
    normalized,
    declividadeClasse: declividade.classe,
    criticidadeCodigo: classification.codigo,
    config: mergedConfig,
    baseSolutions,
  });
  const alertas = buildValidationAlerts(normalized, classification);
  const compat = buildLegacyCompatPayload(criticidade_score, classification, solutions);

  return {
    profundidade_classe: profundidade.classe,
    tipo_erosao_classe: tipo.classe,
    declividade_classe: declividade.classe,
    solo_classe: solo.classe,
    exposicao_classe: exposicao.classe,
    pontos: {
      T: tipo.pontos,
      P: profundidade.pontos,
      D: declividade.pontos,
      S: solo.pontos,
      E: exposicao.pontos,
    },
    criticidade_score,
    criticidade_classe: classification.classe,
    codigo: classification.codigo,
    tipo_medida_recomendada: solutions.tipo_medida_recomendada,
    lista_solucoes_sugeridas: solutions.lista_solucoes_sugeridas,
    lista_solucoes_possiveis_intervencao: solutions.lista_solucoes_possiveis_intervencao,
    recomendacao_contextual: solutions.recomendacao_contextual,
    alertas_validacao: alertas,
    campos_normalizados: normalized,
    legacy: compat,
  };
}

export function calcularCriticidade(vistoriaData = {}, config = CRITICALITY_V2_DEFAULTS) {
  return calcular_criticidade(vistoriaData, config);
}

export function calculateCriticality(vistoriaData = {}, config = CRITICALITY_V2_DEFAULTS) {
  const result = calcular_criticidade(vistoriaData, config);
  return {
    ...result.legacy,
    codigo: result.codigo,
    criticidade_classe: result.criticidade_classe,
    tipo_medida_recomendada: result.tipo_medida_recomendada,
    lista_solucoes_sugeridas: result.lista_solucoes_sugeridas,
    alertas_validacao: result.alertas_validacao,
    breakdown: result,
  };
}

export function inferCriticalityInputFromLegacyErosion(erosion = {}) {
  const tipo = normalizeTextLower(erosion.tipo || erosion.tipo_erosao);

  const fromDepthClass = normalizeTextLower(erosion.profundidade || erosion.profundidadeClasse || '');
  let profundidade = parseNumeric(erosion.profundidade_m || erosion.profundidadeMetros);
  let estimado = false;
  if (!Number.isFinite(profundidade)) {
    if (fromDepthClass === '<0.5') {
      profundidade = 0.3;
      estimado = true;
    } else if (fromDepthClass === '0.5-1.5') {
      profundidade = 1.0;
      estimado = true;
    } else if (fromDepthClass === '1.5-3.0') {
      profundidade = 2.2;
      estimado = true;
    } else if (fromDepthClass === '>3.0') {
      profundidade = 3.5;
      estimado = true;
    }
  }

  const slopeClass = normalizeTextLower(erosion.declividadeClasse || erosion.declividadeClassePdf || erosion.declividade || '');
  let declividade = parseNumeric(erosion.declividade_graus || erosion.declividadeGraus);
  if (!Number.isFinite(declividade)) {
    if (slopeClass === '<15') {
      declividade = 8;
      estimado = true;
    } else if (slopeClass === '15-30') {
      declividade = 20;
      estimado = true;
    } else if (slopeClass === '30-45' || slopeClass === '>45' || slopeClass === 'maior_25') {
      declividade = 32;
      estimado = true;
    }
  }

  let distancia = parseNumeric(erosion.distancia_estrutura_m || erosion.distanciaEstruturaMetros);
  if (!Number.isFinite(distancia)) {
    const faixa = normalizeTextLower(erosion.faixaServidao);
    if (faixa === 'sim') {
      distancia = 4;
      estimado = true;
    } else {
      distancia = 30;
      estimado = true;
    }
  }

  let solo = normalizeTextLower(erosion.tipo_solo || erosion.tipoSolo || erosion.tipoSoloClasse);
  if (!solo) {
    if (Array.isArray(erosion.usosSolo) && erosion.usosSolo.includes('acesso')) {
      solo = 'solos_rasos';
      estimado = true;
    } else {
      solo = 'argiloso';
      estimado = true;
    }
  }

  return {
    input: {
      tipo_erosao: tipo,
      profundidade_m: profundidade,
      declividade_graus: declividade,
      distancia_estrutura_m: distancia,
      tipo_solo: solo,
      sinais_avanco: Boolean(erosion.sinais_avanco),
      vegetacao_interior: Boolean(erosion.vegetacao_interior),
      presencaAguaFundo: erosion.presencaAguaFundo,
      locationCoordinates: erosion.locationCoordinates,
      latitude: erosion.latitude,
      longitude: erosion.longitude,
    },
    estimado,
  };
}

export function buildCriticalityTrend(previousScore, currentScore) {
  if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) return 'estavel';
  if (currentScore > previousScore) return 'agravando';
  if (currentScore < previousScore) return 'recuperando';
  return 'estavel';
}

export function normalizeCriticalityHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object').slice(-200);
}

