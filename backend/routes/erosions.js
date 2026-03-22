const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditor } = require('../utils/authMiddleware');
const { createHateoasResponse, generateHateoasLinks } = require('../utils/hateoas');
const { erosionRepository } = require('../repositories');

const {
    calculateCriticality,
    calcularCriticidade,
    calcular_criticidade,
} = require('../utils/criticality_dist');
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
    const source = payload.criticalidade
        || payload.criticalidadeV2
        || payload.criticidadeV2
        || payload.criticalityV2
        || payload.criticality
        || payload;

    if (!source || typeof source !== 'object') return null;

    const nestedCandidates = [
        source.breakdown,
        source.campos_calculados,
        source.calculation,
        source.resultado,
    ];

    for (let i = 0; i < nestedCandidates.length; i += 1) {
        const candidate = nestedCandidates[i];
        if (candidate && typeof candidate === 'object') return candidate;
    }

    return source;
}

function runCriticalityCalculation(input, rulesConfig) {
    try {
        return calculateCriticality(input, rulesConfig);
    } catch (error) {
        const isLegacyWrapperReferenceError = error instanceof ReferenceError
            && String(error.message || '').includes('calcular_criticidade is not defined');

        if (!isLegacyWrapperReferenceError) throw error;

        if (typeof calcularCriticidade === 'function') {
            return calcularCriticidade(input, rulesConfig);
        }

        if (typeof calcular_criticidade === 'function') {
            return calcular_criticidade(input, rulesConfig);
        }

        throw error;
    }
}

async function saveErosionHandler(req, res) {
    try {
        const { data, meta = {} } = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ status: 'error', message: 'Payload data inválido' });
        }

        const sanitizedPayload = stripRemovedErosionFields(data);
        const id = String(sanitizedPayload.id || '').trim() || `ERS-${Date.now()}`;

        let previous = null;

        if (meta.merge) {
            previous = await erosionRepository.getById(id);
        }

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
            impactoVia: technical.impactoVia,
            dimensionamento: technical.dimensionamento,
        });

        let calculationResult;
        let criticalidade = null;
        let alertsAtivos = [];

        if (isHistoricalRecord) {
            criticalidade = normalizeCriticalityPayload(sanitizedPayload) ?? null;
            alertsAtivos = Array.isArray(sanitizedPayload.alertsAtivos) ? sanitizedPayload.alertsAtivos : [];
        } else {
            try {
                calculationResult = runCriticalityCalculation(criticalityInput, meta.rulesConfig);
                criticalidade = calculationResult;
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
            usosSolo: technical.usosSolo,
            usoSoloOutro: technical.usoSoloOutro,
            saturacaoPorAgua: technical.saturacaoPorAgua,
            tipoSolo: technical.tipoSolo,
            profundidadeMetros: technical.profundidadeMetros,
            declividadeGraus: technical.declividadeGraus,
            distanciaEstruturaMetros: technical.distanciaEstruturaMetros,
            sinaisAvanco: technical.sinaisAvanco,
            vegetacaoInterior: technical.vegetacaoInterior,
            impactoVia: technical.impactoVia || null,
            dimensionamento: technical.dimensionamento,
            medidaPreventiva: isHistoricalRecord
                ? String(sanitizedPayload.medidaPreventiva || '').trim()
                : (sanitizedPayload.medidaPreventiva
                    || criticalidade?.lista_solucoes_sugeridas?.[0]
                    || ''),
            fotosLinks,
            criticalidade,
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
                : buildCriticalityHistory(previous, nextData, criticalidade),
        };

        await erosionRepository.save(finalDocument, { merge: true });

        return res.status(req.method === 'PUT' ? 200 : 201).json({
            status: 'success',
            message: 'Erosão calculada e salva com sucesso!',
            data: createHateoasResponse(req, finalDocument, 'erosions', id)
        });

    } catch (error) {
        console.error('[Geomonitor API] Erro interno no endpoint /api/erosions:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno no servidor' });
    }
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const items = (await erosionRepository.list()).map((item) => createHateoasResponse(req, item, 'erosions', item.id));
        return res.status(200).json({ status: 'success', data: items });
    } catch (error) {
        console.error('[Geomonitor API] Erro ao listar erosões:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar erosoes' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const erosion = await erosionRepository.getById(req.params.id);
        if (!erosion) {
            return res.status(404).json({ status: 'error', message: 'Registro nao encontrado' });
        }

        return res.status(200).json({
            status: 'success',
            data: createHateoasResponse(req, erosion, 'erosions', erosion.id),
        });
    } catch (error) {
        console.error('[Geomonitor API] Erro ao buscar erosão:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar erosao' });
    }
});

router.post('/', verifyToken, requireEditor, saveErosionHandler);

router.put('/:id', verifyToken, requireEditor, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    req.body = {
        ...body,
        data: {
            ...data,
            id: req.params.id,
        },
    };
    return saveErosionHandler(req, res);
});

router.delete('/:id', verifyToken, requireEditor, async (req, res) => {
    try {
        await erosionRepository.remove(req.params.id);
        return res.status(200).json({ status: 'success', message: 'Registro deletado' });
    } catch (error) {
        console.error('[Geomonitor API] Erro ao deletar erosão:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao deletar erosao' });
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
            impactoVia: technical.impactoVia,
            dimensionamento: technical.dimensionamento,
        });

        const scoreFields = runCriticalityCalculation(criticalityInput, meta.rulesConfig);

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
