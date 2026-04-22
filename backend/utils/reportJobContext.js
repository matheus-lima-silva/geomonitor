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

function sortPhotosByMode(photos, mode) {
    const sorted = [...photos];
    switch (mode) {
        case 'tower_desc':
            sorted.sort((a, b) => {
                const tA = normalizeText(b.towerId);
                const tB = normalizeText(a.towerId);
                if (tA !== tB) return tA.localeCompare(tB, undefined, { numeric: true });
                return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
            });
            break;
        case 'tower_asc':
            sorted.sort((a, b) => {
                const tA = normalizeText(a.towerId);
                const tB = normalizeText(b.towerId);
                if (tA !== tB) return tA.localeCompare(tB, undefined, { numeric: true });
                return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
            });
            break;
        case 'capture_date_asc':
            sorted.sort((a, b) => {
                const dA = new Date(a.captureAt || a.createdAt || 0).getTime();
                const dB = new Date(b.captureAt || b.createdAt || 0).getTime();
                return dA - dB;
            });
            break;
        case 'capture_date_desc':
            sorted.sort((a, b) => {
                const dA = new Date(a.captureAt || a.createdAt || 0).getTime();
                const dB = new Date(b.captureAt || b.createdAt || 0).getTime();
                return dB - dA;
            });
            break;
        case 'caption_asc':
            sorted.sort((a, b) => normalizeText(a.caption).localeCompare(normalizeText(b.caption), undefined, { numeric: true }));
            break;
        case 'sort_order_asc':
        default:
            sorted.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
            break;
    }
    return sorted;
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

function parseTowerNumberForSort(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return Number.POSITIVE_INFINITY;
    if (/^t-?\d+$/.test(text)) {
        const parsed = Number(text.slice(1).replace(/^-/, ''));
        return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    }
    if (/^-?\d+$/.test(text)) {
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    }
    const match = text.match(/-?\d+/);
    if (!match) return Number.POSITIVE_INFINITY;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortErosionsByTower(erosions) {
    return [...erosions].sort((a, b) => {
        const tA = parseTowerNumberForSort(a?.torreRef);
        const tB = parseTowerNumberForSort(b?.torreRef);
        if (tA !== tB) return tA - tB;
        return normalizeText(a?.id).localeCompare(normalizeText(b?.id), undefined, { numeric: true });
    });
}

async function collectAnexoFichasErosions(shared, uniqueProjectIds) {
    const mode = normalizeText(shared?.anexoFichasMode).toLowerCase();
    if (!mode || mode === 'none') return [];

    if (mode === 'selected') {
        const ids = Array.isArray(shared?.anexoFichasErosionIds)
            ? shared.anexoFichasErosionIds.map((id) => normalizeText(id)).filter(Boolean)
            : [];
        if (ids.length === 0) return [];
        const fetched = await Promise.all(ids.map((id) => erosionRepository.getById(id)));
        return fetched.filter(Boolean);
    }

    if (mode === 'all') {
        const projectIds = Array.isArray(uniqueProjectIds) ? uniqueProjectIds : [];
        const chunks = await Promise.all(projectIds.map((pid) => erosionRepository.listByProject(pid)));
        return chunks.flat();
    }

    return [];
}

async function buildReportCompoundContext(job) {
    const compound = await reportCompoundRepository.getById(job.compoundId);
    if (!compound) {
        throw createMissingResourceError(`Relatorio composto '${job.compoundId}' nao encontrado para o job.`);
    }

    const orderedWorkspaceIds = normalizeCompoundOrder(compound.workspaceIds, compound.orderJson);

    // 1) Buscar todos os workspaces + fotos em paralelo, preservando ordem.
    const workspaceBundles = await Promise.all(orderedWorkspaceIds.map(async (workspaceId) => {
        const [workspace, photos] = await Promise.all([
            reportWorkspaceRepository.getById(workspaceId),
            reportPhotoRepository.listByWorkspace(workspaceId),
        ]);
        return { workspaceId, workspace, photos };
    }));

    // 2) Deduplicar projectIds e buscar cada projeto apenas uma vez.
    const uniqueProjectIds = Array.from(new Set(
        workspaceBundles
            .filter((entry) => entry.workspace)
            .map((entry) => normalizeText(entry.workspace.projectId).toUpperCase())
            .filter(Boolean),
    ));
    const projectEntries = await Promise.all(uniqueProjectIds.map(async (projectId) => {
        const project = await projectRepository.getById(projectId);
        return [projectId, project || null];
    }));
    const projectMap = new Map(projectEntries);

    // 3) Montar os bundles finais na ordem original.
    const workspaces = [];
    for (const entry of workspaceBundles) {
        if (!entry.workspace) continue;
        const projectId = normalizeText(entry.workspace.projectId).toUpperCase();
        const mode = normalizeText(entry.workspace.photoSortMode) || 'tower_asc';
        const included = (Array.isArray(entry.photos) ? entry.photos : []).filter(
            (photo) => photo.includeInReport === true,
        );
        workspaces.push({
            workspace: entry.workspace,
            project: projectMap.get(projectId) || null,
            photos: sortPhotosByMode(included, mode),
            photoSortMode: mode,
        });
    }

    // 4) Anexo de fichas de erosao simplificada (apos assinaturas).
    const sharedForFichas = compound.sharedTextsJson && typeof compound.sharedTextsJson === 'object'
        ? compound.sharedTextsJson
        : {};
    const rawAnexoErosions = await collectAnexoFichasErosions(sharedForFichas, uniqueProjectIds);
    const anexoErosions = sortErosionsByTower(rawAnexoErosions.map((erosion) => enrichErosionWithUtm(erosion)));
    const anexoProjectName = uniqueProjectIds.length > 0
        ? (normalizeText(projectMap.get(uniqueProjectIds[0])?.nome) || uniqueProjectIds[0])
        : '';
    const anexoFichas = anexoErosions.length > 0
        ? { erosions: anexoErosions, projectName: anexoProjectName }
        : null;

    return {
        job,
        project: null,
        defaults: null,
        renderModel: {
            compound: {
                id: compound.id,
                nome: compound.nome,
                sharedTextsJson: sharedForFichas,
                orderJson: normalizeCompoundOrder(compound.workspaceIds, compound.orderJson),
                workspaceIds: Array.isArray(compound.workspaceIds) ? compound.workspaceIds : [],
                lastJobId: compound.lastJobId || job.id,
                outputDocxMediaId: compound.outputDocxMediaId || '',
                lastError: compound.lastError || '',
                ...(anexoFichas ? { anexoFichas } : {}),
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
    sortPhotosByMode,
};
