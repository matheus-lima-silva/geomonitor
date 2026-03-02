const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/firebaseSetup');
const { verifyToken } = require('../utils/authMiddleware');

const { calculateCriticality } = require('../utils/criticality_dist');
const {
    stripRemovedErosionFields,
    validateErosionTechnicalFields,
    buildCriticalityInputFromErosion,
    deriveErosionTypeFromTechnicalFields,
    buildFollowupEvent,
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

/**
 * POST /api/erosions
 * Receives { data, meta } from the frontend,
 * applies full legacy logic and criticality securely, 
 * and saves to Firestore via Admin SDK.
 */
router.post('/', verifyToken, async (req, res) => {
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

        const locationResult = resolveLocationCoordinatesForSave(sanitizedPayload);
        if (!locationResult.ok) {
            return res.status(400).json({ status: 'error', message: locationResult.error || 'Coordenadas inválidas.' });
        }

        const technicalValidation = validateErosionTechnicalFields(sanitizedPayload);
        if (!technicalValidation.ok) {
            return res.status(400).json({ status: 'error', message: technicalValidation.message || 'Campos técnicos inválidos.' });
        }

        const technical = technicalValidation.value || normalizeErosionTechnicalFields(sanitizedPayload);
        const criticalityInput = buildCriticalityInputFromErosion({
            ...sanitizedPayload,
            tiposFeicao: technical.tiposFeicao,
        });

        let calculationResult, criticalidadeV2, alertsAtivos;

        if (sanitizedPayload.criticalidadeV2) {
            criticalidadeV2 = sanitizedPayload.criticalidadeV2;
            alertsAtivos = sanitizedPayload.alertsAtivos || [];
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
            impacto: sanitizedPayload.impacto || criticality?.impacto || criticalidadeV2?.legacy?.impacto || 'Baixo',
            score: sanitizedPayload.score ?? criticality?.score ?? criticalidadeV2?.criticidade_score ?? 0,
            frequencia: sanitizedPayload.frequencia || criticality?.frequencia || criticalidadeV2?.legacy?.frequencia || '24 meses',
            intervencao: sanitizedPayload.intervencao || criticality?.intervencao || criticalidadeV2?.legacy?.intervencao || 'Monitoramento visual',
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
            medidaPreventiva: sanitizedPayload.medidaPreventiva
                || criticalidadeV2?.lista_solucoes_sugeridas?.[0]
                || '',
            fotosLinks,
            criticalidadeV2,
            alertsAtivos: Array.isArray(sanitizedPayload.alertsAtivos)
                ? sanitizedPayload.alertsAtivos
                : alertsAtivos,
            backfillEstimado: Boolean(sanitizedPayload.backfillEstimado),
            ultimaAtualizacao: new Date().toISOString()
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
            historicoCriticidade: buildCriticalityHistory(previous, nextData, criticalidadeV2),
        };

        await db.collection('shared')
            .doc('geomonitor')
            .collection('erosions')
            .doc(id)
            .set(finalDocument, { merge: true });

        return res.status(200).json({
            status: 'success',
            message: 'Erosão calculada e salva com sucesso!',
            data: { id }
        });

    } catch (error) {
        console.error('[Geomonitor API] Erro interno no endpoint /api/erosions:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno no servidor' });
    }
});

router.post('/simulate', verifyToken, async (req, res) => {
    try {
        const { data } = req.body;

        // This simulates the same calculations that happen during POST/PUT
        // but it doesn't modify the database. It just returns the fields.
        const scoreFields = calcular_criticidade(data);

        res.status(200).json({
            message: 'Erosion calculation simulated successfully.',
            data: scoreFields,
        });
    } catch (error) {
        console.error('Error during erosion simulation:', error);
        res.status(500).json({ message: 'Error running simulation: ' + error.message });
    }
});

module.exports = router;
