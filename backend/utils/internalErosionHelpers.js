const { normalizeErosionStatus } = require('./statusUtils_dist');
const { buildCriticalityTrend, normalizeCriticalityHistory } = require('./criticality_dist');
const admin = require('firebase-admin');

const EROSION_REMOVED_FIELDS = [
    'score_old', 'pontuacao_old', 'criticidade_old', 'impacto_old', 'risco_old',
    'criticality', 'fotosUrl', 'foto1', 'foto2', 'foto3', 'foto4', 'foto5', 'foto6'
];

function getInspectionDateScore(inspection) {
    const candidates = [inspection?.dataFim, inspection?.dataInicio, inspection?.data];
    for (let i = 0; i < candidates.length; i += 1) {
        const parsed = new Date(candidates[i]);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return null;
}

function normalizeErosionInspectionIds(erosion) {
    const primary = String(erosion?.vistoriaId || '').trim();
    const list = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
    return [...new Set([primary, ...list.map((value) => String(value || '').trim())].filter(Boolean))];
}

function resolvePrimaryInspectionId(inspectionIds, inspections) {
    if (!Array.isArray(inspectionIds) || inspectionIds.length === 0) return '';
    const inspectionById = new Map((Array.isArray(inspections) ? inspections : [])
        .map((inspection) => [String(inspection?.id || '').trim(), inspection]));
    return [...inspectionIds].sort((a, b) => {
        const inspectionA = inspectionById.get(String(a || '').trim());
        const inspectionB = inspectionById.get(String(b || '').trim());
        const scoreA = getInspectionDateScore(inspectionA);
        const scoreB = getInspectionDateScore(inspectionB);
        if (scoreA !== null && scoreB !== null) return scoreB - scoreA;
        if (scoreA !== null) return -1;
        if (scoreB !== null) return 1;
        return String(b || '').localeCompare(String(a || ''));
    })[0];
}

function buildSituacaoFromStatus(status) {
    const normalized = normalizeErosionStatus(status).toLowerCase();
    if (normalized === 'estabilizado') return 'estabilizado';
    if (normalized === 'monitoramento') return 'em_recuperacao';
    return 'ativo';
}

function normalizeNumeric(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildCriticalityHistory(previous, nextData, criticalidadeV2) {
    const previousHistory = normalizeCriticalityHistory(
        nextData.historicoCriticidade ?? previous?.historicoCriticidade,
    );

    const scoreAnterior = normalizeNumeric(
        previous?.criticalidadeV2?.criticidade_score ?? previous?.score,
    );
    const scoreAtual = normalizeNumeric(criticalidadeV2?.criticidade_score);
    const tendencia = buildCriticalityTrend(scoreAnterior, scoreAtual);
    const dataVistoria = String(
        nextData.dataVistoria
        || nextData.data_vistoria
        || nextData.dataCadastro
        || nextData.data
        || new Date().toISOString().slice(0, 10),
    ).trim();

    const snapshot = {
        timestamp: new Date().toISOString(),
        data_vistoria: dataVistoria,
        score_anterior: scoreAnterior,
        score_atual: scoreAtual,
        tendencia,
        intervencao_realizada: String(nextData.intervencaoRealizada || '').trim(),
        situacao: buildSituacaoFromStatus(nextData.status),
    };

    return [...previousHistory, snapshot].slice(-200);
}

function buildLegacyFieldCleanupPatch() {
    const removedFields = [
        ...EROSION_REMOVED_FIELDS,
        'localTipo',
        'localDescricao',
        'localizacaoExposicao',
        'estruturaProxima',
    ];

    return removedFields.reduce((acc, field) => {
        acc[field] = admin.firestore.FieldValue.delete();
        return acc;
    }, {});
}

module.exports = {
    getInspectionDateScore,
    normalizeErosionInspectionIds,
    resolvePrimaryInspectionId,
    buildSituacaoFromStatus,
    normalizeNumeric,
    buildCriticalityHistory,
    buildLegacyFieldCleanupPatch
};
