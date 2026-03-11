/**
 * Backend-specific wrapper around shared erosion helpers.
 * Pure logic lives in shared/erosionHelpers.js (bundled via esbuild).
 * This file adds Firebase Admin-specific functionality (FieldValue.delete).
 */
const admin = require('firebase-admin');
const { normalizeErosionStatus } = require('./statusUtils_dist');
const shared = require('./sharedErosionHelpers_dist');

function buildSituacaoFromStatus(status) {
    return shared.buildSituacaoFromStatus(status, normalizeErosionStatus);
}

function buildCriticalityHistory(previous, nextData, criticalidadeV2) {
    return shared.buildCriticalityHistory(previous, nextData, criticalidadeV2, {
        normalizeStatusFn: normalizeErosionStatus,
    });
}

function buildLegacyFieldCleanupPatch() {
    const removedFields = [
        ...shared.EROSION_REMOVED_FIELDS_LEGACY,
        ...shared.LEGACY_CLEANUP_EXTRA_FIELDS,
    ];

    return removedFields.reduce((acc, field) => {
        acc[field] = admin.firestore.FieldValue.delete();
        return acc;
    }, {});
}

module.exports = {
    // Re-export shared pure functions
    getInspectionDateScore: shared.getInspectionDateScore,
    normalizeErosionInspectionIds: shared.normalizeErosionInspectionIds,
    resolvePrimaryInspectionId: shared.resolvePrimaryInspectionId,
    normalizeNumeric: shared.normalizeNumeric,
    normalizeText: shared.normalizeText,
    buildManualFollowupEvent: shared.buildManualFollowupEvent,
    appendFollowupEvent: shared.appendFollowupEvent,
    buildCriticalityTrend: shared.buildCriticalityTrend,
    normalizeCriticalityHistory: shared.normalizeCriticalityHistory,

    // Backend-specific wrappers
    buildSituacaoFromStatus,
    buildCriticalityHistory,
    buildLegacyFieldCleanupPatch,
};
