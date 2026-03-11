import { normalizeErosionStatus } from '../../src/features/shared/statusUtils';
import { normalizeLocationCoordinates } from '../../src/features/shared/erosionCoordinates';

export const LOCAL_CONTEXTO_TIPO_OPTIONS = [
  { value: 'faixa_servidao', label: 'Na faixa de servidao' },
  { value: 'via_acesso_exclusiva', label: 'Na via de acesso exclusiva' },
  { value: 'fora_faixa_servidao', label: 'Fora da faixa de servidao' },
  { value: 'base_torre', label: 'Base de torre' },
  { value: 'outros', label: 'Outros' },
];

export const EROSION_LOCATION_OPTIONS = LOCAL_CONTEXTO_TIPO_OPTIONS.map((item) => item.label);

const LOCAL_CONTEXTO_LABEL_BY_TIPO = LOCAL_CONTEXTO_TIPO_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const EROSION_LOCATION_ALIASES = {
  'na faixa de servidao': 'faixa_servidao',
  'na faixa de servidão': 'faixa_servidao',
  faixa_servidao: 'faixa_servidao',
  'na via de acesso exclusiva': 'via_acesso_exclusiva',
  via_acesso_exclusiva: 'via_acesso_exclusiva',
  'fora da faixa de servidao': 'fora_faixa_servidao',
  'fora da faixa de servidão': 'fora_faixa_servidao',
  fora_faixa_servidao: 'fora_faixa_servidao',
  'base de torre': 'base_torre',
  base_torre: 'base_torre',
  outros: 'outros',
};

export const LOCAL_CONTEXTO_DEFAULT = {
  localTipo: '',
  exposicao: '',
  estruturaProxima: '',
  localDescricao: '',
};

export const EROSION_TECHNICAL_ENUMS = {
  presencaAguaFundo: ['sim', 'nao', 'nao_verificado'],
  tiposFeicao: ['laminar', 'sulco', 'movimento_massa', 'escorregamento', 'ravina', 'vocoroca', 'deslizamento', 'fluxo_lama'],
  caracteristicasFeicao: ['contato_materiais', 'alteracao_morfologia'],
  usosSolo: ['pastagem', 'cultivo', 'campo', 'veg_arborea', 'curso_agua', 'cerca', 'acesso', 'tubulacao', 'outro'],
  saturacaoPorAgua: ['sim', 'nao'],
  tipoSolo: ['lateritico', 'argiloso', 'solos_rasos', 'arenoso'],
  localizacaoExposicao: ['faixa_servidao', 'area_terceiros'],
  estruturaProxima: ['torre', 'fundacao', 'acesso', 'app', 'curso_agua', 'nenhuma'],
};

export const EROSION_TECHNICAL_OPTIONS = {
  presencaAguaFundo: [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Nao' },
    { value: 'nao_verificado', label: 'Nao verificado' },
  ],
  tiposFeicao: [
    { value: 'laminar', label: 'Laminar' },
    { value: 'sulco', label: 'Sulco' },
    { value: 'movimento_massa', label: 'Movimento de massa' },
    { value: 'escorregamento', label: 'Escorregamento' },
    { value: 'ravina', label: 'Ravina' },
    { value: 'vocoroca', label: 'Vocoroca' },
    { value: 'deslizamento', label: 'Deslizamento' },
    { value: 'fluxo_lama', label: 'Fluxo de lama' },
  ],
  caracteristicasFeicao: [
    { value: 'contato_materiais', label: 'Contato entre materiais' },
    { value: 'alteracao_morfologia', label: 'Alteracao de morfologia' },
  ],
  usosSolo: [
    { value: 'pastagem', label: 'Pastagem' },
    { value: 'cultivo', label: 'Cultivo' },
    { value: 'campo', label: 'Campo' },
    { value: 'veg_arborea', label: 'Vegetacao arborea' },
    { value: 'curso_agua', label: 'Curso de agua' },
    { value: 'cerca', label: 'Cerca' },
    { value: 'acesso', label: 'Acesso' },
    { value: 'tubulacao', label: 'Tubulacao' },
    { value: 'outro', label: 'Outro' },
  ],
  saturacaoPorAgua: [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Nao' },
  ],
  tipoSolo: [
    { value: 'lateritico', label: 'Lateritico' },
    { value: 'argiloso', label: 'Argiloso' },
    { value: 'solos_rasos', label: 'Solos rasos' },
    { value: 'arenoso', label: 'Arenoso' },
  ],
  localizacaoExposicao: [
    { value: 'faixa_servidao', label: 'Faixa de servidao' },
    { value: 'area_terceiros', label: 'Area de terceiros' },
  ],
  estruturaProxima: [
    { value: 'torre', label: 'Torre' },
    { value: 'fundacao', label: 'Fundacao' },
    { value: 'acesso', label: 'Acesso' },
    { value: 'app', label: 'APP' },
    { value: 'curso_agua', label: 'Curso de agua' },
    { value: 'nenhuma', label: 'Nenhuma' },
  ],
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ['sim', 'true', '1', 'yes', 'y'].includes(normalized);
}

function parseDecimal(value) {
  const normalized = normalizeText(value).replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export const EROSION_REMOVED_FIELDS = [
  'profundidade',
  'declividadeClasse',
  'declividadeClassePdf',
  'faixaServidao',
  'areaTerceiros',
  'usoSolo',
  'soloSaturadoAgua',
];

function normalizeLocationValue(value) {
  const key = normalizeText(value).toLowerCase();
  if (!key) return '';
  return EROSION_LOCATION_ALIASES[key] || '';
}

export function getLocalContextLabel(localTipo) {
  const normalized = normalizeLocationValue(localTipo);
  return LOCAL_CONTEXTO_LABEL_BY_TIPO[normalized] || '';
}

function normalizeEnumValue(value, allowedValues = []) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  return allowedValues.includes(normalized) ? normalized : '';
}

export function normalizeEnumArray(values, allowedValues = []) {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((item) => normalizeEnumValue(item, allowedValues))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function inferLegacyExposicao(source = {}, localTipo) {
  const explicit = normalizeEnumValue(
    source.localizacaoExposicao || source.localizacao_exposicao,
    EROSION_TECHNICAL_ENUMS.localizacaoExposicao,
  );
  if (explicit) return explicit;

  const oldFaixaServidao = normalizeText(source.faixaServidao).toLowerCase();
  if (oldFaixaServidao === 'sim') return 'faixa_servidao';
  if (oldFaixaServidao === 'nao') return 'area_terceiros';

  if (localTipo === 'fora_faixa_servidao') return 'area_terceiros';
  if (localTipo) return 'faixa_servidao';
  return '';
}

function inferLegacyEstrutura(source = {}, localTipo) {
  const explicit = normalizeEnumValue(
    source.estruturaProxima || source.estrutura_proxima,
    EROSION_TECHNICAL_ENUMS.estruturaProxima,
  );
  if (explicit) return explicit;

  if (localTipo === 'via_acesso_exclusiva') return 'acesso';
  if (localTipo === 'base_torre') return 'torre';
  if (localTipo === 'fora_faixa_servidao') return 'nenhuma';
  return '';
}

function applyLocalContextRules(localContexto) {
  const base = {
    ...LOCAL_CONTEXTO_DEFAULT,
    ...(localContexto && typeof localContexto === 'object' ? localContexto : {}),
  };
  const localTipo = normalizeLocationValue(base.localTipo);
  const localDescricao = normalizeText(base.localDescricao);
  const exposicao = normalizeEnumValue(base.exposicao, EROSION_TECHNICAL_ENUMS.localizacaoExposicao);
  const estruturaProxima = normalizeEnumValue(base.estruturaProxima, EROSION_TECHNICAL_ENUMS.estruturaProxima);

  if (!localTipo) {
    return {
      localTipo: '',
      exposicao: '',
      estruturaProxima: '',
      localDescricao,
    };
  }

  if (localTipo === 'faixa_servidao') {
    return {
      localTipo,
      exposicao: 'faixa_servidao',
      estruturaProxima,
      localDescricao: '',
    };
  }

  if (localTipo === 'via_acesso_exclusiva') {
    return {
      localTipo,
      exposicao: 'faixa_servidao',
      estruturaProxima: 'acesso',
      localDescricao: '',
    };
  }

  if (localTipo === 'fora_faixa_servidao') {
    return {
      localTipo,
      exposicao: 'area_terceiros',
      estruturaProxima: estruturaProxima || 'nenhuma',
      localDescricao: '',
    };
  }

  if (localTipo === 'base_torre') {
    return {
      localTipo,
      exposicao: 'faixa_servidao',
      estruturaProxima: 'torre',
      localDescricao: '',
    };
  }

  return {
    localTipo,
    exposicao,
    estruturaProxima,
    localDescricao,
  };
}

export function normalizeLocalContexto(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const incoming = source.localContexto && typeof source.localContexto === 'object'
    ? source.localContexto
    : {};

  const localTipo = normalizeLocationValue(incoming.localTipo || source.localTipo);
  const localDescricao = normalizeText(incoming.localDescricao || source.localDescricao);
  const exposicao = normalizeEnumValue(
    incoming.exposicao || inferLegacyExposicao(source, localTipo),
    EROSION_TECHNICAL_ENUMS.localizacaoExposicao,
  );
  const estruturaProxima = normalizeEnumValue(
    incoming.estruturaProxima || inferLegacyEstrutura(source, localTipo),
    EROSION_TECHNICAL_ENUMS.estruturaProxima,
  );

  return applyLocalContextRules({
    localTipo,
    exposicao,
    estruturaProxima,
    localDescricao,
  });
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return normalizeText(value) !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function isHistoricalErosionRecord(data = {}) {
  const raw = data && typeof data === 'object' ? data : {};
  if (normalizeErosionStatus(raw.status) === 'Estabilizado') return true;
  if (raw.registroHistorico === true) return true;
  const normalized = normalizeText(raw.registroHistorico || raw.registro_historico).toLowerCase();
  return ['sim', 'true', '1', 'historico', 'histórico'].includes(normalized);
}

export function stripRemovedErosionFields(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const next = { ...source };
  EROSION_REMOVED_FIELDS.forEach((field) => {
    delete next[field];
  });
  return next;
}

export function normalizeErosionTechnicalFields(data = {}) {
  const source = stripRemovedErosionFields(data && typeof data === 'object' ? data : {});
  const localContexto = normalizeLocalContexto(source);

  return {
    presencaAguaFundo: normalizeEnumValue(source.presencaAguaFundo, EROSION_TECHNICAL_ENUMS.presencaAguaFundo),
    tiposFeicao: normalizeEnumArray(source.tiposFeicao, EROSION_TECHNICAL_ENUMS.tiposFeicao),
    caracteristicasFeicao: normalizeEnumArray(source.caracteristicasFeicao, EROSION_TECHNICAL_ENUMS.caracteristicasFeicao),
    usosSolo: normalizeEnumArray(source.usosSolo, EROSION_TECHNICAL_ENUMS.usosSolo),
    usoSoloOutro: normalizeText(source.usoSoloOutro),
    saturacaoPorAgua: normalizeEnumValue(source.saturacaoPorAgua, EROSION_TECHNICAL_ENUMS.saturacaoPorAgua),
    tipoSolo: normalizeEnumValue(source.tipoSolo, EROSION_TECHNICAL_ENUMS.tipoSolo),
    localContexto,
    localizacaoExposicao: localContexto.exposicao,
    estruturaProxima: localContexto.estruturaProxima,
    profundidadeMetros: parseDecimal(source.profundidadeMetros),
    declividadeGraus: parseDecimal(source.declividadeGraus),
    distanciaEstruturaMetros: parseDecimal(source.distanciaEstruturaMetros),
    sinaisAvanco: normalizeBoolean(source.sinaisAvanco),
    vegetacaoInterior: normalizeBoolean(source.vegetacaoInterior),
  };
}

export function deriveErosionTypeFromTechnicalFields(data = {}) {
  const explicit = normalizeText(data?.tipo).toLowerCase();
  if (explicit) return explicit;

  const technicalTypes = Array.isArray(data?.tiposFeicao)
    ? data.tiposFeicao.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
    : [];
  if (technicalTypes.length === 0) return '';

  const directMap = ['sulco', 'ravina', 'vocoroca', 'deslizamento'];
  const direct = technicalTypes.find((item) => directMap.includes(item));
  if (direct) return direct;

  if (technicalTypes.includes('escorregamento') || technicalTypes.includes('movimento_massa') || technicalTypes.includes('fluxo_lama')) {
    return 'deslizamento';
  }

  if (technicalTypes.includes('laminar')) return 'sulco';

  return '';
}

function mapDepthClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 1) return 'P1';
  if (value <= 10) return 'P2';
  if (value <= 30) return 'P3';
  return 'P4';
}

function mapSlopeClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 10) return 'D1';
  if (value <= 25) return 'D2';
  return 'D3';
}

function mapExposureClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value > 50) return 'E1';
  if (value >= 20) return 'E2';
  if (value >= 5) return 'E3';
  return 'E4';
}

export function deriveCriticalityDimensionClasses(data = {}) {
  const technical = normalizeErosionTechnicalFields(data);
  return {
    profundidadeClasse: mapDepthClass(technical.profundidadeMetros),
    declividadeClasse: mapSlopeClass(technical.declividadeGraus),
    exposicaoClasse: mapExposureClass(technical.distanciaEstruturaMetros),
  };
}

export function buildCriticalityInputFromErosion(data = {}) {
  const technical = normalizeErosionTechnicalFields(data);
  const derivedType = deriveErosionTypeFromTechnicalFields({ ...data, tiposFeicao: technical.tiposFeicao });
  const tipoErosao = derivedType === 'deslizamento' ? 'movimento_massa' : derivedType;
  const localContexto = technical.localContexto || LOCAL_CONTEXTO_DEFAULT;

  return {
    ...data,
    tipo: derivedType,
    tipo_erosao: tipoErosao,
    profundidade_m: technical.profundidadeMetros,
    declividade_graus: technical.declividadeGraus,
    distancia_estrutura_m: technical.distanciaEstruturaMetros,
    tipo_solo: technical.tipoSolo,
    estrutura_proxima: localContexto.estruturaProxima,
    localizacao_exposicao: localContexto.exposicao,
    localContexto,
    sinais_avanco: technical.sinaisAvanco,
    vegetacao_interior: technical.vegetacaoInterior,
  };
}

export function normalizeFollowupHistory(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateErosionLocation(data) {
  const localContexto = normalizeLocalContexto(data || {});
  const localTipo = localContexto.localTipo;
  const localDescricao = localContexto.localDescricao;
  const exposicao = localContexto.exposicao;
  const estruturaProxima = localContexto.estruturaProxima;

  if (!localTipo || !LOCAL_CONTEXTO_LABEL_BY_TIPO[localTipo]) {
    return { ok: false, message: 'Selecione o local da erosao.' };
  }

  if (localTipo === 'faixa_servidao' && !estruturaProxima) {
    return { ok: false, message: 'Selecione a estrutura proxima para local na faixa de servidao.' };
  }

  if (localTipo === 'via_acesso_exclusiva' && estruturaProxima !== 'acesso') {
    return { ok: false, message: 'Via de acesso exclusiva deve usar estrutura proxima igual a acesso.' };
  }

  if (localTipo === 'base_torre' && estruturaProxima !== 'torre') {
    return { ok: false, message: 'Base de torre deve usar estrutura proxima igual a torre.' };
  }

  if (localTipo === 'outros') {
    if (!localDescricao) {
      return { ok: false, message: 'Informe a descricao do local quando selecionar "Outros".' };
    }
    if (!exposicao) {
      return { ok: false, message: 'Selecione a exposicao para local "Outros".' };
    }
    if (!estruturaProxima) {
      return { ok: false, message: 'Selecione a estrutura proxima para local "Outros".' };
    }
  }

  if (!estruturaProxima) {
    return { ok: false, message: 'Estrutura proxima e obrigatoria.' };
  }

  return { ok: true, message: '' };
}

export function validateErosionTechnicalFields(data = {}) {
  const raw = data && typeof data === 'object' ? data : {};
  const removed = EROSION_REMOVED_FIELDS.filter((field) => hasValue(raw[field]));
  if (removed.length > 0) {
    return {
      ok: false,
      message: `Campos legados removidos no schema canônico: ${removed.join(', ')}.`,
      value: normalizeErosionTechnicalFields(raw),
    };
  }

  const normalized = normalizeErosionTechnicalFields(raw);
  const locationValidation = validateErosionLocation({
    ...raw,
    localContexto: normalized.localContexto,
  });
  if (!locationValidation.ok) {
    return {
      ok: false,
      message: locationValidation.message,
      value: normalized,
    };
  }

  const singleRules = [
    ['presencaAguaFundo', EROSION_TECHNICAL_ENUMS.presencaAguaFundo, 'Presenca de agua no fundo'],
    ['saturacaoPorAgua', EROSION_TECHNICAL_ENUMS.saturacaoPorAgua, 'Saturacao por agua'],
    ['tipoSolo', EROSION_TECHNICAL_ENUMS.tipoSolo, 'Tipo de solo'],
    ['localizacaoExposicao', EROSION_TECHNICAL_ENUMS.localizacaoExposicao, 'Localizacao de exposicao'],
    ['estruturaProxima', EROSION_TECHNICAL_ENUMS.estruturaProxima, 'Estrutura proxima'],
  ];

  for (let i = 0; i < singleRules.length; i += 1) {
    const [field, allowed, label] = singleRules[i];
    const sourceValue = normalizeText(raw[field]);
    if (!sourceValue) continue;
    if (!allowed.includes(String(normalized[field] || '').toLowerCase())) {
      return {
        ok: false,
        message: `${label} invalido(a).`,
        value: normalized,
      };
    }
  }

  const multiRules = [
    ['tiposFeicao', EROSION_TECHNICAL_ENUMS.tiposFeicao, 'Tipos de feicao'],
    ['caracteristicasFeicao', EROSION_TECHNICAL_ENUMS.caracteristicasFeicao, 'Caracteristicas da feicao'],
    ['usosSolo', EROSION_TECHNICAL_ENUMS.usosSolo, 'Usos do solo'],
  ];

  for (let i = 0; i < multiRules.length; i += 1) {
    const [field, allowed, label] = multiRules[i];
    if (!Array.isArray(raw[field])) continue;
    const invalid = raw[field]
      .map((item) => normalizeText(item).toLowerCase())
      .find((item) => item && !allowed.includes(item));
    if (invalid) {
      return {
        ok: false,
        message: `${label}: valor invalido (${invalid}).`,
        value: normalized,
      };
    }
  }

  if (normalized.usosSolo.includes('outro') && !normalized.usoSoloOutro) {
    return {
      ok: false,
      message: 'Preencha o campo "Uso do solo - outro" quando selecionar "Outro".',
      value: normalized,
    };
  }

  const numericRules = [
    ['profundidadeMetros', 'Profundidade (m)'],
    ['declividadeGraus', 'Declividade (graus)'],
    ['distanciaEstruturaMetros', 'Distancia da estrutura (m)'],
  ];

  for (let i = 0; i < numericRules.length; i += 1) {
    const [field, label] = numericRules[i];
    const sourceValue = raw[field];
    if (sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === '') continue;
    if (!Number.isFinite(normalized[field])) {
      return {
        ok: false,
        message: `${label} invalido(a).`,
        value: normalized,
      };
    }
  }

  return { ok: true, message: '', value: normalized };
}

function summarizeEvent(change, previous) {
  if (change.origem === 'cadastro' && change.registroHistoricoNovo) {
    return change.intervencaoRealizadaNova
      ? `Cadastro historico da erosao. Intervencao ja realizada: ${change.intervencaoRealizadaNova}`
      : 'Cadastro historico da erosao com intervencao ja realizada.';
  }
  if (change.origem === 'cadastro') return 'Cadastro inicial da erosao.';
  if (change.origem === 'vistoria' && change.registroHistoricoNovo) {
    return change.intervencaoRealizadaNova
      ? `Erosao historica registrada durante vistoria. Intervencao ja realizada: ${change.intervencaoRealizadaNova}`
      : 'Erosao historica registrada durante vistoria.';
  }
  if (change.origem === 'vistoria') return 'Erosao registrada durante vistoria.';

  const pieces = [];
  if (change.registroHistoricoAnterior !== change.registroHistoricoNovo) {
    pieces.push(change.registroHistoricoNovo
      ? 'registro marcado como historico de acompanhamento'
      : 'registro voltou ao modo tecnico');
  }
  if (change.statusAnterior !== change.statusNovo) {
    pieces.push(`status alterado de ${change.statusAnterior} para ${change.statusNovo}`);
  }
  if (String(change.torreAnterior || '') !== String(change.torreNova || '')) {
    pieces.push(`torre alterada de ${change.torreAnterior || '-'} para ${change.torreNova || '-'}`);
  }
  if (String(change.localTipoAnterior || '') !== String(change.localTipoNovo || '')) {
    pieces.push(`local alterado de ${change.localTipoAnterior || '-'} para ${change.localTipoNovo || '-'}`);
  }
  if (String(change.obsAnterior || '') !== String(change.obsNovo || '')) {
    pieces.push('observacoes atualizadas');
  }
  if (change.registroHistoricoNovo
    && String(change.intervencaoRealizadaAnterior || '') !== String(change.intervencaoRealizadaNova || '')) {
    pieces.push('intervencao historica atualizada');
  }

  if (pieces.length === 0) {
    return previous ? 'Edicao sem mudancas relevantes para acompanhamento.' : 'Cadastro da erosao.';
  }

  return pieces.join(' | ');
}

export function buildFollowupEvent(previous, next, meta = {}) {
  const now = new Date().toISOString();
  const previousStatus = normalizeErosionStatus(previous?.status);
  const nextStatus = normalizeErosionStatus(next?.status);
  const origem = meta.origem || (meta.isCreate ? 'cadastro' : 'edicao');

  const previousLocalContexto = normalizeLocalContexto(previous || {});
  const nextLocalContexto = normalizeLocalContexto(next || {});
  const previousLocalTipoLabel = getLocalContextLabel(previousLocalContexto.localTipo) || normalizeText(previous?.localTipo);
  const nextLocalTipoLabel = getLocalContextLabel(nextLocalContexto.localTipo) || normalizeText(next?.localTipo);

  const event = {
    timestamp: now,
    usuario: meta.updatedBy || '',
    origem,
    vistoriaId: normalizeText(next?.vistoriaId) || undefined,
    statusAnterior: previous ? previousStatus : undefined,
    statusNovo: nextStatus,
    resumo: '',
    torreAnterior: previous?.torreRef,
    torreNova: next?.torreRef,
    localTipoAnterior: previousLocalTipoLabel,
    localTipoNovo: nextLocalTipoLabel,
    registroHistoricoAnterior: isHistoricalErosionRecord(previous),
    registroHistoricoNovo: isHistoricalErosionRecord(next),
    intervencaoRealizadaAnterior: normalizeText(previous?.intervencaoRealizada),
    intervencaoRealizadaNova: normalizeText(next?.intervencaoRealizada),
    obsAnterior: previous?.obs,
    obsNovo: next?.obs,
  };

  event.resumo = summarizeEvent(event, previous);

  const hasRelevantChange = origem === 'cadastro'
    || origem === 'vistoria'
    || event.registroHistoricoAnterior !== event.registroHistoricoNovo
    || event.statusAnterior !== event.statusNovo
    || String(event.torreAnterior || '') !== String(event.torreNova || '')
    || String(event.localTipoAnterior || '') !== String(event.localTipoNovo || '')
    || String(event.intervencaoRealizadaAnterior || '') !== String(event.intervencaoRealizadaNova || '')
    || String(event.obsAnterior || '') !== String(event.obsNovo || '');

  if (!hasRelevantChange) return null;

  return {
    timestamp: event.timestamp,
    usuario: event.usuario,
    origem: event.origem,
    tipoEvento: 'sistema',
    ...(event.vistoriaId ? { vistoriaId: event.vistoriaId } : {}),
    ...(event.statusAnterior ? { statusAnterior: event.statusAnterior } : {}),
    statusNovo: event.statusNovo,
    resumo: event.resumo,
  };
}

export function normalizeFollowupEventType(item) {
  const raw = normalizeText(item?.tipoEvento).toLowerCase();
  if (raw === 'obra') return 'obra';
  if (raw === 'autuacao') return 'autuacao';
  return 'sistema';
}

export function buildManualFollowupEvent(data, meta = {}) {
  const tipoEvento = normalizeText(data?.tipoEvento).toLowerCase();
  const usuario = normalizeText(meta?.updatedBy);

  if (tipoEvento === 'obra') {
    const obraEtapa = normalizeText(data?.obraEtapa);
    const descricao = normalizeText(data?.descricao);
    if (!obraEtapa || !descricao) return null;
    const etapa = obraEtapa.toLowerCase();
    const etapaConcluida = etapa === 'concluida' || etapa === 'concluída';
    return {
      timestamp: new Date().toISOString(),
      usuario,
      origem: 'manual',
      tipoEvento: 'obra',
      obraEtapa,
      descricao,
      ...(etapaConcluida ? { statusNovo: 'Estabilizado' } : {}),
      resumo: `Obra - ${obraEtapa}: ${descricao}`,
    };
  }

  if (tipoEvento === 'autuacao') {
    const orgao = normalizeText(data?.orgao);
    const numeroOuDescricao = normalizeText(data?.numeroOuDescricao);
    const autuacaoStatus = normalizeText(data?.autuacaoStatus);
    if (!orgao || !numeroOuDescricao || !autuacaoStatus) return null;
    return {
      timestamp: new Date().toISOString(),
      usuario,
      origem: 'manual',
      tipoEvento: 'autuacao',
      orgao,
      numeroOuDescricao,
      autuacaoStatus,
      resumo: `Autuacao (${orgao}) - ${autuacaoStatus}: ${numeroOuDescricao}`,
    };
  }

  return null;
}

export function appendFollowupEvent(history, event) {
  const normalized = normalizeFollowupHistory(history);
  if (!event) return normalized;
  return [...normalized, event].slice(-100);
}

export function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeProjectKey(value) {
  return normalizeText(value).toLowerCase();
}

function getErosionInspectionIds(erosion) {
  const primary = normalizeText(erosion?.vistoriaId);
  const extra = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const merged = [primary, ...extra.map((item) => normalizeText(item))]
    .filter(Boolean);
  return [...new Set(merged)];
}

function resolveErosionProjectId(erosion, inspectionsById = new Map()) {
  const explicit = normalizeProjectKey(erosion?.projetoId);
  if (explicit) return explicit;
  const inspectionIds = getErosionInspectionIds(erosion);
  for (let i = 0; i < inspectionIds.length; i += 1) {
    const inspection = inspectionsById.get(inspectionIds[i]);
    const project = normalizeProjectKey(inspection?.projetoId);
    if (project) return project;
  }
  return '';
}

function resolveErosionDate(erosion, inspectionsById = new Map()) {
  const candidates = [
    erosion?.ultimaAtualizacao,
    erosion?.updatedAt,
    erosion?.createdAt,
    erosion?.dataCadastro,
    erosion?.data,
  ];
  getErosionInspectionIds(erosion).forEach((inspectionId) => {
    const inspection = inspectionsById.get(inspectionId);
    if (inspection) {
      candidates.push(inspection?.dataFim, inspection?.dataInicio, inspection?.data);
    }
  });
  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = toIsoDate(candidates[i]);
    if (parsed) return parsed;
  }
  return null;
}

export function filterErosionsForReport(
  erosions,
  { projetoId, anos },
  inspections = [],
) {
  const selectedYearsRaw = Array.isArray(anos) ? anos : [];
  const selectedYears = new Set(
    selectedYearsRaw
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 9999),
  );
  const projectKey = normalizeProjectKey(projetoId);
  const inspectionsById = new Map((inspections || []).map((item) => [normalizeText(item?.id), item]));

  return (erosions || []).filter((item) => {
    if (resolveErosionProjectId(item, inspectionsById) !== projectKey) return false;
    if (selectedYears.size === 0) return true;

    const rowDate = resolveErosionDate(item, inspectionsById);
    if (!rowDate) return false;
    const year = Number(String(rowDate).slice(0, 4));
    return selectedYears.has(year);
  });
}

export function buildErosionReportRows(erosions) {
  return (erosions || []).map((item) => {
    const locationCoordinates = normalizeLocationCoordinates(item);
    const technical = normalizeErosionTechnicalFields(item);
    const localContexto = technical.localContexto || LOCAL_CONTEXTO_DEFAULT;

    return {
      id: item.id || '',
      projetoId: item.projetoId || '',
      vistoriaId: item.vistoriaId || '',
      torreRef: item.torreRef || '',
      'localContexto.localTipo': localContexto.localTipo || '',
      'localContexto.localTipoLabel': getLocalContextLabel(localContexto.localTipo) || '',
      'localContexto.localDescricao': localContexto.localDescricao || '',
      'localContexto.exposicao': localContexto.exposicao || '',
      'localContexto.estruturaProxima': localContexto.estruturaProxima || '',
      tipo: deriveErosionTypeFromTechnicalFields(item),
      estagio: item.estagio || '',
      status: normalizeErosionStatus(item.status),
      impacto: item.impacto || '',
      score: item.score ?? '',
      frequencia: item.frequencia || '',
      intervencao: item.intervencao || '',
      latitude: locationCoordinates.latitude || '',
      longitude: locationCoordinates.longitude || '',
      utmEasting: locationCoordinates.utmEasting || '',
      utmNorthing: locationCoordinates.utmNorthing || '',
      utmZone: locationCoordinates.utmZone || '',
      utmHemisphere: locationCoordinates.utmHemisphere || '',
      altitude: locationCoordinates.altitude || '',
      reference: locationCoordinates.reference || '',
      presencaAguaFundo: technical.presencaAguaFundo,
      tiposFeicao: technical.tiposFeicao.join('|'),
      caracteristicasFeicao: technical.caracteristicasFeicao.join('|'),
      usosSolo: technical.usosSolo.join('|'),
      usoSoloOutro: technical.usoSoloOutro,
      saturacaoPorAgua: technical.saturacaoPorAgua,
      tipoSolo: technical.tipoSolo,
      localizacaoExposicao: localContexto.exposicao,
      estruturaProxima: localContexto.estruturaProxima,
      profundidadeMetros: Number.isFinite(technical.profundidadeMetros) ? technical.profundidadeMetros : '',
      declividadeGraus: Number.isFinite(technical.declividadeGraus) ? technical.declividadeGraus : '',
      distanciaEstruturaMetros: Number.isFinite(technical.distanciaEstruturaMetros) ? technical.distanciaEstruturaMetros : '',
      sinaisAvanco: technical.sinaisAvanco ? 'sim' : 'nao',
      vegetacaoInterior: technical.vegetacaoInterior ? 'sim' : 'nao',
      criticidadeCodigo: item?.criticalidadeV2?.codigo || '',
      criticidadeClasse: item?.criticalidadeV2?.criticidade_classe || '',
      criticidadeScore: item?.criticalidadeV2?.criticidade_score ?? '',
      medidaPreventiva: item.medidaPreventiva || '',
      fotosLinks: Array.isArray(item.fotosLinks) ? item.fotosLinks.join('|') : '',
      ultimaAtualizacao: item.ultimaAtualizacao || '',
      atualizadoPor: item.atualizadoPor || '',
    };
  });
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildErosionsCsv(rows) {
  const headers = [
    'id', 'projetoId', 'vistoriaId', 'torreRef',
    'localContexto.localTipo', 'localContexto.localTipoLabel', 'localContexto.localDescricao',
    'localContexto.exposicao', 'localContexto.estruturaProxima',
    'tipo', 'estagio',
    'status', 'impacto', 'score', 'frequencia', 'intervencao',
    'latitude', 'longitude',
    'utmEasting', 'utmNorthing', 'utmZone', 'utmHemisphere', 'altitude', 'reference',
    'presencaAguaFundo', 'tiposFeicao', 'caracteristicasFeicao',
    'usosSolo', 'usoSoloOutro', 'saturacaoPorAgua',
    'tipoSolo', 'localizacaoExposicao', 'estruturaProxima',
    'profundidadeMetros', 'declividadeGraus', 'distanciaEstruturaMetros',
    'sinaisAvanco', 'vegetacaoInterior',
    'criticidadeCodigo', 'criticidadeClasse', 'criticidadeScore',
    'medidaPreventiva', 'fotosLinks',
    'ultimaAtualizacao', 'atualizadoPor',
  ];

  const lines = [headers.join(';')];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escapeCsv(row[key])).join(';'));
  });
  return lines.join('\n');
}

export function buildImpactSummary(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'Nao informado';
    const impact = row.impacto || 'Nao informado';
    acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
    acc.byImpact[impact] = (acc.byImpact[impact] || 0) + 1;
    return acc;
  }, { byStatus: {}, byImpact: {} });
}
