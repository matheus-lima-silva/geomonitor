import { normalizeLocationCoordinates } from './erosionCoordinates';
import { normalizeErosionStatus } from './statusUtils';

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

function normalizeText(value) {
    return String(value || '').trim();
}

const EROSION_TIPO_FEICAO_CANONICAL_MAP = {
    escorregamento: 'movimento_massa',
    deslizamento: 'movimento_massa',
    fluxo_lama: 'movimento_massa',
};

function normalizeFeicaoTipoValue(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return '';
    return EROSION_TIPO_FEICAO_CANONICAL_MAP[normalized] || normalized;
}

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

function normalizeLocationValue(value) {
    const key = normalizeText(value).toLowerCase();
    if (!key) return '';
    return EROSION_LOCATION_ALIASES[key] || '';
}

export function getLocalContextLabel(localTipo) {
    const normalized = normalizeLocationValue(localTipo);
    return LOCAL_CONTEXTO_LABEL_BY_TIPO[normalized] || '';
}

export const EROSION_TECHNICAL_ENUMS = {
    presencaAguaFundo: ['sim', 'nao', 'nao_verificado'],
    tiposFeicao: ['laminar', 'sulco', 'movimento_massa', 'ravina', 'vocoroca'],
    usosSolo: ['pastagem', 'cultivo', 'campo', 'veg_arborea', 'curso_agua', 'cerca', 'acesso', 'tubulacao', 'outro'],
    saturacaoPorAgua: ['sim', 'nao'],
    tipoSolo: ['lateritico', 'argiloso', 'solos_rasos', 'arenoso'],
    localizacaoExposicao: ['faixa_servidao', 'area_terceiros'],
    estruturaProxima: ['torre', 'fundacao', 'acesso', 'app', 'curso_agua', 'nenhuma'],
    posicaoRelativaVia: ['leito', 'talude_montante', 'talude_jusante', 'margem_lateral'],
    tipoImpactoVia: ['soterramento_parcial', 'soterramento_total', 'cedimento_lateral', 'ruptura_plataforma', 'obstrucao_drenagem', 'degradacao_superficie', 'nenhum'],
    grauObstrucao: ['sem_obstrucao', 'parcial', 'total'],
    estadoVia: ['pavimentada', 'cascalho', 'terra'],
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
        { value: 'movimento_massa', label: 'Movimento de massa (escorregamento, deslizamento, fluxo)' },
        { value: 'ravina', label: 'Ravina' },
        { value: 'vocoroca', label: 'Vocoroca' },
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
    posicaoRelativaVia: [
        { value: 'leito', label: 'Leito da via' },
        { value: 'talude_montante', label: 'Talude montante' },
        { value: 'talude_jusante', label: 'Talude jusante' },
        { value: 'margem_lateral', label: 'Margem lateral' },
    ],
    tipoImpactoVia: [
        { value: 'soterramento_parcial', label: 'Soterramento parcial' },
        { value: 'soterramento_total', label: 'Soterramento total' },
        { value: 'cedimento_lateral', label: 'Cedimento lateral' },
        { value: 'ruptura_plataforma', label: 'Ruptura de plataforma' },
        { value: 'obstrucao_drenagem', label: 'Obstrucao de drenagem' },
        { value: 'degradacao_superficie', label: 'Degradacao de superficie' },
        { value: 'nenhum', label: 'Nenhum' },
    ],
    grauObstrucao: [
        { value: 'sem_obstrucao', label: 'Sem obstrucao' },
        { value: 'parcial', label: 'Parcial' },
        { value: 'total', label: 'Total' },
    ],
    estadoVia: [
        { value: 'pavimentada', label: 'Pavimentada' },
        { value: 'cascalho', label: 'Cascalho' },
        { value: 'terra', label: 'Terra' },
    ],
};

function normalizeEnumValue(value, allowedValues = []) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return '';
    return allowedValues.includes(normalized) ? normalized : '';
}

export function normalizeEnumArray(values, allowedValues = []) {
    if (!Array.isArray(values)) return [];
    const normalized = values
        .map((item) => {
            if (allowedValues === EROSION_TECHNICAL_ENUMS.tiposFeicao) {
                return normalizeEnumValue(normalizeFeicaoTipoValue(item), allowedValues);
            }
            return normalizeEnumValue(item, allowedValues);
        })
        .filter(Boolean);
    return [...new Set(normalized)];
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

const LOCAL_CONTEXTO_DEFAULT = {
    localTipo: '',
    exposicao: '',
    estruturaProxima: '',
    localDescricao: '',
};

function inferLegacyExposicao(source = {}, localTipo) {
    const explicit = normalizeEnumValue(
        source.localizacaoExposicao,
        EROSION_TECHNICAL_ENUMS.localizacaoExposicao,
    );
    if (explicit) return explicit;

    if (localTipo === 'fora_faixa_servidao') return 'area_terceiros';
    if (localTipo) return 'faixa_servidao';
    return '';
}

function inferLegacyEstrutura(source = {}, localTipo) {
    const explicit = normalizeEnumValue(
        source.estruturaProxima,
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

function stripRemovedErosionFields(data = {}) {
    const source = data && typeof data === 'object' ? data : {};
    const next = { ...source };
    ['profundidade', 'declividadeClasse', 'declividadeClassePdf', 'faixaServidao', 'areaTerceiros', 'usoSolo', 'soloSaturadoAgua', 'caracteristicasFeicao'].forEach((field) => {
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
        impactoVia: source.impactoVia && typeof source.impactoVia === 'object' ? source.impactoVia : null,
        dimensionamento: typeof source.dimensionamento === 'string' ? normalizeText(source.dimensionamento) : '',
    };
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
    if (value <= 45) return 'D3';
    return 'D4';
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



export function deriveErosionTypeFromTechnicalFields(data = {}) {
    const explicit = normalizeFeicaoTipoValue(data?.tipo);
    if (explicit && EROSION_TECHNICAL_ENUMS.tiposFeicao.includes(explicit)) return explicit;

    const technicalTypes = Array.isArray(data?.tiposFeicao)
        ? data.tiposFeicao.map((item) => normalizeFeicaoTipoValue(item)).filter(Boolean)
        : [];
    if (technicalTypes.length === 0) return '';

    const directMap = ['vocoroca', 'ravina', 'movimento_massa', 'sulco'];
    const direct = technicalTypes.find((item) => directMap.includes(item));
    if (direct) return direct;

    if (technicalTypes.includes('laminar')) return 'sulco';

    return '';
}

export function normalizeFollowupHistory(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeFollowupEventType(item) {
    const raw = normalizeText(item?.tipoEvento).toLowerCase();
    if (raw === 'obra') return 'obra';
    if (raw === 'autuacao') return 'autuacao';
    return 'sistema';
}

export function appendFollowupEvent(history, event) {
    const normalized = normalizeFollowupHistory(history);
    if (!event) return normalized;
    return [...normalized, event].slice(-100);
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
    return raw.registroHistorico === true;
}

function buildLocationFieldErrors(localContexto = {}) {
    const fieldErrors = {};
    const localTipo = localContexto.localTipo || '';

    if (!localTipo || !LOCAL_CONTEXTO_LABEL_BY_TIPO[localTipo]) {
        fieldErrors['localContexto.localTipo'] = 'Selecione o local da erosao.';
        return fieldErrors;
    }

    if (localTipo === 'outros' && !localContexto.localDescricao) {
        fieldErrors['localContexto.localDescricao'] = 'Informe o detalhe do local para "Outros".';
    }

    if (localTipo === 'outros' && !localContexto.exposicao) {
        fieldErrors['localContexto.exposicao'] = 'Selecione a localizacao de exposicao.';
    }

    if (!localContexto.estruturaProxima) {
        fieldErrors['localContexto.estruturaProxima'] = 'Selecione a estrutura proxima.';
        return fieldErrors;
    }

    if (localTipo === 'via_acesso_exclusiva' && localContexto.estruturaProxima !== 'acesso') {
        fieldErrors['localContexto.estruturaProxima'] = 'Via de acesso exclusiva deve usar estrutura proxima igual a acesso.';
    }

    if (localTipo === 'base_torre' && localContexto.estruturaProxima !== 'torre') {
        fieldErrors['localContexto.estruturaProxima'] = 'Base de torre deve usar estrutura proxima igual a torre.';
    }

    return fieldErrors;
}

function getFirstErrorMessage(fieldErrors = {}) {
    return Object.values(fieldErrors).find(Boolean) || '';
}

export function validateErosionRequiredFields(data = {}) {
    const raw = data && typeof data === 'object' ? data : {};
    const historical = isHistoricalErosionRecord(raw);
    const fieldErrors = {};

    if (!normalizeText(raw.projetoId)) {
        fieldErrors.projetoId = 'Selecione o empreendimento.';
    }

    if (!normalizeText(raw.torreRef)) {
        fieldErrors.torreRef = 'Informe a torre de referencia.';
    }

    if (historical) {
        const hasHistoricalContext = [
            raw.intervencaoRealizada,
            raw.intervencao,
            raw.obs,
            raw.descricao,
        ].some((value) => normalizeText(value));
        if (!hasHistoricalContext) {
            fieldErrors.intervencaoRealizada = 'Descreva a intervencao ja realizada para registrar este historico.';
        }
        return {
            ok: Object.keys(fieldErrors).length === 0,
            message: getFirstErrorMessage(fieldErrors),
            fieldErrors,
            historical,
        };
    }

    if (!normalizeText(raw.estagio)) {
        fieldErrors.estagio = 'Selecione o grau erosivo da erosao.';
    }

    Object.assign(fieldErrors, buildLocationFieldErrors(normalizeLocalContexto(raw)));

    const normalizedTechnical = normalizeErosionTechnicalFields(raw);
    if (normalizedTechnical.usosSolo.includes('outro') && !normalizedTechnical.usoSoloOutro) {
        fieldErrors.usoSoloOutro = 'Preencha o campo "Uso do solo - outro".';
    }

    return {
        ok: Object.keys(fieldErrors).length === 0,
        message: getFirstErrorMessage(fieldErrors),
        fieldErrors,
        historical,
    };
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
    const removed = ['profundidade', 'declividadeClasse', 'declividadeClassePdf', 'faixaServidao', 'areaTerceiros', 'usoSolo', 'soloSaturadoAgua'].filter((field) => hasValue(raw[field]));
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

    if (raw.dimensionamento !== null && raw.dimensionamento !== undefined && typeof raw.dimensionamento !== 'string') {
        return {
            ok: false,
            message: 'Dimensionamento invalido(a).',
            value: normalized,
        };
    }

    return { ok: true, message: '', value: normalized };
}

export function filterErosionsForReport(erosions, { projetoId, anos }, inspections = []) {
    const selectedYearsRaw = Array.isArray(anos) ? anos : [];
    const selectedYears = new Set(
        selectedYearsRaw
            .map((year) => Number(year))
            .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 9999),
    );
    const projectKey = normalizeText(projetoId).toLowerCase();
    const inspectionsById = new Map((inspections || []).map((item) => [normalizeText(item?.id), item]));

    return (erosions || []).filter((item) => {
        const itemProjectKey = normalizeText(item?.projetoId).toLowerCase();
        if (itemProjectKey !== projectKey) return false;
        if (selectedYears.size === 0) return true;

        const rowDate = item?.ultimaAtualizacao || item?.updatedAt || item?.createdAt || item?.dataCadastro || item?.data;
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
            impacto: item?.criticalidadeV2?.legacy?.impacto || item.impacto || '',
            score: item?.criticalidadeV2?.criticidade_score ?? item.score ?? '',
            frequencia: item?.criticalidadeV2?.legacy?.frequencia || item.frequencia || '',
            intervencao: item?.criticalidadeV2?.legacy?.intervencao || item.intervencao || '',
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
            dimensionamento: technical.dimensionamento,
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
        'presencaAguaFundo', 'tiposFeicao',
        'usosSolo', 'usoSoloOutro', 'saturacaoPorAgua',
        'tipoSolo', 'localizacaoExposicao', 'estruturaProxima',
        'profundidadeMetros', 'declividadeGraus', 'distanciaEstruturaMetros',
        'sinaisAvanco', 'vegetacaoInterior',
        'dimensionamento',
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

export function buildCriticalityInputFromErosion(data = {}) {
    const technical = normalizeErosionTechnicalFields(data);
    const derivedType = deriveErosionTypeFromTechnicalFields({ ...data, tiposFeicao: technical.tiposFeicao });
    const tipoErosao = derivedType;
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
        local_tipo: localContexto.localTipo,
        localContexto,
        sinais_avanco: technical.sinaisAvanco,
        vegetacao_interior: technical.vegetacaoInterior,
        impactoVia: technical.impactoVia,
        dimensionamento: technical.dimensionamento,
    };
}
