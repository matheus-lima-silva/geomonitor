import { normalizeErosionStatus } from '../../shared/statusUtils';
import { normalizeLocationCoordinates } from './erosionCoordinates';

export const EROSION_LOCATION_OPTIONS = [
  'Na faixa de servidao',
  'Na via de acesso exclusiva',
  'Fora da faixa de servidao',
  'Base de torre',
  'Outros',
];

const EROSION_LOCATION_ALIASES = {
  'na faixa de servidao': 'Na faixa de servidao',
  'na faixa de servidão': 'Na faixa de servidao',
  'na via de acesso exclusiva': 'Na via de acesso exclusiva',
  'fora da faixa de servidao': 'Fora da faixa de servidao',
  'fora da faixa de servidão': 'Fora da faixa de servidao',
  'base de torre': 'Base de torre',
  outros: 'Outros',
};

export const EROSION_TECHNICAL_ENUMS = {
  presencaAguaFundo: ['sim', 'nao', 'nao_verificado'],
  tiposFeicao: ['laminar', 'sulco', 'movimento_massa', 'escorregamento', 'ravina', 'vocoroca', 'deslizamento', 'fluxo_lama'],
  caracteristicasFeicao: ['contato_materiais', 'alteracao_morfologia', 'sinais_avanco_recente', 'crescimento_vegetacao'],
  larguraMaximaClasse: ['<1', '1-3', '3-5', '>5'],
  declividadeClasse: ['<15', '15-30', '30-45', '>45'],
  usosSolo: ['pastagem', 'cultivo', 'campo', 'veg_arborea', 'curso_agua', 'cerca', 'acesso', 'tubulacao', 'outro'],
  saturacaoPorAgua: ['sim', 'nao'],
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
    { value: 'sinais_avanco_recente', label: 'Sinais de avanco recente' },
    { value: 'crescimento_vegetacao', label: 'Crescimento de vegetacao' },
  ],
  larguraMaximaClasse: [
    { value: '<1', label: '< 1 m' },
    { value: '1-3', label: '1 m a 3 m' },
    { value: '3-5', label: '3 m a 5 m' },
    { value: '>5', label: '> 5 m' },
  ],
  declividadeClasse: [
    { value: '<15', label: '< 15°' },
    { value: '15-30', label: '15° a 30°' },
    { value: '30-45', label: '30° a 45°' },
    { value: '>45', label: '> 45°' },
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
};

function normalizeText(value) {
  return String(value || '').trim();
}

const DECLIVIDADE_CLASS_ALIASES = {
  'ate_10': '<15',
  'até_10': '<15',
  'de_10_a_25': '15-30',
  'maior_25': '>45',
};

const LARGURA_CLASS_ALIASES = {
  'ate_1m': '<1',
  'até_1m': '<1',
  'de_1_a_10m': '>5',
  'maior_30m': '>5',
};

function normalizeLocationValue(value) {
  const key = normalizeText(value).toLowerCase();
  if (!key) return '';
  return EROSION_LOCATION_ALIASES[key] || '';
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

function normalizeDeclividadeClasseValue(input, fallbackDeclividade) {
  const raw = normalizeText(input || fallbackDeclividade).toLowerCase();
  if (!raw) return '';
  if (EROSION_TECHNICAL_ENUMS.declividadeClasse.includes(raw)) return raw;
  if (DECLIVIDADE_CLASS_ALIASES[raw]) return DECLIVIDADE_CLASS_ALIASES[raw];
  return '';
}

function normalizeLarguraClasseValue(input, fallbackLargura) {
  const raw = normalizeText(input || fallbackLargura).toLowerCase();
  if (!raw) return '';
  if (EROSION_TECHNICAL_ENUMS.larguraMaximaClasse.includes(raw)) return raw;
  if (LARGURA_CLASS_ALIASES[raw]) return LARGURA_CLASS_ALIASES[raw];
  return '';
}

export function normalizeErosionTechnicalFields(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const saturacao = normalizeEnumValue(
    source.saturacaoPorAgua || source.soloSaturadoAgua,
    EROSION_TECHNICAL_ENUMS.saturacaoPorAgua,
  );
  const declividadeClasse = normalizeDeclividadeClasseValue(
    source.declividadeClasse || source.declividadeClassePdf,
    source.declividade,
  );
  const larguraMaximaClasse = normalizeLarguraClasseValue(
    source.larguraMaximaClasse,
    source.largura,
  );

  return {
    presencaAguaFundo: normalizeEnumValue(source.presencaAguaFundo, EROSION_TECHNICAL_ENUMS.presencaAguaFundo),
    tiposFeicao: normalizeEnumArray(source.tiposFeicao, EROSION_TECHNICAL_ENUMS.tiposFeicao),
    caracteristicasFeicao: normalizeEnumArray(source.caracteristicasFeicao, EROSION_TECHNICAL_ENUMS.caracteristicasFeicao),
    larguraMaximaClasse,
    declividadeClasse,
    usosSolo: normalizeEnumArray(source.usosSolo, EROSION_TECHNICAL_ENUMS.usosSolo),
    usoSoloOutro: normalizeText(source.usoSoloOutro),
    saturacaoPorAgua: saturacao,
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

export function mapDeclividadeClasseToLegacyValue(value) {
  return normalizeDeclividadeClasseValue(value, '');
}

export function mapLarguraClasseToLegacyValue(value) {
  return normalizeLarguraClasseValue(value, '');
}

export function buildCriticalityInputFromErosion(data = {}) {
  const technical = normalizeErosionTechnicalFields(data);
  return {
    ...data,
    tipo: deriveErosionTypeFromTechnicalFields({ ...data, tiposFeicao: technical.tiposFeicao }),
    declividade: mapDeclividadeClasseToLegacyValue(technical.declividadeClasse || data.declividade),
    largura: mapLarguraClasseToLegacyValue(technical.larguraMaximaClasse || data.largura),
  };
}

export function normalizeFollowupHistory(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateErosionLocation(data) {
  const localTipo = normalizeLocationValue(data?.localTipo);
  const localDescricao = normalizeText(data?.localDescricao);

  if (!localTipo) {
    return { ok: false, message: 'Selecione o local da erosao.' };
  }

  if (!EROSION_LOCATION_OPTIONS.includes(localTipo)) {
    return { ok: false, message: 'Opcao de local da erosao invalida.' };
  }

  if (localTipo === 'Outros' && !localDescricao) {
    return { ok: false, message: 'Informe a descricao do local quando selecionar "Outros".' };
  }

  return { ok: true, message: '' };
}

export function validateErosionTechnicalFields(data = {}) {
  const raw = data && typeof data === 'object' ? data : {};
  const normalized = normalizeErosionTechnicalFields(raw);

  const singleRules = [
    ['presencaAguaFundo', EROSION_TECHNICAL_ENUMS.presencaAguaFundo, 'Presenca de agua no fundo'],
    ['larguraMaximaClasse', EROSION_TECHNICAL_ENUMS.larguraMaximaClasse, 'Classe tecnica de largura maxima (m)'],
    ['declividadeClasse', EROSION_TECHNICAL_ENUMS.declividadeClasse, 'Classe tecnica de declividade (graus)'],
    ['saturacaoPorAgua', EROSION_TECHNICAL_ENUMS.saturacaoPorAgua, 'Saturacao por agua'],
  ];

  for (let i = 0; i < singleRules.length; i += 1) {
    const [field, allowed, label] = singleRules[i];
    const sourceValue = normalizeText(
      raw[field]
      || (field === 'declividadeClasse' ? (raw.declividadeClassePdf || raw.declividade) : '')
      || (field === 'larguraMaximaClasse' ? raw.largura : '')
      || (field === 'saturacaoPorAgua' ? raw.soloSaturadoAgua : ''),
    );
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

  return { ok: true, message: '', value: normalized };
}

function summarizeEvent(change, previous) {
  if (change.origem === 'cadastro') return 'Cadastro inicial da erosao.';
  if (change.origem === 'vistoria') return 'Erosao registrada durante vistoria.';

  const pieces = [];
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
    localTipoAnterior: previous?.localTipo,
    localTipoNovo: next?.localTipo,
    obsAnterior: previous?.obs,
    obsNovo: next?.obs,
  };

  event.resumo = summarizeEvent(event, previous);

  const hasRelevantChange = origem === 'cadastro'
    || origem === 'vistoria'
    || event.statusAnterior !== event.statusNovo
    || String(event.torreAnterior || '') !== String(event.torreNova || '')
    || String(event.localTipoAnterior || '') !== String(event.localTipoNovo || '')
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

    return {
      id: item.id || '',
      projetoId: item.projetoId || '',
      vistoriaId: item.vistoriaId || '',
      torreRef: item.torreRef || '',
      localTipo: item.localTipo || '',
      localDescricao: item.localDescricao || '',
      tipo: deriveErosionTypeFromTechnicalFields(item),
      estagio: item.estagio || '',
      profundidade: item.profundidade || '',
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
      faixaServidao: item.faixaServidao || '',
      areaTerceiros: item.areaTerceiros || '',
      usoSolo: item.usoSolo || '',
      presencaAguaFundo: technical.presencaAguaFundo,
      tiposFeicao: technical.tiposFeicao.join('|'),
      caracteristicasFeicao: technical.caracteristicasFeicao.join('|'),
      larguraMaximaClasse: technical.larguraMaximaClasse,
      declividadeClasse: technical.declividadeClasse,
      usosSolo: technical.usosSolo.join('|'),
      usoSoloOutro: technical.usoSoloOutro,
      saturacaoPorAgua: technical.saturacaoPorAgua,
      soloSaturadoAgua: technical.saturacaoPorAgua,
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
    'id', 'projetoId', 'vistoriaId', 'torreRef', 'localTipo', 'localDescricao',
    'tipo', 'estagio', 'profundidade',
    'status', 'impacto', 'score', 'frequencia', 'intervencao',
    'latitude', 'longitude',
    'utmEasting', 'utmNorthing', 'utmZone', 'utmHemisphere', 'altitude', 'reference',
    'faixaServidao', 'areaTerceiros', 'usoSolo',
    'presencaAguaFundo', 'tiposFeicao', 'caracteristicasFeicao',
    'larguraMaximaClasse', 'declividadeClasse',
    'usosSolo', 'usoSoloOutro', 'saturacaoPorAgua',
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
