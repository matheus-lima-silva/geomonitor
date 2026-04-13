import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { subscribeProjects } from '../../../services/projectService';
import {
  createProjectDossier,
  deleteProjectDossier,
  generateProjectDossier,
  listProjectDossiers,
  restoreProjectDossier,
  runProjectDossierPreflight,
  trashProjectDossier,
} from '../../../services/projectDossierService';
import { downloadProjectPhotoExport, listProjectPhotos, requestProjectPhotoExport } from '../../../services/projectPhotoLibraryService';
import {
  addWorkspaceToReportCompound,
  createReportCompound,
  deleteReportCompound,
  generateReportCompound,
  listReportCompounds,
  removeWorkspaceFromReportCompound,
  reorderReportCompound,
  restoreReportCompound,
  runReportCompoundPreflight,
  subscribeReportCompounds,
  trashReportCompound,
} from '../../../services/reportCompoundService';
import { completeMediaUpload, createMediaUpload, downloadMediaAsset, uploadMediaBinary } from '../../../services/mediaService';
import { getProjectTowerList } from '../../../utils/getProjectTowerList';
import {
  createReportWorkspace,
  deleteReportWorkspace,
  deleteReportWorkspacePhoto,
  emptyWorkspacePhotoTrash,
  getWorkspaceKmzRequest,
  importReportWorkspace,
  listReportWorkspacePhotos,
  listTrashedWorkspacePhotos,
  processWorkspaceKmz,
  reorderWorkspacePhotos,
  requestWorkspaceKmz,
  restoreReportWorkspace,
  restoreWorkspacePhoto,
  saveReportWorkspacePhoto,
  subscribeReportWorkspaces,
  trashReportWorkspace,
  trashWorkspacePhoto,
  updateReportWorkspace,
} from '../../../services/reportWorkspaceService';
import { listProfissoes, listSignatarios } from '../../../services/userService';
import {
  TABS,
  buildCompoundDownloadFileName,
  buildCompoundWorkspaceOrder,
  buildDefaultCaption,
  buildDefaultDossierScope,
  buildDossierDownloadFileName,
  buildProjectPhotoFilters,
  buildWorkspaceKmzDownloadFileName,
  buildWorkspacePhotoDraft,
  buildWorkspacePhotoDrafts,
  getPersistedWorkspaceCurationDrafts,
  getWorkspacePhotoStatus,
  inferTowerIdFromRelativePath,
  isPendingExecutionStatus,
  sanitizeDownloadName,
  triggerBlobDownload,
} from '../utils/reportUtils';
import BibliotecaTab from './BibliotecaTab';
import CompoundsTab from './CompoundsTab';
import DossierTab from './DossierTab';
import WorkspacesTab from './WorkspacesTab';

export default function ReportsView({ userEmail = '', showToast = () => {} }) {
  const [tab, setTab] = useState('workspaces');
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [compounds, setCompounds] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectPhotos, setProjectPhotos] = useState([]);
  const [projectDossiers, setProjectDossiers] = useState([]);
  const [projectDossierPreflights, setProjectDossierPreflights] = useState({});
  const [compoundPreflights, setCompoundPreflights] = useState({});
  const [compoundWorkspaceSelections, setCompoundWorkspaceSelections] = useState({});
  const [libraryFilters, setLibraryFilters] = useState({ workspaceId: '', towerId: '', captionQuery: '', dateFrom: '', dateTo: '' });
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  // Draft de criacao desacoplado do selectedProjectId
  const [workspaceDraft, setWorkspaceDraft] = useState({ projectId: '', nome: '', descricao: '' });
  const [dossierDraft, setDossierDraft] = useState({ nome: '', observacoes: '', scopeJson: buildDefaultDossierScope() });
  const [compoundDraft, setCompoundDraft] = useState({
    nome: '',
    nome_lt: '',
    titulo_programa: '',
    codigo_documento: '',
    revisao: '00',
    introducao: '',
    geologia: '',
    geotecnia: '',
    geomorfologia: '',
    descricao_atividades: '',
    conclusoes: '',
    analise_evolucao: '',
    observacoes: '',
    elaboradores: {},
    revisores: {},
  });
  const [profissoes, setProfissoes] = useState([]);
  const [signatariosCandidatos, setSignatariosCandidatos] = useState([]);
  const [workspaceTextsDraft, setWorkspaceTextsDraft] = useState({ introducao: '', observacoes: '' });
  const [workspaceImportTargetId, setWorkspaceImportTargetId] = useState('');
  const [workspaceImportMode, setWorkspaceImportMode] = useState('loose_photos');
  const [workspacePhotos, setWorkspacePhotos] = useState([]);
  const [workspacePhotoDrafts, setWorkspacePhotoDrafts] = useState({});
  const [workspaceKmzRequests, setWorkspaceKmzRequests] = useState({});
  const [workspaceAutosave, setWorkspaceAutosave] = useState({ status: 'idle', savedAt: '', error: '' });
  const [lastPersistedWorkspaceDraftSignature, setLastPersistedWorkspaceDraftSignature] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0, currentFileName: '' });
  const [trashedPhotos, setTrashedPhotos] = useState([]);
  const [activePreviewPhotoId, setActivePreviewPhotoId] = useState('');
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [photoPreviewLoading, setPhotoPreviewLoading] = useState({});
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState({});
  const [towerFilter, setTowerFilter] = useState('');
  const [photoSortMode, setPhotoSortMode] = useState('tower_asc');
  const [busy, setBusy] = useState('');

  const deletedPhotoIds = useMemo(() => trashedPhotos.map((p) => p.id), [trashedPhotos]);

  // ── Subscricoes ────────────────────────────────────────────────────────────

  useEffect(() => subscribeReportWorkspaces((rows) => setWorkspaces(rows || []), () => showToast('Erro ao carregar workspaces.', 'error')), [showToast]);
  useEffect(() => subscribeProjects((rows) => setProjects(rows || []), () => showToast('Erro ao carregar empreendimentos.', 'error')), [showToast]);
  useEffect(() => subscribeReportCompounds((rows) => setCompounds(rows || []), () => showToast('Erro ao carregar compostos.', 'error')), [showToast]);

  useEffect(() => {
    listProfissoes().then(setProfissoes).catch(() => {});
    listSignatarios().then(setSignatariosCandidatos).catch(() => {});
  }, []);

  // ── Defaults ao carregar projetos/workspaces ───────────────────────────────

  useEffect(() => {
    if (projects.length === 0) return;
    const fallbackId = String(projects[0]?.id || '');
    // Nao altera selectedProjectId aqui — apenas preenche o draft de criacao
    if (!workspaceDraft.projectId) setWorkspaceDraft((prev) => ({ ...prev, projectId: fallbackId }));
  }, [projects, workspaceDraft.projectId]);

  useEffect(() => {
    const candidates = workspaces.filter((workspace) => !selectedProjectId || workspace.projectId === selectedProjectId);
    const fallbackId = String(candidates[0]?.id || workspaces[0]?.id || '');
    if (!workspaceImportTargetId || !candidates.some((workspace) => workspace.id === workspaceImportTargetId)) {
      setWorkspaceImportTargetId(fallbackId);
    }
  }, [selectedProjectId, workspaceImportTargetId, workspaces]);

  useEffect(() => {
    setLibraryFilters({ workspaceId: '', towerId: '', captionQuery: '', dateFrom: '', dateTo: '' });
  }, [selectedProjectId]);

  // ── Dados dependentes do empreendimento ───────────────────────────────────

  const libraryQueryFilters = useMemo(() => buildProjectPhotoFilters(libraryFilters), [libraryFilters]);

  useEffect(() => {
    if (!selectedProjectId) { setProjectPhotos([]); return; }
    let cancelled = false;
    listProjectPhotos(selectedProjectId, libraryQueryFilters)
      .then((photos) => { if (!cancelled) setProjectPhotos(Array.isArray(photos) ? photos : []); })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar fotos do empreendimento.', 'error'));
    return () => { cancelled = true; };
  }, [libraryQueryFilters, selectedProjectId, showToast]);

  useEffect(() => {
    if (!selectedProjectId) { setProjectDossiers([]); setProjectDossierPreflights({}); return; }
    let cancelled = false;
    refreshProjectDossiers(selectedProjectId)
      .then((dossiers) => { if (!cancelled) { setProjectDossiers(Array.isArray(dossiers) ? dossiers : []); setProjectDossierPreflights({}); } })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar dados do empreendimento.', 'error'));
    return () => { cancelled = true; };
  }, [selectedProjectId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selecao de workspace ───────────────────────────────────────────────────

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceImportTargetId) || null,
    [workspaceImportTargetId, workspaces],
  );

  const selectedWorkspaceProject = useMemo(
    () => projects.find((project) => project.id === selectedWorkspace?.projectId) || null,
    [projects, selectedWorkspace],
  );

  // ── Fotos do workspace ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceImportTargetId) {
      setWorkspacePhotos([]);
      setWorkspacePhotoDrafts({});
      setLastPersistedWorkspaceDraftSignature('');
      setTowerFilter('');
      setPhotoSortMode('tower_asc');
      setWorkspaceTextsDraft({ introducao: '', observacoes: '' });
      setWorkspaceAutosave({ status: 'idle', savedAt: '', error: '' });
      return;
    }
    let cancelled = false;
    listReportWorkspacePhotos(workspaceImportTargetId)
      .then((photos) => {
        if (cancelled) return;
        const nextPhotos = Array.isArray(photos) ? photos : [];
        const nextDrafts = buildWorkspacePhotoDrafts(nextPhotos, getPersistedWorkspaceCurationDrafts(selectedWorkspace));
        setWorkspacePhotos(nextPhotos);
        setWorkspacePhotoDrafts(nextDrafts);
        setLastPersistedWorkspaceDraftSignature(JSON.stringify(nextDrafts));
        setPhotoSortMode(String(selectedWorkspace?.photoSortMode || 'tower_asc').trim() || 'tower_asc');
        setWorkspaceAutosave({
          status: selectedWorkspace?.draftState?.autosave?.savedAt ? 'saved' : 'idle',
          savedAt: String(selectedWorkspace?.draftState?.autosave?.savedAt || ''),
          error: '',
        });
      })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar fotos do workspace.', 'error'));
    listTrashedWorkspacePhotos(workspaceImportTargetId)
      .then((photos) => { if (!cancelled) setTrashedPhotos(Array.isArray(photos) ? photos : []); })
      .catch(() => { if (!cancelled) setTrashedPhotos([]); });
    return () => { cancelled = true; };
  }, [workspaceImportTargetId, selectedWorkspace, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTrashedPhotos([]);
    setActivePreviewPhotoId('');
    setPhotoPreviewLoading({});
    setPhotoPreviewFailed({});
    setPhotoPreviewUrls((prev) => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        Object.values(prev).forEach((url) => { if (url) URL.revokeObjectURL(url); });
      }
      return {};
    });
  }, [workspaceImportTargetId]);

  useEffect(() => {
    setWorkspaceTextsDraft({
      introducao: selectedWorkspace?.texts?.introducao || '',
      observacoes: selectedWorkspace?.texts?.observacoes || '',
    });
  }, [selectedWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Metricas ───────────────────────────────────────────────────────────────

  const metrics = useMemo(() => ({
    total: projectPhotos.length,
    included: projectPhotos.filter((photo) => photo.includeInReport).length,
    missingCaption: projectPhotos.filter((photo) => !String(photo.caption || '').trim()).length,
    missingTower: projectPhotos.filter((photo) => !String(photo.towerId || '').trim()).length,
  }), [projectPhotos]);

  const workspaceCandidates = useMemo(
    () => workspaces.filter((workspace) => !selectedProjectId || workspace.projectId === selectedProjectId),
    [selectedProjectId, workspaces],
  );

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.nome || a.id).localeCompare(b.nome || b.id, 'pt-BR', { sensitivity: 'base' })),
    [projects],
  );

  const projectOptions = useMemo(
    () => sortedProjects.map((p) => ({ value: p.id, label: `${p.id} - ${p.nome || p.id}` })),
    [sortedProjects],
  );

  const projectNamesById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.nome || project.id])),
    [projects],
  );

  const workspaceLabelsById = useMemo(
    () => new Map(workspaces.map((workspace) => {
      const projectName = projectNamesById.get(workspace.projectId);
      const workspaceLabel = workspace.nome || workspace.id;
      return [workspace.id, projectName ? `${workspaceLabel} - ${projectName}` : workspaceLabel];
    })),
    [projectNamesById, workspaces],
  );

  const filteredWorkspaceList = useMemo(() => {
    const q = workspaceSearchQuery.trim().toLowerCase();
    return workspaces.filter((ws) => {
      if (selectedProjectId && ws.projectId !== selectedProjectId) return false;
      if (!q) return true;
      return (
        (ws.nome || '').toLowerCase().includes(q) ||
        (ws.descricao || '').toLowerCase().includes(q) ||
        (ws.projectId || '').toLowerCase().includes(q)
      );
    });
  }, [workspaces, selectedProjectId, workspaceSearchQuery]);

  const projectTowerOptions = useMemo(() => getProjectTowerList(selectedProject), [selectedProject]);

  const libraryTowerOptions = useMemo(
    () => Array.from(new Set([
      ...projectTowerOptions,
      ...projectPhotos.map((photo) => String(photo.towerId || '').trim()).filter(Boolean),
    ])),
    [projectPhotos, projectTowerOptions],
  );

  const workspaceTowerOptions = useMemo(() => getProjectTowerList(selectedWorkspaceProject), [selectedWorkspaceProject]);

  const workspaceMetrics = useMemo(() => {
    const rows = workspacePhotos.map((photo) => ({
      ...photo,
      ...(workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo)),
    }));
    return {
      total: rows.length,
      included: rows.filter((photo) => photo.includeInReport).length,
      missingCaption: rows.filter((photo) => !String(photo.caption || '').trim()).length,
      missingTower: rows.filter((photo) => !String(photo.towerId || '').trim()).length,
    };
  }, [workspacePhotoDrafts, workspacePhotos]);

  const visibleWorkspacePhotos = useMemo(
    () => workspacePhotos.filter((photo) => !deletedPhotoIds.includes(photo.id)),
    [deletedPhotoIds, workspacePhotos],
  );

  const photoCountsByTower = useMemo(() => {
    const counts = {};
    for (const photo of visibleWorkspacePhotos) {
      const draft = workspacePhotoDrafts[photo.id];
      const tower = (draft?.towerId || photo.towerId || '').trim();
      counts[tower || '__none__'] = (counts[tower || '__none__'] || 0) + 1;
    }
    return counts;
  }, [visibleWorkspacePhotos, workspacePhotoDrafts]);

  const filteredWorkspacePhotos = useMemo(() => {
    if (!towerFilter) return visibleWorkspacePhotos;
    return visibleWorkspacePhotos.filter((photo) => {
      const draft = workspacePhotoDrafts[photo.id];
      const tower = (draft?.towerId || photo.towerId || '').trim();
      if (towerFilter === '__none__') return !tower;
      return tower === towerFilter;
    });
  }, [visibleWorkspacePhotos, workspacePhotoDrafts, towerFilter]);

  const workspaceCurationSummary = useMemo(() => {
    const rows = workspacePhotos.map((photo) => ({
      ...photo,
      ...(workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo)),
    }));
    const reviewed = rows.filter((photo) => {
      const status = getWorkspacePhotoStatus(photo, photo);
      return status === 'reviewed' || status === 'curated';
    }).length;
    const curated = rows.filter((photo) => getWorkspacePhotoStatus(photo, photo) === 'curated').length;
    const total = rows.length;
    const pending = Math.max(total - reviewed, 0);
    const completionPercent = total > 0 ? Math.round((curated / total) * 100) : 0;
    return { reviewed, curated, pending, completionPercent };
  }, [workspacePhotoDrafts, workspacePhotos]);

  const uploadPercent = uploadProgress.total > 0
    ? Math.min(100, Math.round((uploadProgress.completed / uploadProgress.total) * 100))
    : 0;

  // ── Preview de fotos ───────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;
    const pendingPreviews = visibleWorkspacePhotos.filter((photo) => {
      const mediaAssetId = String(photo.mediaAssetId || '').trim();
      return mediaAssetId && !photoPreviewUrls[photo.id] && !photoPreviewLoading[photo.id] && !photoPreviewFailed[photo.id];
    });
    if (pendingPreviews.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      for (const photo of pendingPreviews) {
        if (cancelled) break;
        const mediaAssetId = String(photo.mediaAssetId || '').trim();
        if (!mediaAssetId) continue;
        setPhotoPreviewLoading((prev) => ({ ...prev, [photo.id]: true }));
        try {
          const result = await downloadMediaAsset(mediaAssetId);
          if (cancelled) break;
          const blob = result?.blob;
          const previewUrl = URL.createObjectURL(blob);
          setPhotoPreviewUrls((prev) => {
            const previousUrl = prev[photo.id];
            if (previousUrl && previousUrl !== previewUrl && typeof URL.revokeObjectURL === 'function') {
              URL.revokeObjectURL(previousUrl);
            }
            return { ...prev, [photo.id]: previewUrl };
          });
          setPhotoPreviewFailed((prev) => {
            if (!prev[photo.id]) return prev;
            const next = { ...prev };
            delete next[photo.id];
            return next;
          });
        } catch {
          setPhotoPreviewFailed((prev) => ({ ...prev, [photo.id]: true }));
        } finally {
          if (!cancelled) setPhotoPreviewLoading((prev) => ({ ...prev, [photo.id]: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [photoPreviewFailed, visibleWorkspacePhotos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autosave ───────────────────────────────────────────────────────────────

  const workspaceDraftSnapshot = useMemo(
    () => Object.fromEntries(workspacePhotos.map((photo) => [photo.id, workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo)])),
    [workspacePhotoDrafts, workspacePhotos],
  );

  const workspaceDraftSignature = useMemo(() => JSON.stringify(workspaceDraftSnapshot), [workspaceDraftSnapshot]);

  useEffect(() => {
    if (!selectedWorkspace || workspacePhotos.length === 0) return undefined;
    if (workspaceDraftSignature === lastPersistedWorkspaceDraftSignature) return undefined;

    setWorkspaceAutosave((prev) => ({
      status: prev.status === 'saving' ? prev.status : 'pending',
      savedAt: prev.savedAt,
      error: '',
    }));

    const timeoutId = window.setTimeout(async () => {
      const savedAt = new Date().toISOString();
      const nextDraftState = {
        ...(selectedWorkspace.draftState || {}),
        curationDrafts: workspaceDraftSnapshot,
        autosave: { status: 'saved', savedAt, photoCount: workspacePhotos.length },
      };
      setWorkspaceAutosave({ status: 'saving', savedAt: '', error: '' });
      try {
        const result = await updateReportWorkspace(selectedWorkspace.id, { draftState: nextDraftState }, { updatedBy: userEmail || 'web' });
        setWorkspaces((prev) => prev.map((workspace) => (
          workspace.id === selectedWorkspace.id ? { ...workspace, ...(result?.data || {}), draftState: nextDraftState } : workspace
        )));
        setLastPersistedWorkspaceDraftSignature(workspaceDraftSignature);
        setWorkspaceAutosave({ status: 'saved', savedAt, error: '' });
      } catch (error) {
        setWorkspaceAutosave({ status: 'error', savedAt: '', error: error?.message || 'Erro ao autosalvar rascunho do workspace.' });
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [lastPersistedWorkspaceDraftSignature, selectedWorkspace, userEmail, workspaceDraftSignature, workspaceDraftSnapshot, workspacePhotos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling de status ──────────────────────────────────────────────────────

  const hasPendingReportOutputs = useMemo(
    () => projectDossiers.some((dossier) => isPendingExecutionStatus(dossier.status))
      || compounds.some((compound) => isPendingExecutionStatus(compound.status))
      || Object.values(workspaceKmzRequests).some((requestEntry) => isPendingExecutionStatus(requestEntry?.statusExecucao)),
    [compounds, projectDossiers, workspaceKmzRequests],
  );

  useEffect(() => {
    if (!hasPendingReportOutputs) return undefined;
    let cancelled = false;
    const runRefresh = async () => {
      try {
        if (selectedProjectId) {
          const dossiers = await listProjectDossiers(selectedProjectId);
          if (!cancelled) setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
        }
        const nextCompounds = await listReportCompounds();
        if (!cancelled) setCompounds(Array.isArray(nextCompounds) ? nextCompounds : []);
        const pendingKmzRequests = Object.entries(workspaceKmzRequests)
          .filter(([, requestEntry]) => requestEntry?.token && isPendingExecutionStatus(requestEntry?.statusExecucao));
        if (pendingKmzRequests.length > 0) {
          const refreshedRequests = await Promise.all(
            pendingKmzRequests.map(async ([workspaceId, requestEntry]) => {
              const result = await getWorkspaceKmzRequest(workspaceId, requestEntry.token);
              return [workspaceId, result?.data || requestEntry];
            }),
          );
          if (!cancelled) setWorkspaceKmzRequests((prev) => ({ ...prev, ...Object.fromEntries(refreshedRequests) }));
        }
      } catch (error) {
        if (!cancelled) showToast(error?.message || 'Erro ao atualizar status dos relatorios.', 'error');
      }
    };
    const intervalId = window.setInterval(runRefresh, 5000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [hasPendingReportOutputs, selectedProjectId, showToast, workspaceKmzRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers de refresh ─────────────────────────────────────────────────────

  async function refreshWorkspacePhotos(workspaceId) {
    if (!workspaceId) { setWorkspacePhotos([]); setWorkspacePhotoDrafts({}); return []; }
    const photos = await listReportWorkspacePhotos(workspaceId);
    const nextPhotos = Array.isArray(photos) ? photos : [];
    const workspace = workspaces.find((item) => item.id === workspaceId) || null;
    const nextDrafts = buildWorkspacePhotoDrafts(nextPhotos, getPersistedWorkspaceCurationDrafts(workspace));
    setWorkspacePhotos(nextPhotos);
    setWorkspacePhotoDrafts(nextDrafts);
    return nextPhotos;
  }

  async function refreshTrashedPhotos(workspaceId) {
    if (!workspaceId) { setTrashedPhotos([]); return; }
    try {
      const photos = await listTrashedWorkspacePhotos(workspaceId);
      setTrashedPhotos(Array.isArray(photos) ? photos : []);
    } catch {
      setTrashedPhotos([]);
    }
  }

  async function refreshProjectPhotos(projectId) {
    if (!projectId) { setProjectPhotos([]); return []; }
    const photos = await listProjectPhotos(projectId, libraryQueryFilters);
    const nextPhotos = Array.isArray(photos) ? photos : [];
    setProjectPhotos(nextPhotos);
    return nextPhotos;
  }

  async function refreshProjectDossiers(projectId) {
    if (!projectId) { setProjectDossiers([]); return []; }
    const dossiers = await listProjectDossiers(projectId);
    const nextDossiers = Array.isArray(dossiers) ? dossiers : [];
    setProjectDossiers(nextDossiers);
    return nextDossiers;
  }

  async function refreshCompounds() {
    const rows = await listReportCompounds();
    const nextRows = Array.isArray(rows) ? rows : [];
    setCompounds(nextRows);
    return nextRows;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleCreateWorkspace() {
    if (!workspaceDraft.projectId || !String(workspaceDraft.nome || '').trim()) {
      showToast('Selecione um empreendimento e informe um nome para o workspace.', 'error');
      return;
    }
    try {
      setBusy('workspace');
      await createReportWorkspace({
        id: `RW-${Date.now()}`,
        projectId: workspaceDraft.projectId,
        nome: workspaceDraft.nome.trim(),
        descricao: String(workspaceDraft.descricao || '').trim(),
        status: 'draft',
        slots: [],
        draftState: { autosave: 'pending' },
      }, { updatedBy: userEmail || 'web' });
      setWorkspaceDraft((prev) => ({ ...prev, nome: '', descricao: '' }));
      showToast('Workspace criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function uploadWorkspaceFile(file, workspace, index, importSource, metadata = {}) {
    const createResult = await createMediaUpload({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      purpose: metadata.purpose || 'workspace-photo',
      linkedResourceType: 'reportWorkspaces',
      linkedResourceId: workspace.id,
    }, { updatedBy: userEmail || 'web' });

    const mediaAsset = createResult?.data;
    await uploadMediaBinary(mediaAsset?.upload, file);
    await completeMediaUpload({ id: mediaAsset?.id, storedSizeBytes: file.size }, { updatedBy: userEmail || 'web' });

    if (metadata.skipPhotoRegistration) return { mediaAssetId: mediaAsset?.id, photoId: null };

    const photoId = `RPH-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
    const inferredTowerId = metadata.inferredTowerId || '';
    await saveReportWorkspacePhoto(workspace.id, photoId, {
      mediaAssetId: mediaAsset?.id,
      caption: buildDefaultCaption(file.name),
      includeInReport: false,
      curationStatus: inferredTowerId ? 'reviewed' : 'uploaded',
      importSource,
      towerId: inferredTowerId || undefined,
      towerSource: inferredTowerId ? 'folder_path' : 'pending',
    }, { updatedBy: userEmail || 'web' });

    return { mediaAssetId: mediaAsset?.id, photoId };
  }

  async function handleImportWorkspace() {
    if (!workspaceImportTargetId) { showToast('Selecione um workspace para importar as fotos.', 'error'); return; }
    if (pendingFiles.length === 0) { showToast('Selecione ao menos um arquivo para importar.', 'error'); return; }
    const workspace = workspaces.find((item) => item.id === workspaceImportTargetId);
    if (!workspace) { showToast('Workspace alvo nao encontrado.', 'error'); return; }

    try {
      setBusy('workspace-import');
      setUploadProgress({ total: pendingFiles.length, completed: 0, currentFileName: String(pendingFiles[0]?.name || '') });
      const uploadedMediaIds = [];
      const warnings = [];

      if (workspaceImportMode === 'organized_kmz') {
        const kmzFile = pendingFiles[0];
        setUploadProgress({ total: 1, completed: 0, currentFileName: String(kmzFile?.name || '') });
        const uploaded = await uploadWorkspaceFile(kmzFile, workspace, 0, 'organized_kmz', { purpose: 'workspace-import', skipPhotoRegistration: true });
        uploadedMediaIds.push(uploaded.mediaAssetId);
        setUploadProgress({ total: 1, completed: 1, currentFileName: String(kmzFile?.name || '') });
        const processResult = await processWorkspaceKmz(workspace.id, { mediaAssetId: uploaded.mediaAssetId }, { updatedBy: userEmail || 'web' });
        const summary = processResult?.data?.summary || {};
        if (Array.isArray(summary.warnings)) warnings.push(...summary.warnings);
        const parts = [];
        if (summary.photosCreated > 0) parts.push(`${summary.photosCreated} foto(s) importada(s)`);
        if (summary.towersInferred > 0) parts.push(`${summary.towersInferred} torre(s) inferida(s)`);
        if (summary.pendingLinkage > 0) parts.push(`${summary.pendingLinkage} pendente(s)`);
        if (summary.photosSkipped > 0) parts.push(`${summary.photosSkipped} duplicada(s) ignorada(s)`);
        showToast(parts.length > 0 ? `KMZ processado: ${parts.join(', ')}.` : 'KMZ processado (nenhuma foto encontrada).', 'success');
      } else {
        let inferredTowerCount = 0;
        let pendingTowerCount = 0;
        for (const [index, file] of pendingFiles.entries()) {
          setUploadProgress({ total: pendingFiles.length, completed: index, currentFileName: String(file?.name || '') });
          const inferredTowerId = workspaceImportMode === 'tower_subfolders' ? inferTowerIdFromRelativePath(file.webkitRelativePath || file.name) : '';
          const uploaded = await uploadWorkspaceFile(file, workspace, index, workspaceImportMode, { inferredTowerId });
          uploadedMediaIds.push(uploaded.mediaAssetId);
          setUploadProgress({ total: pendingFiles.length, completed: index + 1, currentFileName: String(file?.name || '') });
          if (inferredTowerId) inferredTowerCount += 1;
          else if (workspaceImportMode === 'tower_subfolders') pendingTowerCount += 1;
        }
        if (workspaceImportMode === 'tower_subfolders' && pendingTowerCount > 0) {
          warnings.push(`${pendingTowerCount} foto(s) ficaram sem torre inferida pelas subpastas.`);
        }
        await importReportWorkspace(workspace.id, {
          sourceType: workspaceImportMode,
          importSource: workspaceImportMode,
          warnings,
          summaryJson: { filesReceived: pendingFiles.length, uploadedMediaIds, inferredTowerCount, pendingTowerCount },
        }, { updatedBy: userEmail || 'web' });
        showToast(
          workspaceImportMode === 'tower_subfolders'
            ? `Importacao concluida para ${uploadedMediaIds.length} foto(s), com ${inferredTowerCount} torre(s) inferida(s).`
            : `Upload concluido para ${uploadedMediaIds.length} foto(s).`,
          'success',
        );
      }

      await refreshWorkspacePhotos(workspace.id);
      if (workspace.projectId) {
        await refreshProjectPhotos(workspace.projectId);
        if (!selectedProjectId) setSelectedProjectId(workspace.projectId);
      }
      setPendingFiles([]);
    } catch (error) {
      showToast(error?.message || 'Erro ao importar arquivos para o workspace.', 'error');
    } finally {
      setUploadProgress({ total: 0, completed: 0, currentFileName: '' });
      setBusy('');
    }
  }

  async function handleSaveWorkspacePhoto(photo) {
    const draft = workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo);
    const workspace = selectedWorkspace;
    if (!workspace) { showToast('Selecione um workspace valido para salvar a curadoria.', 'error'); return; }
    try {
      setBusy(`photo:${photo.id}`);
      const nextTowerId = String(draft.towerId || '').trim();
      const nextData = {
        caption: String(draft.caption || '').trim(),
        towerId: nextTowerId || null,
        towerSource: nextTowerId ? 'manual' : 'pending',
        includeInReport: Boolean(draft.includeInReport),
        curationStatus: getWorkspacePhotoStatus(photo, draft),
        manualOverride: Boolean(nextTowerId),
      };
      const result = await saveReportWorkspacePhoto(workspace.id, photo.id, nextData, { updatedBy: userEmail || 'web' });
      const savedPhoto = result?.data || { ...photo, ...nextData };
      setWorkspacePhotos((prev) => prev.map((item) => (item.id === photo.id ? savedPhoto : item)));
      setWorkspacePhotoDrafts((prev) => ({ ...prev, [photo.id]: buildWorkspacePhotoDraft(savedPhoto) }));
      setProjectPhotos((prev) => prev.map((item) => (item.id === photo.id ? savedPhoto : item)));
      showToast('Curadoria da foto salva.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar curadoria da foto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleMovePhotoToTrash(photoId) {
    const normalizedPhotoId = String(photoId || '').trim();
    if (!normalizedPhotoId || !selectedWorkspace) return;
    if (activePreviewPhotoId === normalizedPhotoId) setActivePreviewPhotoId('');
    try {
      setBusy(`photo-trash:${normalizedPhotoId}`);
      await trashWorkspacePhoto(selectedWorkspace.id, normalizedPhotoId);
      const trashedPhoto = workspacePhotos.find((p) => p.id === normalizedPhotoId);
      if (trashedPhoto) {
        setTrashedPhotos((prev) => [{ ...trashedPhoto, deletedAt: new Date().toISOString() }, ...prev]);
      }
      setWorkspacePhotos((prev) => prev.filter((p) => p.id !== normalizedPhotoId));
      showToast('Foto movida para lixeira.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao mover foto para lixeira.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRestorePhoto(photo) {
    if (!photo?.id || !selectedWorkspace) return;
    try {
      setBusy(`photo-restore:${photo.id}`);
      await restoreWorkspacePhoto(selectedWorkspace.id, photo.id);
      setTrashedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      await refreshWorkspacePhotos(selectedWorkspace.id);
      showToast('Foto restaurada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao restaurar foto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRestoreAllTrashedPhotos() {
    if (!selectedWorkspace || trashedPhotos.length === 0) return;
    setBusy('restore-all-photos');
    let successCount = 0;
    for (const photo of trashedPhotos) {
      try {
        await restoreWorkspacePhoto(selectedWorkspace.id, photo.id);
        successCount++;
      } catch (error) {
        console.error('Falha ao restaurar foto', photo.id, error);
      }
    }
    setBusy('');
    if (successCount > 0) {
      showToast(`${successCount} foto(s) restaurada(s).`, 'success');
      setTrashedPhotos([]);
      await refreshWorkspacePhotos(selectedWorkspace.id);
    }
  }

  async function handleEmptyPhotoTrash() {
    if (!selectedWorkspace || trashedPhotos.length === 0) return;
    setBusy('empty-trash');
    try {
      const result = await emptyWorkspacePhotoTrash(selectedWorkspace.id);
      const count = result?.data?.count || trashedPhotos.length;
      showToast(`${count} foto(s) removida(s) permanentemente.`, 'success');
      setTrashedPhotos([]);
    } catch (error) {
      showToast(error?.message || 'Erro ao esvaziar lixeira.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleSaveWorkspaceTexts() {
    if (!selectedWorkspace?.id) return;
    try {
      setBusy('workspace-texts');
      await updateReportWorkspace(selectedWorkspace.id, { texts: workspaceTextsDraft }, { updatedBy: userEmail || 'web' });
      showToast('Textos do workspace salvos.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar textos do workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handlePhotoSortModeChange(mode) {
    setPhotoSortMode(mode);
    if (!selectedWorkspace) return;
    try {
      setBusy('reorder');
      await reorderWorkspacePhotos(selectedWorkspace.id, mode, { updatedBy: userEmail || 'web' });
      await refreshWorkspacePhotos(selectedWorkspace.id);
      showToast('Ordenacao aplicada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao reordenar fotos.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRequestWorkspaceKmz() {
    if (!selectedWorkspace?.id) { showToast('Selecione um workspace para gerar o KMZ.', 'error'); return; }
    try {
      setBusy('workspace-kmz');
      const result = await requestWorkspaceKmz(selectedWorkspace.id, { updatedBy: userEmail || 'web' });
      const requestEntry = result?.data || {};
      setWorkspaceKmzRequests((prev) => ({ ...prev, [selectedWorkspace.id]: requestEntry }));
      showToast('KMZ com fotos enfileirado para o workspace atual.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao solicitar KMZ do workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDownloadWorkspaceKmz(requestEntry) {
    const mediaId = String(requestEntry?.outputKmzMediaId || '').trim();
    if (!mediaId || !selectedWorkspace?.id) { showToast('O KMZ ainda nao esta pronto para download.', 'error'); return; }
    try {
      setBusy(`download:${mediaId}`);
      const result = await downloadMediaAsset(mediaId);
      triggerBlobDownload(buildWorkspaceKmzDownloadFileName(selectedWorkspace, requestEntry), result.blob);
    } catch (error) {
      showToast(error?.message || 'Erro ao baixar KMZ do workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  function handleExportCaptions(format) {
    const rows = visibleWorkspacePhotos.map((photo) => {
      const draft = workspacePhotoDrafts[photo.id] || {};
      return {
        id: photo.id,
        tower: draft.towerId || photo.towerId || '',
        caption: draft.caption || photo.caption || '',
        included: draft.includeInReport ?? photo.includeInReport ?? false,
      };
    });
    let content, mimeType, ext;
    if (format === 'csv') {
      content = 'ID,Torre,Legenda,No Relatorio\n' + rows.map((r) => `"${r.id}","${r.tower}","${r.caption.replace(/"/g, '""')}",${r.included}`).join('\n');
      mimeType = 'text/csv;charset=utf-8';
      ext = 'csv';
    } else {
      content = '| ID | Torre | Legenda | No Relatorio |\n|---|---|---|---|\n' + rows.map((r) => `| ${r.id} | ${r.tower} | ${r.caption} | ${r.included ? 'Sim' : 'Nao'} |`).join('\n');
      mimeType = 'text/markdown;charset=utf-8';
      ext = 'md';
    }
    const blob = new Blob([content], { type: mimeType });
    const name = (selectedWorkspace?.nome || selectedWorkspace?.id || 'workspace').replace(/\s+/g, '_');
    triggerBlobDownload(`${name}-legendas.${ext}`, blob);
  }

  async function handleCreateDossier() {
    if (!selectedProjectId || !String(dossierDraft.nome || '').trim()) {
      showToast('Selecione um empreendimento e informe um nome para o dossie.', 'error');
      return;
    }
    try {
      setBusy('dossier');
      await createProjectDossier(selectedProjectId, {
        nome: dossierDraft.nome.trim(),
        observacoes: String(dossierDraft.observacoes || '').trim(),
        scopeJson: dossierDraft.scopeJson,
        draftState: { autosave: 'pending' },
      }, { updatedBy: userEmail || 'web' });
      setDossierDraft({ nome: '', observacoes: '', scopeJson: buildDefaultDossierScope() });
      await refreshProjectDossiers(selectedProjectId);
      setProjectDossierPreflights({});
      showToast('Dossie criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDossierPreflight(dossier) {
    if (!selectedProjectId || !dossier?.id) return;
    try {
      setBusy(`dossier-preflight:${dossier.id}`);
      const result = await runProjectDossierPreflight(selectedProjectId, dossier.id);
      setProjectDossierPreflights((prev) => ({ ...prev, [dossier.id]: result?.data || null }));
      showToast('Preflight do dossie executado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao executar preflight do dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDossierGenerate(dossier) {
    if (!selectedProjectId || !dossier?.id) return;
    try {
      setBusy(`dossier-generate:${dossier.id}`);
      const result = await generateProjectDossier(selectedProjectId, dossier.id);
      const savedDossier = result?.data;
      if (savedDossier?.id) {
        setProjectDossiers((prev) => prev.map((item) => (item.id === savedDossier.id ? savedDossier : item)));
      } else {
        await refreshProjectDossiers(selectedProjectId);
      }
      showToast('Geracao do dossie enfileirada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao enfileirar geracao do dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDownloadReportOutput(mediaId, fileName) {
    if (!mediaId) return;
    try {
      setBusy(`download:${mediaId}`);
      const result = await downloadMediaAsset(mediaId);
      const downloaded = triggerBlobDownload(fileName || sanitizeDownloadName(`relatorio-${mediaId}.docx`), result?.blob);
      if (!downloaded) throw new Error('Ambiente sem suporte para disparar o download.');
      showToast('DOCX baixado com sucesso.', 'success', 4500);
    } catch (error) {
      showToast(error?.message || 'Erro ao baixar o DOCX final.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCreateCompound() {
    if (!String(compoundDraft.nome || '').trim()) { showToast('Informe um nome para o relatorio composto.', 'error'); return; }
    try {
      setBusy('compound');
      const trimField = (key) => String(compoundDraft[key] || '').trim();
      const profLookup = Object.fromEntries(profissoes.map((p) => [p.id, p.nome]));
      const buildSignatarySnapshot = (sigId) => {
        const sig = signatariosCandidatos.find((s) => s.id === sigId);
        if (!sig) return null;
        const registro = [
          sig.registro_conselho && sig.registro_estado ? `${sig.registro_conselho}-${sig.registro_estado}` : sig.registro_conselho || '',
          sig.registro_numero ? (sig.registro_sufixo ? `${sig.registro_numero}/${sig.registro_sufixo}` : sig.registro_numero) : '',
        ].filter(Boolean).join(' ');
        return { nome: sig.nome || '', profissao: profLookup[sig.profissao_id] || sig.profissao_nome || '', registro };
      };
      const elaboradoresArr = Object.entries(compoundDraft.elaboradores || {}).filter(([, v]) => v).map(([id]) => buildSignatarySnapshot(id)).filter(Boolean);
      const revisoresArr = Object.entries(compoundDraft.revisores || {}).filter(([, v]) => v).map(([id]) => buildSignatarySnapshot(id)).filter(Boolean);
      await createReportCompound({
        id: `RC-${Date.now()}`,
        nome: compoundDraft.nome.trim(),
        sharedTextsJson: {
          nome_lt: trimField('nome_lt'), titulo_programa: trimField('titulo_programa'),
          codigo_documento: trimField('codigo_documento'), revisao: trimField('revisao') || '00',
          introducao: trimField('introducao'),
          geologia: trimField('geologia'), geotecnia: trimField('geotecnia'), geomorfologia: trimField('geomorfologia'),
          descricao_atividades: trimField('descricao_atividades'), conclusoes: trimField('conclusoes'),
          analise_evolucao: trimField('analise_evolucao'), observacoes: trimField('observacoes'),
          elaboradores: elaboradoresArr, revisores: revisoresArr,
        },
        status: 'draft', workspaceIds: [], orderJson: [],
      }, { updatedBy: userEmail || 'web' });
      setCompoundDraft({
        nome: '', nome_lt: '', titulo_programa: '', codigo_documento: '', revisao: '00',
        introducao: '', geologia: '', geotecnia: '', geomorfologia: '', descricao_atividades: '',
        conclusoes: '', analise_evolucao: '', observacoes: '', elaboradores: {}, revisores: {},
      });
      await refreshCompounds();
      showToast('Relatorio composto criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundAddWorkspace(compound) {
    const workspaceId = String(compoundWorkspaceSelections[compound?.id] || '').trim();
    if (!compound?.id || !workspaceId) { showToast('Selecione um workspace para adicionar ao relatorio composto.', 'error'); return; }
    try {
      setBusy(`compound-add:${compound.id}`);
      const result = await addWorkspaceToReportCompound(compound.id, workspaceId, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      setCompoundWorkspaceSelections((prev) => ({ ...prev, [compound.id]: '' }));
      setCompoundPreflights((prev) => { const next = { ...prev }; delete next[compound.id]; return next; });
      showToast('Workspace adicionado ao relatorio composto.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao adicionar workspace ao relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundPreflight(compound) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-preflight:${compound.id}`);
      const result = await runReportCompoundPreflight(compound.id);
      setCompoundPreflights((prev) => ({ ...prev, [compound.id]: result?.data || null }));
      showToast('Preflight do relatorio composto executado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao executar preflight do relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundGenerate(compound) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-generate:${compound.id}`);
      const result = await generateReportCompound(compound.id);
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      else await refreshCompounds();
      showToast('Geracao do relatorio composto enfileirada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao enfileirar geracao do relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundReorder(compound, workspaceId, direction) {
    if (!compound?.id || !workspaceId || !['up', 'down'].includes(direction)) return;
    const currentOrder = buildCompoundWorkspaceOrder(compound);
    const currentIndex = currentOrder.indexOf(workspaceId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    try {
      setBusy(`compound-reorder:${compound.id}:${workspaceId}`);
      const result = await reorderReportCompound(compound.id, nextOrder, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      showToast('Ordem do relatorio composto atualizada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao reordenar relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundRemoveWorkspace(compound, workspaceId) {
    if (!compound?.id || !workspaceId) return;
    try {
      setBusy(`compound-remove:${compound.id}:${workspaceId}`);
      await removeWorkspaceFromReportCompound(compound.id, workspaceId, { updatedBy: userEmail || 'web' });
    } catch (error) {
      showToast(error?.message || 'Erro ao remover workspace do relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleTrashCompound(compound) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-trash:${compound.id}`);
      await trashReportCompound(compound.id);
      showToast('Relatorio composto movido para lixeira.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao mover relatorio composto para lixeira.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRestoreCompound(compound) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-restore:${compound.id}`);
      await restoreReportCompound(compound.id);
      showToast('Relatorio composto restaurado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao restaurar relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleHardDeleteCompound(compound) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-delete:${compound.id}`);
      await deleteReportCompound(compound.id);
      showToast('Relatorio composto removido permanentemente.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao remover relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleTrashDossier(dossier) {
    if (!selectedProjectId || !dossier?.id) return;
    try {
      setBusy(`dossier-trash:${dossier.id}`);
      await trashProjectDossier(selectedProjectId, dossier.id);
      showToast('Dossie movido para lixeira.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao mover dossie para lixeira.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRestoreDossier(dossier) {
    if (!selectedProjectId || !dossier?.id) return;
    try {
      setBusy(`dossier-restore:${dossier.id}`);
      await restoreProjectDossier(selectedProjectId, dossier.id);
      showToast('Dossie restaurado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao restaurar dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleHardDeleteDossier(dossier) {
    if (!selectedProjectId || !dossier?.id) return;
    try {
      setBusy(`dossier-delete:${dossier.id}`);
      await deleteProjectDossier(selectedProjectId, dossier.id);
      showToast('Dossie removido permanentemente.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao remover dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleTrashWorkspace(workspace) {
    if (!workspace?.id) return;
    try {
      setBusy(`workspace-trash:${workspace.id}`);
      await trashReportWorkspace(workspace.id);
      showToast('Workspace movido para lixeira.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao mover workspace para lixeira.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRestoreWorkspace(workspace) {
    if (!workspace?.id) return;
    try {
      setBusy(`workspace-restore:${workspace.id}`);
      await restoreReportWorkspace(workspace.id);
      showToast('Workspace restaurado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao restaurar workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleHardDeleteWorkspace(workspace) {
    if (!workspace?.id) return;
    try {
      setBusy(`workspace-delete:${workspace.id}`);
      await deleteReportWorkspace(workspace.id);
      showToast('Workspace removido permanentemente.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao remover workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handlePhotoExport() {
    if (!selectedProjectId) { showToast('Selecione um empreendimento para exportar as fotos.', 'error'); return; }
    try {
      setBusy('export');
      const result = await requestProjectPhotoExport(selectedProjectId, { folderMode: 'tower', filters: libraryQueryFilters }, { updatedBy: userEmail || 'web' });
      const token = String(result?.data?.token || '');
      const itemCount = Number(result?.data?.itemCount || 0);
      if (itemCount <= 0) { showToast('Nenhuma foto corresponde ao recorte atual da biblioteca.', 'error'); return; }
      if (!token) throw new Error('Token da exportacao nao foi retornado pela API.');
      const download = await downloadProjectPhotoExport(selectedProjectId, token);
      triggerBlobDownload(download.fileName, download.blob);
      showToast(`ZIP exportado com ${itemCount} foto(s).`, 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao solicitar exportacao.', 'error');
    } finally {
      setBusy('');
    }
  }

  // ── Valores derivados para a UI ────────────────────────────────────────────

  const selectedWorkspaceKmzRequest = selectedWorkspace?.id
    ? (workspaceKmzRequests[selectedWorkspace.id] || null)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-screen-2xl w-full">
      {/* Cabecalho */}
      <div>
        <h2 className="m-0 flex items-center gap-2 text-xl font-bold text-slate-800">
          <AppIcon name="file-text" />
          Relatorios
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie workspaces de fotos, biblioteca agregada, dossies e relatorios compostos.
        </p>
      </div>

      {/* Tab bar acessivel */}
      <div
        role="tablist"
        aria-label="Secoes de relatorios"
        className="flex border-b border-slate-200"
      >
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            ].join(' ')}
          >
            <AppIcon name={icon} size={15} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Paineis de aba */}
      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex flex-col gap-6"
      >
        {tab === 'workspaces' ? (
          <WorkspacesTab
            projects={projects}
            projectOptions={projectOptions}
            projectNamesById={projectNamesById}
            sortedProjects={sortedProjects}
            workspaces={workspaces}
            workspaceCandidates={workspaceCandidates}
            filteredWorkspaceList={filteredWorkspaceList}
            workspaceSearchQuery={workspaceSearchQuery}
            setWorkspaceSearchQuery={setWorkspaceSearchQuery}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            workspaceImportTargetId={workspaceImportTargetId}
            setWorkspaceImportTargetId={setWorkspaceImportTargetId}
            selectedWorkspace={selectedWorkspace}
            selectedWorkspaceProject={selectedWorkspaceProject}
            workspaceTowerOptions={workspaceTowerOptions}
            workspaceDraft={workspaceDraft}
            setWorkspaceDraft={setWorkspaceDraft}
            workspaceImportMode={workspaceImportMode}
            setWorkspaceImportMode={setWorkspaceImportMode}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            uploadProgress={uploadProgress}
            uploadPercent={uploadPercent}
            workspaceTextsDraft={workspaceTextsDraft}
            setWorkspaceTextsDraft={setWorkspaceTextsDraft}
            workspacePhotos={workspacePhotos}
            workspacePhotoDrafts={workspacePhotoDrafts}
            setWorkspacePhotoDrafts={setWorkspacePhotoDrafts}
            workspaceMetrics={workspaceMetrics}
            workspaceCurationSummary={workspaceCurationSummary}
            workspaceAutosave={workspaceAutosave}
            towerFilter={towerFilter}
            setTowerFilter={setTowerFilter}
            photoCountsByTower={photoCountsByTower}
            filteredWorkspacePhotos={filteredWorkspacePhotos}
            visibleWorkspacePhotos={visibleWorkspacePhotos}
            activePreviewPhotoId={activePreviewPhotoId}
            setActivePreviewPhotoId={setActivePreviewPhotoId}
            photoPreviewUrls={photoPreviewUrls}
            photoPreviewLoading={photoPreviewLoading}
            deletedPhotoIds={deletedPhotoIds}
            trashedPhotos={trashedPhotos}
            selectedWorkspaceKmzRequest={selectedWorkspaceKmzRequest}
            busy={busy}
            handleCreateWorkspace={handleCreateWorkspace}
            handleImportWorkspace={handleImportWorkspace}
            handleSaveWorkspacePhoto={handleSaveWorkspacePhoto}
            handleMovePhotoToTrash={handleMovePhotoToTrash}
            handleRestorePhoto={handleRestorePhoto}
            handleRestoreAllTrashedPhotos={handleRestoreAllTrashedPhotos}
            handleEmptyPhotoTrash={handleEmptyPhotoTrash}
            handleSaveWorkspaceTexts={handleSaveWorkspaceTexts}
            handleRequestWorkspaceKmz={handleRequestWorkspaceKmz}
            handleDownloadWorkspaceKmz={handleDownloadWorkspaceKmz}
            photoSortMode={photoSortMode}
            handlePhotoSortModeChange={handlePhotoSortModeChange}
            handleExportCaptions={handleExportCaptions}
            handleTrashWorkspace={handleTrashWorkspace}
            handleRestoreWorkspace={handleRestoreWorkspace}
            handleHardDeleteWorkspace={handleHardDeleteWorkspace}
          />
        ) : null}

        {tab === 'library' ? (
          <BibliotecaTab
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            projectOptions={projectOptions}
            libraryFilters={libraryFilters}
            setLibraryFilters={setLibraryFilters}
            libraryQueryFilters={libraryQueryFilters}
            workspaceCandidates={workspaceCandidates}
            libraryTowerOptions={libraryTowerOptions}
            projectPhotos={projectPhotos}
            metrics={metrics}
            busy={busy}
            handlePhotoExport={handlePhotoExport}
          />
        ) : null}

        {tab === 'dossier' ? (
          <DossierTab
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            projectOptions={projectOptions}
            dossierDraft={dossierDraft}
            setDossierDraft={setDossierDraft}
            projectDossiers={projectDossiers}
            projectDossierPreflights={projectDossierPreflights}
            busy={busy}
            handleCreateDossier={handleCreateDossier}
            handleDossierPreflight={handleDossierPreflight}
            handleDossierGenerate={handleDossierGenerate}
            handleTrashDossier={handleTrashDossier}
            handleRestoreDossier={handleRestoreDossier}
            handleHardDeleteDossier={handleHardDeleteDossier}
            handleDownloadReportOutput={handleDownloadReportOutput}
            buildDossierDownloadFileName={buildDossierDownloadFileName}
          />
        ) : null}

        {tab === 'compounds' ? (
          <CompoundsTab
            compoundDraft={compoundDraft}
            setCompoundDraft={setCompoundDraft}
            profissoes={profissoes}
            signatariosCandidatos={signatariosCandidatos}
            compounds={compounds}
            workspaces={workspaces}
            workspaceLabelsById={workspaceLabelsById}
            compoundWorkspaceSelections={compoundWorkspaceSelections}
            setCompoundWorkspaceSelections={setCompoundWorkspaceSelections}
            compoundPreflights={compoundPreflights}
            busy={busy}
            handleCreateCompound={handleCreateCompound}
            handleCompoundAddWorkspace={handleCompoundAddWorkspace}
            handleCompoundRemoveWorkspace={handleCompoundRemoveWorkspace}
            handleCompoundReorder={handleCompoundReorder}
            handleCompoundPreflight={handleCompoundPreflight}
            handleCompoundGenerate={handleCompoundGenerate}
            handleTrashCompound={handleTrashCompound}
            handleRestoreCompound={handleRestoreCompound}
            handleHardDeleteCompound={handleHardDeleteCompound}
            handleDownloadReportOutput={handleDownloadReportOutput}
            buildCompoundDownloadFileName={buildCompoundDownloadFileName}
          />
        ) : null}
      </div>
    </section>
  );
}
