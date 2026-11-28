/**
 * Backend-specific wrapper around shared erosion helpers.
 * Pure logic lives in shared/erosionHelpers.js (bundled via esbuild).
 */
const { normalizeErosionStatus } = require('./statusUtils_dist');
const shared = require('./sharedErosionHelpers_dist');

function buildSituacaoFromStatus(status) {
    return shared.buildSituacaoFromStatus(status, normalizeErosionStatus);
}

function buildCriticalityHistory(previous, nextData, criticalidade, options = {}) {
    return shared.buildCriticalityHistory(previous, nextData, criticalidade, {
        normalizeStatusFn: normalizeErosionStatus,
        inspectionDate: options.inspectionDate,
    });
}

module.exports = {
    // Re-export shared pure functions
    getInspectionDateScore: shared.getInspectionDateScore,
    normalizeErosionInspectionIds: shared.normalizeErosionInspectionIds,
    resolvePrimaryInspectionId: shared.resolvePrimaryInspectionId,
    resolveInspectionDateForTower: shared.resolveInspectionDateForTower,
    normalizeNumeric: shared.normalizeNumeric,
    normalizeText: shared.normalizeText,
    buildManualFollowupEvent: shared.buildManualFollowupEvent,
    appendFollowupEvent: shared.appendFollowupEvent,
    buildCriticalityTrend: shared.buildCriticalityTrend,
    normalizeCriticalityHistory: shared.normalizeCriticalityHistory,

    // Backend-specific wrappers
    buildSituacaoFromStatus,
    buildCriticalityHistory,
};
