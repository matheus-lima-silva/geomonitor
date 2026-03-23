const express = require('express');
const router = express.Router();
const { verifyToken, requireActiveUser, requireEditorOrWorker } = require('../utils/authMiddleware');
const { createResourceHateoasResponse, resolveApiBaseUrl } = require('../utils/hateoas');
const { reportJobRepository } = require('../repositories');

function normalizeText(value) {
    return String(value || '').trim();
}

function resolveActor(req) {
    return normalizeText(req.user?.email) || 'API';
}

function createJobResponse(req, job) {
    const jobId = normalizeText(job.id);
    return createResourceHateoasResponse(
        req,
        job,
        `report-jobs/${jobId}`,
        {
            collectionPath: 'report-jobs',
            allowDelete: false,
            extraLinks: {
                complete: { href: `${resolveApiBaseUrl(req)}/report-jobs/${jobId}/complete`, method: 'PUT' },
                fail: { href: `${resolveApiBaseUrl(req)}/report-jobs/${jobId}/fail`, method: 'PUT' },
            },
        },
    );
}

router.get('/', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const items = await reportJobRepository.list();
        return res.status(200).json({
            status: 'success',
            data: items.map((item) => createJobResponse(req, item)),
        });
    } catch (error) {
        console.error('[report-jobs API] Error GET /:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao listar jobs' });
    }
});

router.get('/:id', verifyToken, requireActiveUser, async (req, res) => {
    try {
        const job = await reportJobRepository.getById(req.params.id);
        if (!job) {
            return res.status(404).json({ status: 'error', message: 'Job nao encontrado' });
        }
        return res.status(200).json({
            status: 'success',
            data: createJobResponse(req, job),
        });
    } catch (error) {
        console.error('[report-jobs API] Error GET /:id:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao buscar job' });
    }
});

router.post('/claim', requireEditorOrWorker, async (req, res) => {
    try {
        const job = await reportJobRepository.claimNext({ updatedBy: resolveActor(req) });
        if (!job) {
            return res.status(204).send();
        }
        return res.status(200).json({
            status: 'success',
            data: createJobResponse(req, job),
        });
    } catch (error) {
        console.error('[report-jobs API] Error POST /claim:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao reivindicar job' });
    }
});

router.put('/:id/complete', requireEditorOrWorker, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const job = await reportJobRepository.markComplete(req.params.id, {
            outputDocxMediaId: data.outputDocxMediaId,
            outputKmzMediaId: data.outputKmzMediaId,
        }, {
            updatedBy: resolveActor(req),
        });
        if (!job) {
            return res.status(404).json({ status: 'error', message: 'Job nao encontrado' });
        }
        return res.status(200).json({
            status: 'success',
            data: createJobResponse(req, job),
        });
    } catch (error) {
        console.error('[report-jobs API] Error PUT /:id/complete:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao concluir job' });
    }
});

router.put('/:id/fail', requireEditorOrWorker, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        const job = await reportJobRepository.markFailed(req.params.id, data.errorLog, {
            updatedBy: resolveActor(req),
        });
        if (!job) {
            return res.status(404).json({ status: 'error', message: 'Job nao encontrado' });
        }
        return res.status(200).json({
            status: 'success',
            data: createJobResponse(req, job),
        });
    } catch (error) {
        console.error('[report-jobs API] Error PUT /:id/fail:', error);
        return res.status(500).json({ status: 'error', message: 'Erro ao marcar job como falha' });
    }
});

module.exports = router;
