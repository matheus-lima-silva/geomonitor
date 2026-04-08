const {
    projectRepository,
    reportDefaultsRepository,
    operatingLicenseRepository,
    inspectionRepository,
    erosionRepository,
    reportDeliveryTrackingRepository,
    reportWorkspaceRepository,
    reportPhotoRepository,
    projectDossierRepository,
    reportCompoundRepository,
    reportJobRepository,
    workspaceKmzRequestRepository,
} = require('../repositories');

const { convertDecimalToUtm, normalizeLocationCoordinates } = require('./erosionCoordinates_dist');

function normalizeText(value) {
    return String(value || '').trim();
}

async function flushWorkspaceDraftsToPhotos(workspaceId) {
    const workspace = await reportWorkspaceRepository.getById(workspaceId);
    if (!workspace) return 0;

    const curationDrafts = workspace.draftState?.curationDrafts;
    if (!curationDrafts || typeof curationDrafts !== 'object') return 0;

    const photoIds = Object.keys(curationDrafts).filter(Boolean);
    if (photoIds.length === 0) return 0;

    let flushed = 0;
    for (const photoId of photoIds) {
        const draft = curationDrafts[photoId];
        if (!draft || typeof draft !== 'object') continue;

        const current = await reportPhotoRepository.getById(photoId);
        if (!current) continue;

        const caption = normalizeText(draft.caption);
        const towerId = normalizeText(draft.towerId);
        const includeInReport = Boolean(draft.includeInReport);

        const changed = caption !== normalizeText(current.caption)
            || towerId !== normalizeText(current.towerId)
            || includeInReport !== Boolean(current.includeInReport);

        if (!changed) continue;

        await reportPhotoRepository.save({
            ...current,
            caption,
            towerId: towerId || null,
            towerSource: towerId ? (current.towerSource || 'manual') : 'pending',
            includeInReport,
            curationStatus: (includeInReport && caption && towerId) ? 'curated'
                : (caption || towerId || includeInReport) ? 'reviewed'
                : (current.curationStatus || 'uploaded'),
            manualOverride: Boolean(towerId) || Boolean(current.manualOverride),
        }, { merge: true });
        flushed++;
    }
    return flushed;
}

function buildDefaultReportDefaults(projectId, data = {}) {
    return {
        projectId,
        faixaBufferMetersSide: Number.isFinite(Number(data.faixaBufferMetersSide))
            ? Number(data.faixaBufferMetersSide)
            : 200,
        towerSuggestionRadiusMeters: Number.isFinite(Number(data.towerSuggestionRadiusMeters))
            ? Number(data.towerSuggestionRadiusMeters)
            : 300,
        baseTowerRadiusMeters: Number.isFinite(Number(data.baseTowerRadiusMeters))
            ? Number(data.baseTowerRadiusMeters)
            : 30,
        textosBase: data.textosBase && typeof data.textosBase === 'object' ? data.textosBase : {},
        preferencias: data.preferencias && typeof data.preferencias === 'object' ? data.preferencias : {},
    };
}

function createMissingResourceError(message) {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
}

function normalizeCompoundOrder(workspaceIds = [], orderJson = []) {
    const normalizedWorkspaceIds = Array.isArray(workspaceIds)
        ? workspaceIds.map((item) => normalizeText(item)).filter(Boolean)
        : [];
    const normalizedOrder = Array.isArray(orderJson)
        ? orderJson.map((item) => normalizeText(item)).filter(Boolean)
        : [];
    const seen = new Set();
    const ordered = [];

    for (const workspaceId of normalizedOrder) {
        if (!normalizedWorkspaceIds.includes(workspaceId) || seen.has(workspaceId)) continue;
        seen.add(workspaceId);
        ordered.push(workspaceId);
    }

    for (const workspaceId of normalizedWorkspaceIds) {
        if (seen.has(workspaceId)) continue;
        seen.add(workspaceId);
        ordered.push(workspaceId);
    }

    return ordered;
}

async function resolveProjectDefaults(projectId) {
    if (!normalizeText(projectId)) return null;
    const current = await reportDefaultsRepository.getByProjectId(projectId);
    return buildDefaultReportDefaults(projectId, current || {});
}

async function buildProjectDossierContext(job) {
    const dossier = await projectDossierRepository.getById(job.dossierId);
    if (!dossier) {
        throw createMissingResourceError(`Dossie '${job.dossierId}' nao encontrado para o job.`);
    }

    const projectId = normalizeText(job.projectId || dossier.projectId).toUpperCase();
    const project = await projectRepository.getById(projectId);
    if (!project) {
        throw createMissingResourceError(`Empreendimento '${projectId}' nao encontrado para o job.`);
    }

    const scopeJson = dossier.scopeJson && typeof dossier.scopeJson === 'object' ? dossier.scopeJson : {};
    const sections = {
        licencas: scopeJson.includeLicencas ? await operatingLicenseRepository.listByProject(projectId) : [],
        inspecoes: scopeJson.includeInspecoes ? await inspectionRepository.listByProject(projectId) : [],
        erosoes: scopeJson.includeErosoes ? await erosionRepository.listByProject(projectId) : [],
        entregas: scopeJson.includeEntregas ? await reportDeliveryTrackingRepository.listByProject(projectId) : [],
        workspaces: scopeJson.includeWorkspaces ? await reportWorkspaceRepository.listByProject(projectId) : [],
        photos: scopeJson.includeFotos ? await reportPhotoRepository.listByProject(projectId) : [],
    };

    return {
        job,
        project,
        defaults: await resolveProjectDefaults(projectId),
        renderModel: {
            dossier: {
                id: dossier.id,
                nome: dossier.nome,
                observacoes: dossier.observacoes,
                scopeJson,
                lastJobId: dossier.lastJobId || job.id,
                outputDocxMediaId: dossier.outputDocxMediaId || '',
                lastError: dossier.lastError || '',
            },
            sections,
        },
    };
}

async function buildReportCompoundContext(job) {
    const compound = await reportCompoundRepository.getById(job.compoundId);
    if (!compound) {
        throw createMissingResourceError(`Relatorio composto '${job.compoundId}' nao encontrado para o job.`);
    }

    const orderedWorkspaceIds = normalizeCompoundOrder(compound.workspaceIds, compound.orderJson);
    const workspaces = [];

    for (const workspaceId of orderedWorkspaceIds) {
        const workspace = await reportWorkspaceRepository.getById(workspaceId);
        if (!workspace) continue;

        const projectId = normalizeText(workspace.projectId).toUpperCase();
        const [project, photos] = await Promise.all([
            projectRepository.getById(projectId),
            reportPhotoRepository.listByWorkspace(workspaceId),
        ]);

        workspaces.push({
            workspace,
            project: project || null,
            photos: photos.filter((photo) => photo.includeInReport === true),
            photoSortMode: normalizeText(workspace.photoSortMode) || 'tower_asc',
        });
    }

    return {
        job,
        project: null,
        defaults: null,
        renderModel: {
            compound: {
                id: compound.id,
                nome: compound.nome,
                sharedTextsJson: compound.sharedTextsJson && typeof compound.sharedTextsJson === 'object'
                    ? compound.sharedTextsJson
                    : {},
                orderJson: normalizeCompoundOrder(compound.workspaceIds, compound.orderJson),
                workspaceIds: Array.isArray(compound.workspaceIds) ? compound.workspaceIds : [],
                lastJobId: compound.lastJobId || job.id,
                outputDocxMediaId: compound.outputDocxMediaId || '',
                lastError: compound.lastError || '',
            },
            workspaces,
        },
    };
}

async function buildWorkspaceKmzContext(job) {
    const workspace = await reportWorkspaceRepository.getById(job.workspaceId);
    if (!workspace) {
        throw createMissingResourceError(`Workspace '${job.workspaceId}' nao encontrado para o job.`);
    }

    const projectId = normalizeText(job.projectId || workspace.projectId).toUpperCase();
    const project = await projectRepository.getById(projectId);
    if (!project) {
        throw createMissingResourceError(`Empreendimento '${projectId}' nao encontrado para o job.`);
    }

    const photos = await reportPhotoRepository.listByWorkspace(workspace.id);
    const requestToken = normalizeText(job.workspaceKmzToken);
    const kmzRequest = requestToken
        ? await workspaceKmzRequestRepository.getByToken(requestToken)
        : null;

    return {
        job,
        project,
        defaults: await resolveProjectDefaults(projectId),
        renderModel: {
            workspaceKmz: {
                token: requestToken,
                workspaceId: workspace.id,
                lastJobId: kmzRequest?.lastJobId || job.id,
                outputKmzMediaId: kmzRequest?.outputKmzMediaId || '',
                lastError: kmzRequest?.lastError || '',
                photoCount: photos.length,
            },
            workspace,
            photos,
        },
    };
}

function enrichErosionWithUtm(erosion) {
    const coords = normalizeLocationCoordinates(erosion);
    // If UTM is already present, use it; otherwise compute from decimal
    if (coords.utmEasting && coords.utmNorthing) {
        return {
            ...erosion,
            locationCoordinates: coords,
        };
    }
    const lat = Number(coords.latitude);
    const lon = Number(coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return {
            ...erosion,
            locationCoordinates: coords,
        };
    }
    const utm = convertDecimalToUtm(lat, lon);
    return {
        ...erosion,
        locationCoordinates: {
            ...coords,
            utmEasting: utm.easting ? String(Math.round(utm.easting)) : '',
            utmNorthing: utm.northing ? String(Math.round(utm.northing)) : '',
            utmZone: utm.zone ? String(utm.zone) : '',
            utmHemisphere: utm.hemisphere || '',
        },
    };
}

async function buildFichaCadastroContext(job) {
    const projectId = normalizeText(job.projectId).toUpperCase();
    const project = await projectRepository.getById(projectId);
    if (!project) {
        throw createMissingResourceError(`Empreendimento '${projectId}' nao encontrado para o job.`);
    }

    let erosions;
    const erosionIds = Array.isArray(job.erosionIds) ? job.erosionIds.filter(Boolean) : [];
    if (erosionIds.length > 0) {
        const all = await Promise.all(erosionIds.map((id) => erosionRepository.getById(id)));
        erosions = all.filter(Boolean);
    } else {
        erosions = await erosionRepository.listByProject(projectId);
    }

    const enrichedErosions = erosions.map((erosion) => enrichErosionWithUtm(erosion));

    return {
        job,
        project,
        defaults: await resolveProjectDefaults(projectId),
        renderModel: {
            fichaCadastro: {
                erosions: enrichedErosions,
            },
        },
    };
}

async function buildReportJobContext(jobId) {
    const job = await reportJobRepository.getById(jobId);
    if (!job) {
        throw createMissingResourceError(`Job '${jobId}' nao encontrado.`);
    }

    if (job.kind === 'project_dossier') {
        return buildProjectDossierContext(job);
    }

    if (job.kind === 'report_compound') {
        return buildReportCompoundContext(job);
    }

    if (job.kind === 'workspace_kmz') {
        return buildWorkspaceKmzContext(job);
    }

    if (job.kind === 'ficha_cadastro') {
        return buildFichaCadastroContext(job);
    }

    const error = new Error(`Nao existe contexto de renderizacao para jobs do tipo '${job.kind}'.`);
    error.statusCode = 422;
    throw error;
}

module.exports = {
    buildDefaultReportDefaults,
    buildReportJobContext,
    flushWorkspaceDraftsToPhotos,
};
