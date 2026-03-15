const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/firebaseSetup');
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createHateoasResponse, generateHateoasLinks } = require('../utils/hateoas');

const { calculateCriticality } = require('../utils/criticality_dist');
const {
    stripRemovedErosionFields,
    validateErosionTechnicalFields,
    buildCriticalityInputFromErosion,
    deriveErosionTypeFromTechnicalFields,
    buildFollowupEvent,
    isHistoricalErosionRecord,
    normalizeErosionTechnicalFields,
    normalizeFollowupHistory,
    appendFollowupEvent,
} = require('../utils/erosionUtils_dist');
const { resolveLocationCoordinatesForSave } = require('../utils/erosionCoordinates_dist');
const { normalizeErosionStatus } = require('../utils/statusUtils_dist');
const {
    buildCriticalityHistory,
    buildLegacyFieldCleanupPatch
} = require('../utils/internalErosionHelpers');

function normalizeCriticalityPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.breakdown && typeof payload.breakdown === 'object') {
        return payload.breakdown;
    }
    return payload;
}

/**
 * POST /api/erosions
 * Receives { data, meta } from the frontend,
 * applies full legacy logic and criticality securely, 
 * and saves to Firestore via Admin SDK.
 */
router.post('/', verifyToken, requireEditor, async (req, res) => {
    try {
        const { data, meta = {} } = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ status: 'error', message: 'Payload data inválido' });
        }

        const sanitizedPayload = stripRemovedErosionFields(data);
        const id = String(sanitizedPayload.id || '').trim() || `ERS-${Date.now()}`;

        const db = getDb();
        let previous = null;

        if (meta.merge) {
            const docSnap = await db.collection('shared').doc('geomonitor').collection('erosions').doc(id).get();
            if (docSnap.exists) {
                previous = docSnap.data();
            }
        }

        const criticality = sanitizedPayload.criticality || null;
        const isHistoricalRecord = isHistoricalErosionRecord(sanitizedPayload);

        const locationResult = resolveLocationCoordinatesForSave(sanitizedPayload);
        if (!locationResult.ok) {
            return res.status(400).json({ status: 'error', message: locationResult.error || 'Coordenadas inválidas.' });
        }

        const technicalValidation = isHistoricalRecord
            ? { ok: true, value: normalizeErosionTechnicalFields(sanitizedPayload) }
            : validateErosionTechnicalFields(sanitizedPayload);
        if (!technicalValidation.ok) {
            return res.status(400).json({ status: 'error', message: technicalValidation.message || 'Campos técnicos inválidos.' });
        }

        const technical = technicalValidation.value || normalizeErosionTechnicalFields(sanitizedPayload);
        const criticalityInput = isHistoricalRecord ? null : buildCriticalityInputFromErosion({
            ...sanitizedPayload,
            tiposFeicao: technical.tiposFeicao,
        });

        let calculationResult;
        let criticalidadeV2 = null;
        let alertsAtivos = [];

        if (isHistoricalRecord) {
            criticalidadeV2 = normalizeCriticalityPayload(sanitizedPayload.criticalidadeV2) ?? null;
            alertsAtivos = Array.isArray(sanitizedPayload.alertsAtivos) ? sanitizedPayload.alertsAtivos : [];
        } else {
            try {
                calculationResult = calculateCriticality(criticalityInput, meta.rulesConfig);
                criticalidadeV2 = calculationResult;
                alertsAtivos = calculationResult.alertas_validacao || [];
            } catch (calcError) {
                console.error('[Geomonitor API] Erro ao calcular criticidade:', calcError);
                return res.status(400).json({ status: 'error', message: 'Falha matemática ao calcular criticidade.' });
            }
        }

        const fotosLinks = Array.isArray(sanitizedPayload.fotosLinks)
            ? sanitizedPayload.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
            : [];

        const mergedInspectionIds = [
            String(sanitizedPayload.vistoriaId || '').trim(),
            ...(Array.isArray(sanitizedPayload.vistoriaIds) ? sanitizedPayload.vistoriaIds : []).map((item) => String(item || '').trim()),
            String(previous?.vistoriaId || '').trim(),
            ...(Array.isArray(previous?.vistoriaIds) ? previous.vistoriaIds : []).map((item) => String(item || '').trim()),
        ].filter(Boolean);

        const vistoriaIds = [...new Set(mergedInspectionIds)];

        const nextData = {
            ...sanitizedPayload,
            id,
            vistoriaId: String(sanitizedPayload.vistoriaId || '').trim(),
            ...(vistoriaIds.length > 0 ? { vistoriaIds } : {}),
            status: normalizeErosionStatus(sanitizedPayload.status),
            registroHistorico: isHistoricalRecord,
            intervencaoRealizada: String(
                sanitizedPayload.intervencaoRealizada
                || previous?.intervencaoRealizada
                || ''
            ).trim(),
            impacto: isHistoricalRecord
                ? String(sanitizedPayload.impacto ?? '').trim()
                : (sanitizedPayload.impacto || criticality?.impacto || criticalidadeV2?.legacy?.impacto || 'Baixo'),
            score: isHistoricalRecord
                ? (sanitizedPayload.score ?? null)
                : (sanitizedPayload.score ?? criticality?.score ?? criticalidadeV2?.criticidade_score ?? 0),
            frequencia: isHistoricalRecord
                ? String(sanitizedPayload.frequencia ?? '').trim()
                : (sanitizedPayload.frequencia || criticality?.frequencia || criticalidadeV2?.legacy?.frequencia || '24 meses'),
            intervencao: isHistoricalRecord
                ? String(sanitizedPayload.intervencao || sanitizedPayload.intervencaoRealizada || 'Intervencao ja executada').trim()
                : (sanitizedPayload.intervencao || criticality?.intervencao || criticalidadeV2?.legacy?.intervencao || 'Monitoramento visual'),
            localContexto: technical.localContexto,
            locationCoordinates: locationResult.locationCoordinates,
            latitude: locationResult.latitude || '',
            longitude: locationResult.longitude || '',
            tipo: deriveErosionTypeFromTechnicalFields({
                ...sanitizedPayload,
                tiposFeicao: technical.tiposFeicao,
            }),
            presencaAguaFundo: technical.presencaAguaFundo,
            tiposFeicao: technical.tiposFeicao,
            caracteristicasFeicao: technical.caracteristicasFeicao,
            usosSolo: technical.usosSolo,
            usoSoloOutro: technical.usoSoloOutro,
            saturacaoPorAgua: technical.saturacaoPorAgua,
            tipoSolo: technical.tipoSolo,
            profundidadeMetros: technical.profundidadeMetros,
            declividadeGraus: technical.declividadeGraus,
            distanciaEstruturaMetros: technical.distanciaEstruturaMetros,
            sinaisAvanco: technical.sinaisAvanco,
            vegetacaoInterior: technical.vegetacaoInterior,
            medidaPreventiva: isHistoricalRecord
                ? String(sanitizedPayload.medidaPreventiva || '').trim()
                : (sanitizedPayload.medidaPreventiva
                    || criticalidadeV2?.lista_solucoes_sugeridas?.[0]
                    || ''),
            fotosLinks,
            criticalidadeV2,
            alertsAtivos: Array.isArray(sanitizedPayload.alertsAtivos)
                ? sanitizedPayload.alertsAtivos
                : alertsAtivos,
            backfillEstimado: Boolean(sanitizedPayload.backfillEstimado),
            ultimaAtualizacao: new Date().toISOString(),
            _links: generateHateoasLinks(req, 'erosions', id),
        };

        const history = normalizeFollowupHistory(previous?.acompanhamentosResumo);
        const event = meta.skipAutoFollowup
            ? null
            : buildFollowupEvent(previous, nextData, {
                updatedBy: meta.updatedBy,
                isCreate: !previous,
                origem: meta.origem,
            });

        const finalDocument = {
            ...nextData,
            ...buildLegacyFieldCleanupPatch(),
            acompanhamentosResumo: appendFollowupEvent(nextData.acompanhamentosResumo ?? history, event),
            historicoCriticidade: isHistoricalRecord
                ? (Array.isArray(previous?.historicoCriticidade) ? previous.historicoCriticidade : [])
                : buildCriticalityHistory(previous, nextData, criticalidadeV2),
        };

        await db.collection('shared')
            .doc('geomonitor')
            .collection('erosions')
            .doc(id)
            .set(finalDocument, { merge: true });

        return res.status(200).json({
            status: 'success',
            message: 'Erosão calculada e salva com sucesso!',
            data: createHateoasResponse(req, { id }, 'erosions', id)
        });

    } catch (error) {
        console.error('[Geomonitor API] Erro interno no endpoint /api/erosions:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno no servidor' });
    }
});

router.post('/simulate', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const { data, meta = {} } = req.body;

        const technicalValidation = validateErosionTechnicalFields(data);
        if (!technicalValidation.ok) {
            return res.status(400).json({
                status: 'error',
                message: technicalValidation.message || 'Campos técnicos inválidos para simulação.',
            });
        }

        const technical = technicalValidation.value || normalizeErosionTechnicalFields(data);
        const criticalityInput = buildCriticalityInputFromErosion({
            ...data,
            tiposFeicao: technical.tiposFeicao,
        });

        const scoreFields = calculateCriticality(criticalityInput, meta.rulesConfig);

        res.status(200).json({
            message: 'Erosion calculation simulated successfully.',
            data: scoreFields,
        });
    } catch (error) {
        console.error('Error during erosion simulation:', error);
        const safeMessage = process.env.NODE_ENV === 'production'
            ? 'Erro interno ao executar simulação.'
            : 'Error running simulation: ' + error.message;
        res.status(500).json({ message: safeMessage });
    }
});

module.exports = router;
