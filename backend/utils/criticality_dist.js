var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// utils/criticality.js
var criticality_exports = {};
__export(criticality_exports, {
  CRITICALITY_DEFAULTS: () => CRITICALITY_DEFAULTS,
  buildCriticalityTrend: () => buildCriticalityTrend,
  calcularCriticidade: () => calcularCriticidade,
  calcular_criticidade: () => calcular_criticidade,
  calculateCriticality: () => calculateCriticality,
  inferCriticalityInputFromLegacyErosion: () => inferCriticalityInputFromLegacyErosion,
  mergeCriticalityConfig: () => mergeCriticalityConfig,
  mergeCriticalityV2Config: () => mergeCriticalityV2Config,
  normalizeCriticalityHistory: () => normalizeCriticalityHistory
});
module.exports = __toCommonJS(criticality_exports);

// ../src/features/shared/erosionCoordinates.js
function toTrimmedString(value) {
  return String(value ?? "").trim();
}
function normalizeLocationCoordinates(erosion = {}) {
  const source = erosion && typeof erosion.locationCoordinates === "object" && erosion.locationCoordinates !== null ? erosion.locationCoordinates : {};
  return {
    latitude: toTrimmedString(source.latitude || erosion.latitude),
    longitude: toTrimmedString(source.longitude || erosion.longitude),
    utmEasting: toTrimmedString(source.utmEasting),
    utmNorthing: toTrimmedString(source.utmNorthing),
    utmZone: toTrimmedString(source.utmZone),
    utmHemisphere: toTrimmedString(source.utmHemisphere).toUpperCase(),
    dmsLatitude: toTrimmedString(source.dmsLatitude),
    dmsLongitude: toTrimmedString(source.dmsLongitude),
    altitude: toTrimmedString(source.altitude),
    reference: toTrimmedString(source.reference)
  };
}

// utils/criticality.js
var TYPE_POINTS = {
  laminar: { classe: "T1", pontos: 0 },
  sulco: { classe: "T2", pontos: 2 },
  ravina: { classe: "T3", pontos: 4 },
  vocoroca: { classe: "T4", pontos: 6 },
  movimento_massa: { classe: "T4", pontos: 6 }
};
var SOIL_POINTS = {
  lateritico: { classe: "S1", pontos: 0 },
  argiloso: { classe: "S2", pontos: 2 },
  solos_rasos: { classe: "S3", pontos: 4 },
  arenoso: { classe: "S4", pontos: 6 }
};
var DISTANCE_POINTS = {
  E1: { classe: "E1", pontos: 0, min: 50, max: Infinity, minInclusive: false, maxInclusive: true },
  E2: { classe: "E2", pontos: 2, min: 20, max: 50, minInclusive: true, maxInclusive: true },
  E3: { classe: "E3", pontos: 4, min: 5, max: 20, minInclusive: true, maxInclusive: false },
  E4: { classe: "E4", pontos: 6, min: -Infinity, max: 5, minInclusive: true, maxInclusive: false }
};
var SLOPE_POINTS = {
  D1: { classe: "D1", pontos: 0, min: -Infinity, max: 10, minInclusive: true, maxInclusive: false },
  D2: { classe: "D2", pontos: 2, min: 10, max: 25, minInclusive: true, maxInclusive: true },
  D3: { classe: "D3", pontos: 4, min: 25, max: 45, minInclusive: false, maxInclusive: true },
  D4: { classe: "D4", pontos: 6, min: 45, max: Infinity, minInclusive: false, maxInclusive: true }
};
var DEPTH_POINTS = {
  P1: { classe: "P1", pontos: 0, min: -Infinity, max: 1, minInclusive: true, maxInclusive: true },
  P2: { classe: "P2", pontos: 2, min: 1, max: 10, minInclusive: false, maxInclusive: true },
  P3: { classe: "P3", pontos: 4, min: 10, max: 30, minInclusive: false, maxInclusive: true },
  P4: { classe: "P4", pontos: 6, min: 30, max: Infinity, minInclusive: false, maxInclusive: true }
};
var ACTIVITY_RULES = {
  A1: { classe: "A1", pontos: 0, label: "estabilizado" },
  A2: { classe: "A2", pontos: 2, label: "indeterminado" },
  A3: { classe: "A3", pontos: 4, label: "atividade_parcial" },
  A4: { classe: "A4", pontos: 6, label: "avanco_ativo" }
};
function resolveActivityScore(sinaisAvanco, vegetacaoInterior) {
  if (sinaisAvanco && !vegetacaoInterior) return { ...ACTIVITY_RULES.A4, inferred: false };
  if (sinaisAvanco && vegetacaoInterior) return { ...ACTIVITY_RULES.A3, inferred: false };
  if (!sinaisAvanco && !vegetacaoInterior) return { ...ACTIVITY_RULES.A2, inferred: false };
  return { ...ACTIVITY_RULES.A1, inferred: false };
}
var CRITICALITY_DEFAULTS = {
  pontos: {
    profundidade: {
      P1: { descricao: "<= 1", pontos: 0 },
      P2: { descricao: "> 1 - 10", pontos: 2 },
      P3: { descricao: "> 10 - 30", pontos: 4 },
      P4: { descricao: "> 30", pontos: 6 }
    },
    tipo_erosao: {
      T1: { tipos: ["laminar"], pontos: 0 },
      T2: { tipos: ["sulco"], pontos: 2 },
      T3: { tipos: ["ravina"], pontos: 4 },
      T4: { tipos: ["vocoroca", "movimento_massa"], pontos: 6 }
    },
    declividade: {
      D1: { descricao: "< 10", pontos: 0 },
      D2: { descricao: "10 - 25", pontos: 2 },
      D3: { descricao: "25 - 45", pontos: 4 },
      D4: { descricao: "> 45", pontos: 6 }
    },
    solo: {
      S1: { tipos: ["lateritico"], pontos: 0 },
      S2: { tipos: ["argiloso"], pontos: 2 },
      S3: { tipos: ["solos_rasos"], pontos: 4 },
      S4: { tipos: ["arenoso"], pontos: 6 }
    },
    exposicao: {
      E1: { descricao: "> 50", pontos: 0 },
      E2: { descricao: "20 - 50", pontos: 2 },
      E3: { descricao: "5 - 20", pontos: 4 },
      E4: { descricao: "< 5", pontos: 6 }
    },
    atividade: {
      A1: { descricao: "vegetacao interior, sem avanco (estabilizado)", pontos: 0 },
      A2: { descricao: "sem vegetacao, sem avanco (indeterminado)", pontos: 2 },
      A3: { descricao: "avanco com vegetacao (atividade parcial)", pontos: 4 },
      A4: { descricao: "avanco sem vegetacao (avanco ativo)", pontos: 6 }
    },
    modificador_via: {
      obstrucao_total: { descricao: "obstrucao total da via", pontos: 3 },
      obstrucao_parcial_sem_rota: { descricao: "obstrucao parcial sem rota alternativa", pontos: 2 },
      obstrucao_parcial_com_rota: { descricao: "obstrucao parcial com rota alternativa", pontos: 1 },
      ruptura_plataforma: { descricao: "ruptura de plataforma", pontos: 2 },
      via_terra: { descricao: "via de terra", pontos: 1 },
      cap_maximo: { descricao: "cap maximo do modificador de via", pontos: 4 }
    }
  },
  faixas: [
    { codigo: "C1", classe: "Baixo", min: 0, max: 9 },
    { codigo: "C2", classe: "M\xE9dio", min: 10, max: 18 },
    { codigo: "C3", classe: "Alto", min: 19, max: 27 },
    { codigo: "C4", classe: "Muito Alto", min: 28, max: Infinity }
  ],
  solucoes_por_criticidade: {
    C1: {
      tipo_medida: "preventiva",
      solucoes: [
        "Cobertura vegetal (gram\xEDneas, ressemeadura)",
        "Curvas de n\xEDvel, plantio em faixas",
        "Mulching / palhada / biomanta leve",
        "Controle de tr\xE1fego (evitar compacta\xE7\xE3o)",
        "Regulariza\xE7\xE3o leve de acesso (coroamento)"
      ]
    },
    C2: {
      tipo_medida: "corretiva_leve",
      solucoes: [
        "Barraginhas e pequenos terra\xE7os",
        "Sangradouros laterais / lombadas de \xE1gua",
        "Canaletas vegetadas / valetas rasas",
        "Hidrossemeadura + biomantas leves",
        "Reperfilamento de caixa de estrada"
      ]
    },
    C3: {
      tipo_medida: "corretiva_estrutural",
      solucoes: [
        "Reconforma\xE7\xE3o de taludes (suavizar inclina\xE7\xF5es)",
        "Sarjetas de crista / canaletas revestidas",
        "Escadas hidr\xE1ulicas / bacias de dissipa\xE7\xE3o",
        "Check dams (degraus com pedra/gabi\xF5es/sacos solo-cimento)",
        "Bioengenharia robusta (biomantas refor\xE7adas + estacas vivas)",
        "Enrocamento lateral em acessos cr\xEDticos",
        "Prote\xE7\xE3o de base de torres (anel drenante + enrocamento)"
      ]
    },
    C4: {
      tipo_medida: "engenharia_PRAD",
      solucoes: [
        "Rede completa de drenagem da bacia (terra\xE7os, valas contorno)",
        "Drenos profundos (espinha de peixe) para piping",
        "Diques de terra / barragens com vertedouros protegidos",
        "Estruturas de conten\xE7\xE3o (muros, gabi\xF5es) em taludes cr\xEDticos",
        "Reperfilamento amplo + revegeta\xE7\xE3o com nativas",
        "Monitoramento peri\xF3dico com marcos (recuo de cabeceira)",
        "PRAD espec\xEDfico com acompanhamento semestral/anual"
      ]
    }
  }
};
var TIPO_MEDIDA_POR_FAIXA = {
  C1: "preventiva",
  C2: "corretiva_leve",
  C3: "corretiva_estrutural",
  C4: "engenharia_PRAD"
};
var SOLUCOES_DATABASE = [
  // --- C1: Preventivas ---
  { id: "S01", texto: "Cobertura vegetal (gramineas, ressemeadura)", faixa: ["C1", "C2"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["laminar", "sulco"] },
  { id: "S02", texto: "Curvas de nivel, plantio em faixas", faixa: ["C1"], local: ["faixa_servidao"], tipo: ["laminar", "sulco"] },
  { id: "S03", texto: "Mulching / palhada / biomanta leve", faixa: ["C1", "C2"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["laminar", "sulco", "ravina"] },
  { id: "S04", texto: "Controle de trafego (evitar compactacao)", faixa: ["C1"], local: ["via_acesso_exclusiva"], tipo: ["laminar", "sulco"] },
  { id: "S05", texto: "Regularizacao leve de acesso (coroamento)", faixa: ["C1", "C2"], local: ["via_acesso_exclusiva"], tipo: ["laminar", "sulco"] },
  // --- C2: Corretivas leves ---
  { id: "S06", texto: "Barraginhas e pequenos terracos", faixa: ["C2"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["sulco", "ravina"] },
  { id: "S07", texto: "Sangradouros laterais / lombadas de agua", faixa: ["C2"], local: ["via_acesso_exclusiva"], tipo: ["sulco", "ravina"] },
  { id: "S08", texto: "Canaletas vegetadas / valetas rasas", faixa: ["C2", "C3"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["sulco", "ravina"] },
  { id: "S09", texto: "Hidrossemeadura + biomantas leves", faixa: ["C2"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["laminar", "sulco", "ravina"] },
  { id: "S10", texto: "Reperfilamento de caixa de estrada", faixa: ["C2", "C3"], local: ["via_acesso_exclusiva"], tipo: ["sulco", "ravina", "vocoroca"] },
  // --- C3: Corretivas estruturais ---
  { id: "S11", texto: "Reconformacao de taludes (suavizar inclinacoes)", faixa: ["C3"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  { id: "S12", texto: "Sarjetas de crista / canaletas revestidas", faixa: ["C3"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["ravina", "vocoroca"] },
  { id: "S13", texto: "Escadas hidraulicas / bacias de dissipacao", faixa: ["C3", "C4"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["ravina", "vocoroca"] },
  { id: "S14", texto: "Check dams (degraus com pedra/gabioes/sacos solo-cimento)", faixa: ["C3", "C4"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["ravina", "vocoroca"] },
  { id: "S15", texto: "Bioengenharia robusta (biomantas reforcadas + estacas vivas)", faixa: ["C3"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  { id: "S16", texto: "Enrocamento lateral em acessos criticos", faixa: ["C3", "C4"], local: ["via_acesso_exclusiva"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  { id: "S17", texto: "Protecao de base de torres (anel drenante + enrocamento)", faixa: ["C3", "C4"], local: ["base_torre"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  // --- C4: Engenharia / PRAD ---
  { id: "S18", texto: "Rede completa de drenagem da bacia (terracos, valas contorno)", faixa: ["C4"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["vocoroca", "movimento_massa"] },
  { id: "S19", texto: "Drenos profundos (espinha de peixe) para piping", faixa: ["C4"], local: ["faixa_servidao", "base_torre"], tipo: ["vocoroca"] },
  { id: "S20", texto: "Diques de terra / barragens com vertedouros protegidos", faixa: ["C4"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["vocoroca", "movimento_massa"] },
  { id: "S21", texto: "Estruturas de contencao (muros, gabioes) em taludes criticos", faixa: ["C4"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["vocoroca", "movimento_massa"] },
  { id: "S22", texto: "Reperfilamento amplo + revegetacao com nativas", faixa: ["C3", "C4"], local: ["faixa_servidao", "via_acesso_exclusiva"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  { id: "S23", texto: "Monitoramento periodico com marcos (recuo de cabeceira)", faixa: ["C3", "C4"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["ravina", "vocoroca", "movimento_massa"] },
  { id: "S24", texto: "PRAD especifico com acompanhamento semestral/anual", faixa: ["C4"], local: ["faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["vocoroca", "movimento_massa"] },
  // --- Monitoramento (para fora_faixa e C1 geral) ---
  { id: "S25", texto: "Monitoramento visual periodico", faixa: ["C1", "C2", "C3", "C4"], local: ["fora_faixa_servidao", "faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["laminar", "sulco", "ravina", "vocoroca", "movimento_massa"] },
  { id: "S26", texto: "Registro fotografico de evolucao", faixa: ["C1", "C2", "C3", "C4"], local: ["fora_faixa_servidao", "faixa_servidao", "via_acesso_exclusiva", "base_torre"], tipo: ["laminar", "sulco", "ravina", "vocoroca", "movimento_massa"] },
  { id: "S27", texto: "Notificacao ao proprietario", faixa: ["C1", "C2", "C3", "C4"], local: ["fora_faixa_servidao"], tipo: ["laminar", "sulco", "ravina", "vocoroca", "movimento_massa"] }
];
function normalizeLocalTipoForSolutions(localTipo) {
  const key = normalizeTextLower(localTipo);
  if (key.includes("fora_faixa")) return "fora_faixa_servidao";
  if (key.includes("base_torre") || key.includes("torre")) return "base_torre";
  if (key.includes("acesso")) return "via_acesso_exclusiva";
  return "faixa_servidao";
}
function getSolutionsForContext(codigo, localTipo, tipoErosao) {
  const normalizedLocal = normalizeLocalTipoForSolutions(localTipo);
  const normalizedTipo = normalizeTextLower(tipoErosao) || "sulco";
  const matched = SOLUCOES_DATABASE.filter(
    (s) => s.faixa.includes(codigo) && s.local.includes(normalizedLocal) && s.tipo.includes(normalizedTipo)
  );
  const tipoMedida = TIPO_MEDIDA_POR_FAIXA[codigo] || "preventiva";
  return {
    tipo_medida_recomendada: tipoMedida,
    lista_solucoes_sugeridas: matched.map((s) => s.texto)
  };
}
function normalizeText(value) {
  return String(value || "").trim();
}
function normalizeTextLower(value) {
  return normalizeText(value).toLowerCase();
}
function toAscii(value) {
  return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}
function parseNumeric(value) {
  if (value === null || value === void 0) return null;
  const text = normalizeText(value).replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
function booleanFromUnknown(value) {
  if (typeof value === "boolean") return value;
  const text = normalizeTextLower(value);
  if (!text) return false;
  return ["sim", "true", "1", "yes", "y"].includes(text);
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
  const bands = Array.isArray(config?.faixas) ? config.faixas : CRITICALITY_DEFAULTS.faixas;
  const found = bands.find((item) => {
    const min = Number.isFinite(item.min) ? item.min : 0;
    const max = Number.isFinite(item.max) ? item.max : Infinity;
    return score >= min && score <= max;
  });
  return found || { codigo: "C1", classe: "Baixo" };
}
function normalizeFeicaoTipo(input) {
  const direct = normalizeTextLower(input?.feicao?.tipo || input?.tipo || input?.tipo_erosao || input?.tipoErosao);
  if (direct) {
    if (direct === "vo\xE7oroca") return "vocoroca";
    return direct;
  }
  const fromListRaw = Array.isArray(input?.tiposFeicao) ? input.tiposFeicao : Array.isArray(input?.feicao?.tiposFeicao) ? input.feicao.tiposFeicao : [];
  const fromList = fromListRaw.map((item) => normalizeTextLower(item).replace("vo\xE7oroca", "vocoroca")).filter(Boolean);
  if (fromList.includes("vocoroca")) return "vocoroca";
  if (fromList.includes("ravina")) return "ravina";
  if (fromList.includes("sulco")) return "sulco";
  if (fromList.includes("laminar")) return "laminar";
  if (fromList.includes("movimento_massa") || fromList.includes("deslizamento") || fromList.includes("escorregamento") || fromList.includes("fluxo_lama")) {
    return "movimento_massa";
  }
  return "";
}
function normalizeSolo(input) {
  const value = normalizeTextLower(input?.contexto_fisico?.tipo_solo || input?.tipo_solo || input?.tipoSolo || input?.tipoSoloClasse);
  if (!value) return "";
  if (value === "solo_raso") return "solos_rasos";
  return value;
}
function normalizeLocation(input) {
  const locationRaw = normalizeTextLower(
    input?.localContexto?.exposicao || input?.exposicao?.localizacao || input?.localizacao || input?.localizacao_exposicao
  );
  if (!locationRaw) {
    const localTipo = normalizeLocalTipo(input);
    if (localTipo.includes("fora_faixa")) return "area_terceiros";
    if (localTipo) return "faixa_servidao";
    return "";
  }
  if (locationRaw.includes("faixa")) return "faixa_servidao";
  if (locationRaw.includes("terceiro")) return "area_terceiros";
  return locationRaw;
}
function normalizeLocalTipo(input) {
  return normalizeTextLower(input?.localContexto?.localTipo || input?.localTipo || input?.local_tipo || input?.local || "");
}
function normalizeStructure(input) {
  return normalizeTextLower(
    input?.localContexto?.estruturaProxima || input?.exposicao?.estrutura_proxima || input?.estrutura_proxima || input?.estruturaProxima
  );
}
function normalizeAguaFundo(input) {
  const raw = normalizeTextLower(input?.contexto_fisico?.agua_fundo || input?.agua_fundo || input?.presencaAguaFundo);
  if (!raw) return "";
  if (raw === "n\xE3o" || raw === "nao") return "nao";
  if (raw === "n\xE3o_verificado") return "nao_verificado";
  return raw;
}
function normalizeImpactoVia(vistoriaData = {}) {
  const raw = vistoriaData?.impactoVia && typeof vistoriaData.impactoVia === "object" ? vistoriaData.impactoVia : {};
  return {
    posicaoRelativaVia: normalizeTextLower(raw.posicaoRelativaVia),
    tipoImpactoVia: normalizeTextLower(raw.tipoImpactoVia),
    grauObstrucao: normalizeTextLower(raw.grauObstrucao),
    extensaoAfetadaMetros: parseNumeric(raw.extensaoAfetadaMetros),
    larguraComprometidaMetros: parseNumeric(raw.larguraComprometidaMetros),
    volumeEstimadoM3: parseNumeric(raw.volumeEstimadoM3),
    possibilidadeDesvio: booleanFromUnknown(raw.possibilidadeDesvio),
    rotaAlternativaDisponivel: booleanFromUnknown(raw.rotaAlternativaDisponivel),
    presencaDrenagemVia: booleanFromUnknown(raw.presencaDrenagemVia),
    estadoVia: normalizeTextLower(raw.estadoVia),
    integridadeEstruturalComprometida: booleanFromUnknown(raw.integridadeEstruturalComprometida)
  };
}
function buildNormalizedInput(vistoriaData = {}) {
  const locationCoordinates = normalizeLocationCoordinates(vistoriaData || {});
  const localTipo = normalizeLocalTipo(vistoriaData);
  const impactoVia = normalizeImpactoVia(vistoriaData);
  let distancia = parseNumeric(vistoriaData?.exposicao?.distancia_estrutura_m ?? vistoriaData?.distancia_estrutura_m ?? vistoriaData?.distanciaEstruturaMetros);
  if (localTipo.includes("acesso") && impactoVia.posicaoRelativaVia === "leito") {
    distancia = 0;
  }
  return {
    tipo_erosao: normalizeFeicaoTipo(vistoriaData),
    profundidade_m: parseNumeric(vistoriaData?.feicao?.profundidade_m ?? vistoriaData?.profundidade_m ?? vistoriaData?.profundidadeMetros ?? vistoriaData?.profundidadeM),
    declividade_graus: parseNumeric(vistoriaData?.contexto_fisico?.declividade_graus ?? vistoriaData?.declividade_graus ?? vistoriaData?.declividadeGraus),
    distancia_estrutura_m: distancia,
    tipo_solo: normalizeSolo(vistoriaData),
    estrutura_proxima: normalizeStructure(vistoriaData),
    localizacao_exposicao: normalizeLocation(vistoriaData),
    local_tipo: localTipo,
    sinais_avanco: booleanFromUnknown(vistoriaData?.contexto_fisico?.sinais_avanco ?? vistoriaData?.sinais_avanco),
    vegetacao_interior: booleanFromUnknown(vistoriaData?.contexto_fisico?.vegetacao_interior ?? vistoriaData?.vegetacao_interior),
    agua_fundo: normalizeAguaFundo(vistoriaData),
    impactoVia,
    latitude: parseNumeric(locationCoordinates.latitude),
    longitude: parseNumeric(locationCoordinates.longitude)
  };
}
function buildValidationAlerts(normalized, classification) {
  const alerts = [];
  if (normalized.tipo_erosao === "laminar" && Number.isFinite(normalized.profundidade_m) && normalized.profundidade_m > 0.5) {
    alerts.push("Inconsist\xEAncia: tipo laminar com profundidade acima de 0.50m.");
  }
  if (normalized.tipo_erosao === "vocoroca" && Number.isFinite(normalized.profundidade_m) && normalized.profundidade_m < 1) {
    alerts.push("Poss\xEDvel erro de medi\xE7\xE3o: vo\xE7oroca com profundidade abaixo de 1.00m.");
  }
  if (Number.isFinite(normalized.distancia_estrutura_m) && normalized.distancia_estrutura_m < 5 && ["C1", "C2"].includes(classification.codigo)) {
    alerts.push("Revisar exposi\xE7\xE3o: dist\xE2ncia menor que 5m com criticidade abaixo de C3.");
  }
  if (normalized.sinais_avanco && normalized.vegetacao_interior) {
    alerts.push("H\xE1 sinais de avan\xE7o e vegeta\xE7\xE3o interior; verificar poss\xEDvel estabiliza\xE7\xE3o parcial.");
  }
  return alerts;
}
function mapLegacyImpact(codigo) {
  if (codigo === "C4") return "Muito Alto";
  if (codigo === "C3") return "Alto";
  if (codigo === "C2") return "M\xE9dio";
  return "Baixo";
}
function mapLegacyFrequency(codigo) {
  if (codigo === "C4") return "3 meses";
  if (codigo === "C3") return "6 meses";
  if (codigo === "C2") return "12 meses";
  return "24 meses";
}
function mergeCriticalityConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object") return CRITICALITY_DEFAULTS;
  const source = rawConfig.criticalidade && typeof rawConfig.criticalidade === "object" ? rawConfig.criticalidade : rawConfig.criticalityV2 && typeof rawConfig.criticalityV2 === "object" ? rawConfig.criticalityV2 : rawConfig;
  return {
    ...CRITICALITY_DEFAULTS,
    ...source,
    pontos: {
      ...CRITICALITY_DEFAULTS.pontos,
      ...source.pontos || {}
    },
    solucoes_por_criticidade: {
      ...CRITICALITY_DEFAULTS.solucoes_por_criticidade,
      ...source.solucoes_por_criticidade || {}
    },
    faixas: Array.isArray(source.faixas) && source.faixas.length > 0 ? source.faixas.map((f) => ({
      ...f,
      min: Number.isFinite(f.min) ? f.min : 0,
      max: Number.isFinite(f.max) ? f.max : Infinity
    })) : CRITICALITY_DEFAULTS.faixas
  };
}
function mergeCriticalityV2Config(rawConfig) {
  return mergeCriticalityConfig(rawConfig);
}
function resolveViaModifier(normalized) {
  const localTipo = normalizeTextLower(normalized?.local_tipo);
  const isViaAccess = localTipo.includes("acesso");
  if (!isViaAccess) return 0;
  const iv = normalized?.impactoVia;
  if (!iv || typeof iv !== "object") return 0;
  if (!iv.grauObstrucao && !iv.tipoImpactoVia && !iv.estadoVia) return 0;
  let mod = 0;
  if (iv.grauObstrucao === "total") {
    mod += 3;
  } else if (iv.grauObstrucao === "parcial") {
    mod += iv.rotaAlternativaDisponivel ? 1 : 2;
  }
  if (iv.tipoImpactoVia === "ruptura_plataforma") mod += 2;
  if (iv.estadoVia === "terra") mod += 1;
  return Math.min(mod, 4);
}
function resolveTypeScore(tipo) {
  const key = normalizeTextLower(tipo).replace("vo\xE7oroca", "vocoroca");
  if (!key) return { classe: "T1", pontos: 0, inferred: true };
  const out = TYPE_POINTS[key];
  if (!out) return { classe: "T1", pontos: 0, inferred: true };
  return { ...out, inferred: false };
}
function resolveSoilScore(tipoSolo) {
  const key = normalizeTextLower(tipoSolo);
  if (!key) return { classe: "S1", pontos: 0, inferred: true };
  const out = SOIL_POINTS[key];
  if (!out) return { classe: "S1", pontos: 0, inferred: true };
  return { ...out, inferred: false };
}
function applySolutionContextFilters(baseSolutions, normalized) {
  const list = Array.isArray(baseSolutions?.lista_solucoes_sugeridas) ? baseSolutions.lista_solucoes_sugeridas : [];
  const estrutura = normalizeTextLower(normalized?.estrutura_proxima);
  const localTipo = normalizeTextLower(normalized?.local_tipo);
  const distancia = Number.isFinite(normalized?.distancia_estrutura_m) ? normalized.distancia_estrutura_m : null;
  const isForaFaixa = localTipo.includes("fora_faixa");
  if (isForaFaixa) {
    return {
      ...baseSolutions,
      tipo_medida_recomendada: "monitoramento",
      lista_solucoes_sugeridas: [
        "Monitoramento visual periodico",
        "Registro fotografico de evolucao",
        "Notificacao ao proprietario"
      ],
      recomendacao_contextual_filtros: "Erosao fora da faixa de servidao: apenas monitoramento recomendado. Responsabilidade do proprietario terceiro."
    };
  }
  const isAccessContext = estrutura === "acesso" || localTipo.includes("acesso");
  const isFarFromTower = Number.isFinite(distancia) ? distancia >= 20 : false;
  const isTowerContext = ["torre", "fundacao"].includes(estrutura) || localTipo.includes("torre");
  const shouldHideTowerProtection = isAccessContext && isFarFromTower && !isTowerContext;
  if (!shouldHideTowerProtection) {
    return {
      ...baseSolutions,
      recomendacao_contextual_filtros: ""
    };
  }
  const filtered = list.filter((item) => {
    const text = normalizeTextLower(toAscii(item));
    if (text.includes("base de torres")) return false;
    if (text.includes("base de torre")) return false;
    if (text.includes("anel drenante")) return false;
    return true;
  });
  return {
    ...baseSolutions,
    lista_solucoes_sugeridas: filtered.length > 0 ? filtered : list,
    recomendacao_contextual_filtros: "Solucoes especificas para protecao de torre removidas por contexto de acesso distante."
  };
}
function joinContextMessages(...messages) {
  const clean = messages.map((item) => toAscii(item || "")).filter(Boolean);
  return clean.join(" ");
}
function applyRecommendationPolicy({
  normalized,
  declividadeClasse,
  criticidadeCodigo,
  config,
  baseSolutions
}) {
  const filteredBaseSolutions = applySolutionContextFilters(baseSolutions, normalized);
  if (!["C1", "C2"].includes(criticidadeCodigo)) {
    return {
      ...filteredBaseSolutions,
      lista_solucoes_possiveis_intervencao: [],
      recomendacao_contextual: filteredBaseSolutions.recomendacao_contextual_filtros || ""
    };
  }
  const outsideServidao = normalized.localizacao_exposicao === "area_terceiros";
  const lowOrMediumSlope = ["D1", "D2"].includes(declividadeClasse);
  const shouldCapAtMonitoring = outsideServidao || lowOrMediumSlope;
  if (!shouldCapAtMonitoring) {
    return {
      ...filteredBaseSolutions,
      lista_solucoes_possiveis_intervencao: [],
      recomendacao_contextual: filteredBaseSolutions.recomendacao_contextual_filtros || ""
    };
  }
  const monitoring = getSolutionsForContext("C1", normalized?.local_tipo, normalized?.tipo_erosao);
  const suggestions = Array.isArray(monitoring.lista_solucoes_sugeridas) && monitoring.lista_solucoes_sugeridas.length > 0 ? monitoring.lista_solucoes_sugeridas : ["Monitoramento visual periodico"];
  const optionalInterventions = (filteredBaseSolutions.lista_solucoes_sugeridas || []).filter((item) => !suggestions.includes(item));
  return {
    tipo_medida_recomendada: "monitoramento",
    lista_solucoes_sugeridas: suggestions,
    lista_solucoes_possiveis_intervencao: optionalInterventions,
    recomendacao_contextual: joinContextMessages(
      "Monitoramento recomendado por contexto de exposicao/declividade. Intervencoes permanecem como opcoes.",
      filteredBaseSolutions.recomendacao_contextual_filtros
    )
  };
}
function calcular_criticidade(vistoriaData = {}, config = CRITICALITY_DEFAULTS) {
  const mergedConfig = mergeCriticalityConfig(config);
  const normalized = buildNormalizedInput(vistoriaData);
  const tipo = resolveTypeScore(normalized.tipo_erosao);
  const profundidade = resolveRange(DEPTH_POINTS, normalized.profundidade_m, "P1");
  const declividade = resolveRange(SLOPE_POINTS, normalized.declividade_graus, "D1");
  const solo = resolveSoilScore(normalized.tipo_solo);
  const exposicao = resolveRange(DISTANCE_POINTS, normalized.distancia_estrutura_m, "E1");
  const atividade = resolveActivityScore(normalized.sinais_avanco, normalized.vegetacao_interior);
  const viaModifier = resolveViaModifier(normalized);
  const criticidade_score = tipo.pontos + profundidade.pontos + declividade.pontos + solo.pontos + exposicao.pontos + atividade.pontos + viaModifier;
  let classification = resolveCriticalityBand(criticidade_score, mergedConfig);
  const isBaseTorre = normalizeTextLower(normalized.local_tipo).includes("base_torre") || normalizeTextLower(normalized.estrutura_proxima) === "torre";
  const isHighRiskType = ["vocoroca", "movimento_massa"].includes(normalized.tipo_erosao);
  const isCloseToStructure = Number.isFinite(normalized.distancia_estrutura_m) && normalized.distancia_estrutura_m < 5;
  if (isBaseTorre && isHighRiskType && isCloseToStructure && ["C1", "C2"].includes(classification.codigo)) {
    classification = { codigo: "C3", classe: "Alto" };
  }
  const isForaFaixa = normalizeTextLower(normalized.local_tipo).includes("fora_faixa");
  const isAreaTerceiros = normalized.localizacao_exposicao === "area_terceiros";
  if (isForaFaixa && isAreaTerceiros && ["C3", "C4"].includes(classification.codigo)) {
    classification = { codigo: "C2", classe: "M\xE9dio" };
  }
  const baseSolutions = getSolutionsForContext(classification.codigo, normalized.local_tipo, normalized.tipo_erosao);
  const solutions = applyRecommendationPolicy({
    normalized,
    declividadeClasse: declividade.classe,
    criticidadeCodigo: classification.codigo,
    config: mergedConfig,
    baseSolutions
  });
  const alertas = buildValidationAlerts(normalized, classification);
  const impacto = mapLegacyImpact(classification.codigo);
  const frequencia = mapLegacyFrequency(classification.codigo);
  const intervencao = solutions.lista_solucoes_sugeridas[0] || "Monitoramento visual";
  return {
    profundidade_classe: profundidade.classe,
    tipo_erosao_classe: tipo.classe,
    declividade_classe: declividade.classe,
    solo_classe: solo.classe,
    exposicao_classe: exposicao.classe,
    atividade_classe: atividade.classe,
    pontos: {
      T: tipo.pontos,
      P: profundidade.pontos,
      D: declividade.pontos,
      S: solo.pontos,
      E: exposicao.pontos,
      A: atividade.pontos,
      V: viaModifier
    },
    criticidade_score,
    criticidade_classe: classification.classe,
    codigo: classification.codigo,
    impacto,
    score: criticidade_score,
    frequencia,
    intervencao,
    tipo_medida_recomendada: solutions.tipo_medida_recomendada,
    lista_solucoes_sugeridas: solutions.lista_solucoes_sugeridas,
    lista_solucoes_possiveis_intervencao: solutions.lista_solucoes_possiveis_intervencao,
    recomendacao_contextual: solutions.recomendacao_contextual,
    alertas_validacao: alertas,
    campos_normalizados: normalized
  };
}
function calcularCriticidade(vistoriaData = {}, config = CRITICALITY_DEFAULTS) {
  return calcular_criticidade(vistoriaData, config);
}
function calculateCriticality(vistoriaData = {}, config = CRITICALITY_DEFAULTS) {
  return calcular_criticidade(vistoriaData, config);
}
function inferCriticalityInputFromLegacyErosion(erosion = {}) {
  const tipo = normalizeTextLower(erosion.tipo || erosion.tipo_erosao);
  const fromDepthClass = normalizeTextLower(erosion.profundidade || erosion.profundidadeClasse || "");
  let profundidade = parseNumeric(erosion.profundidade_m || erosion.profundidadeMetros);
  let estimado = false;
  if (!Number.isFinite(profundidade)) {
    if (fromDepthClass === "<0.5") {
      profundidade = 0.3;
      estimado = true;
    } else if (fromDepthClass === "0.5-1.5") {
      profundidade = 1;
      estimado = true;
    } else if (fromDepthClass === "1.5-3.0") {
      profundidade = 2.2;
      estimado = true;
    } else if (fromDepthClass === ">3.0") {
      profundidade = 3.5;
      estimado = true;
    }
  }
  const slopeClass = normalizeTextLower(erosion.declividadeClasse || erosion.declividadeClassePdf || erosion.declividade || "");
  let declividade = parseNumeric(erosion.declividade_graus || erosion.declividadeGraus);
  if (!Number.isFinite(declividade)) {
    if (slopeClass === "<15") {
      declividade = 8;
      estimado = true;
    } else if (slopeClass === "15-30") {
      declividade = 20;
      estimado = true;
    } else if (slopeClass === "30-45" || slopeClass === "maior_25") {
      declividade = 32;
      estimado = true;
    } else if (slopeClass === ">45") {
      declividade = 50;
      estimado = true;
    }
  }
  let distancia = parseNumeric(erosion.distancia_estrutura_m || erosion.distanciaEstruturaMetros);
  if (!Number.isFinite(distancia)) {
    const faixa = normalizeTextLower(erosion.faixaServidao);
    if (faixa === "sim") {
      distancia = 4;
      estimado = true;
    } else {
      distancia = 30;
      estimado = true;
    }
  }
  let solo = normalizeTextLower(erosion.tipo_solo || erosion.tipoSolo || erosion.tipoSoloClasse);
  if (!solo) {
    if (Array.isArray(erosion.usosSolo) && erosion.usosSolo.includes("acesso")) {
      solo = "solos_rasos";
      estimado = true;
    } else {
      solo = "argiloso";
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
      local_tipo: erosion.localTipo || erosion.local_tipo || "",
      localizacao_exposicao: erosion.localizacaoExposicao || erosion.localizacao_exposicao || "",
      estrutura_proxima: erosion.estruturaProxima || erosion.estrutura_proxima || "",
      locationCoordinates: erosion.locationCoordinates,
      latitude: erosion.latitude,
      longitude: erosion.longitude
    },
    estimado
  };
}
function buildCriticalityTrend(previousScore, currentScore) {
  if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) return "estavel";
  if (currentScore > previousScore) return "agravando";
  if (currentScore < previousScore) return "recuperando";
  return "estavel";
}
function normalizeCriticalityHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").slice(-200);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CRITICALITY_DEFAULTS,
  buildCriticalityTrend,
  calcularCriticidade,
  calcular_criticidade,
  calculateCriticality,
  inferCriticalityInputFromLegacyErosion,
  mergeCriticalityConfig,
  mergeCriticalityV2Config,
  normalizeCriticalityHistory
});
