import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { subscribeProjects } from '../../../services/projectService';
import { subscribeInspections, saveInspection } from '../../../services/inspectionService';
import { subscribeRulesConfig } from '../../../services/rulesService';
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
  updateReportCompound,
} from '../../../services/reportCompoundService';
import { completeMediaUpload, createMediaUpload, downloadMediaAsset, uploadMediaBinary } from '../../../services/mediaService';
import { getAuthToken } from '../../../utils/serviceFactory';
import { clearImportState, fingerprintFile, readImportState, writeImportState } from '../utils/workspaceImportState';
import { getProjectTowerList } from '../../../utils/getProjectTowerList';
import {
  createReportWorkspace,
  deleteReportWorkspace,
  archiveTrashedPhotosOlderThan,
  archiveAllTrashedPhotos,
  deleteReportWorkspacePhoto,
  emptyWorkspacePhotoTrash,
  unarchivePhotoToTrash,
  getWorkspaceKmzRequest,
  importReportWorkspace,
  listReportWorkspacePhotos,
  listTrashedWorkspacePhotos,
  processWorkspaceKmz,
  reorderWorkspacePhotos,
  reorderWorkspacePhotosManual,
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
  buildSignatarySnapshot,
  buildWorkspaceKmzDownloadFileName,
  buildWorkspacePhotoDraft,
  buildWorkspacePhotoDrafts,
  computeTowerCurationStatus,
  getPersistedWorkspaceCurationDrafts,
  getWorkspacePhotoStatus,
  inferTowerIdFromRelativePath,
  isPendingExecutionStatus,
  sortPhotosByMode,
  sanitizeDownloadName,
  triggerBlobDownload,
} from '../utils/reportUtils';
import { parseCaptionsFile } from '../utils/captionsIO';
import BibliotecaTab from './BibliotecaTab';
import CompoundsTab from './CompoundsTab';
import DossierTab from './DossierTab';
import WorkspacesTab from './WorkspacesTab';
import UnclassifiedWorkspacesModal from './UnclassifiedWorkspacesModal';

export default function ReportsView({ userEmail = '', showToast = () => {} }) {
  const [tab, setTab] = useState('workspaces');
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [rulesConfig, setRulesConfig] = useState(null);
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
  const [workspaceDraft, setWorkspaceDraft] = useState({ projectId: '', inspectionId: '', nome: '', descricao: '' });
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
    elaboradores: [],
    revisores: [],
    includeTowerCoordinates: false,
    towerCoordinateFormat: 'decimal',
  });
  const [profissoes, setProfissoes] = useState([]);
  const [signatariosCandidatos, setSignatariosCandidatos] = useState([]);
  const [workspaceImportTargetId, setWorkspaceImportTargetId] = useState('');
  const [workspaceImportMode, setWorkspaceImportMode] = useState('loose_photos');
  const [workspacePhotos, setWorkspacePhotos] = useState([]);
  const [workspacePhotoDrafts, setWorkspacePhotoDrafts] = useState({});
  const [captionsImportSummary, setCaptionsImportSummary] = useState(null);
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
  const photoPreviewInflight = useRef(new Set());
  const [towerFilter, setTowerFilter] = useState('');
  const [photoSortMode, setPhotoSortMode] = useState('tower_asc');
  const [busy, setBusy] = useState('');

  const deletedPhotoIds = useMemo(() => trashedPhotos.map((p) => p.id), [trashedPhotos]);

  // ── Subscricoes ────────────────────────────────────────────────────────────

  useEffect(() => subscribeReportWorkspaces((rows) => setWorkspaces(rows || []), () => showToast('Erro ao carregar workspaces.', 'error')), [showToast]);
  useEffect(() => subscribeProjects((rows) => setProjects(rows || []), () => showToast('Erro ao carregar empreendimentos.', 'error')), [showToast]);
  useEffect(() => subscribeReportCompounds((rows) => setCompounds(rows || []), () => showToast('Erro ao carregar compostos.', 'error')), [showToast]);
  useEffect(() => subscribeInspections((rows) => setInspections(rows || []), () => showToast('Erro ao carregar vistorias.', 'error')), [showToast]);
  useEffect(() => subscribeRulesConfig((config) => setRulesConfig(config || null), () => {}), []);

  useEffect(() => {
    listProfissoes().then(setProfissoes).catch(() => showToast('Erro ao carregar profissoes.', 'error'));
    listSignatarios().then(setSignatariosCandidatos).catch(() => showToast('Erro ao carregar signatarios.', 'error'));
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
      setCaptionsImportSummary(null);
      setLastPersistedWorkspaceDraftSignature('');
      setTowerFilter('');
      setPhotoSortMode('tower_asc');
      setWorkspaceAutosave({ status: 'idle', savedAt: '', error: '' });
      return;
    }
    setCaptionsImportSummary(null);
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
    photoPreviewInflight.current = new Set();
    setPhotoPreviewUrls((prev) => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        Object.values(prev).forEach((url) => { if (url) URL.revokeObjectURL(url); });
      }
      return {};
    });
  }, [workspaceImportTargetId]);

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

  const towerCurationStatus = useMemo(
    () => computeTowerCurationStatus(visibleWorkspacePhotos, workspacePhotoDrafts),
    [visibleWorkspacePhotos, workspacePhotoDrafts],
  );

  const sortedTowerOptions = useMemo(() => {
    const withPhotos = workspaceTowerOptions.filter((t) => (photoCountsByTower[t] || 0) > 0);
    return [...withPhotos].sort((a, b) => {
      const aDone = towerCurationStatus[a] ? 1 : 0;
      const bDone = towerCurationStatus[b] ? 1 : 0;
      return aDone - bDone;
    });
  }, [workspaceTowerOptions, photoCountsByTower, towerCurationStatus]);

  const filteredWorkspacePhotos = useMemo(() => {
    const filtered = !towerFilter
      ? visibleWorkspacePhotos
      : visibleWorkspacePhotos.filter((photo) => {
        const draft = workspacePhotoDrafts[photo.id];
        const tower = (draft?.towerId || photo.towerId || '').trim();
        if (towerFilter === '__none__') return !tower;
        return tower === towerFilter;
      });
    return sortPhotosByMode(filtered, workspacePhotoDrafts, photoSortMode || 'tower_asc');
  }, [visibleWorkspacePhotos, workspacePhotoDrafts, towerFilter, photoSortMode]);

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

  // ── Preview de fotos sob demanda ───────────────────────────────────────────
  // O grid (WorkspacesTab) chama ensurePhotoPreview para cada card renderizado
  // via pagedPhotos. Fotos fora da pagina atual nao sao baixadas ate o usuario
  // navegar ate elas. Mantem a concorrencia do browser (~6/host) sem pool.

  const ensurePhotoPreview = useCallback(async (photo) => {
    if (!photo) return;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const id = photo.id;
    const mediaAssetId = String(photo.mediaAssetId || '').trim();
    if (!id || !mediaAssetId) return;
    if (photoPreviewUrls[id]) return;
    if (photoPreviewFailed[id]) return;
    if (photoPreviewInflight.current.has(id)) return;

    photoPreviewInflight.current.add(id);
    setPhotoPreviewLoading((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    try {
      const result = await downloadMediaAsset(mediaAssetId);
      const blob = result?.blob;
      const previewUrl = URL.createObjectURL(blob);
      setPhotoPreviewUrls((prev) => {
        const previousUrl = prev[id];
        if (previousUrl && previousUrl !== previewUrl && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(previousUrl);
        }
        return { ...prev, [id]: previewUrl };
      });
      setPhotoPreviewFailed((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setPhotoPreviewFailed((prev) => ({ ...prev, [id]: true }));
    } finally {
      photoPreviewInflight.current.delete(id);
      setPhotoPreviewLoading((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [photoPreviewUrls, photoPreviewFailed]);

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
    if (!workspaceDraft.inspectionId) {
      showToast('Selecione uma vistoria antes de criar o workspace.', 'error');
      return;
    }
    try {
      setBusy('workspace');
      await createReportWorkspace({
        id: `RW-${Date.now()}`,
        projectId: workspaceDraft.projectId,
        inspectionId: workspaceDraft.inspectionId,
        nome: workspaceDraft.nome.trim(),
        descricao: String(workspaceDraft.descricao || '').trim(),
        status: 'draft',
        slots: [],
        draftState: { autosave: 'pending' },
      }, { updatedBy: userEmail || 'web' });
      setWorkspaceDraft((prev) => ({ ...prev, nome: '', descricao: '', inspectionId: '' }));
      showToast('Workspace criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  const retentionDays = useMemo(() => {
    const value = Number(rulesConfig?.retencao?.lixeira_para_arquivo_dias);
    return Number.isInteger(value) && value >= 1 && value <= 3650 ? value : 30;
  }, [rulesConfig]);

  const projectInspections = useMemo(() => {
    if (!selectedProjectId) return [];
    return inspections.filter((inspection) => String(inspection.projetoId || '') === selectedProjectId);
  }, [inspections, selectedProjectId]);

  // Lista workspaces sem vistoria em TODOS os projetos visiveis (nao depende
  // do filtro selectedProjectId). Cada linha da modal resolve sua propria
  // lista de vistorias baseada no workspace.projectId.
  const unclassifiedWorkspaces = useMemo(() => (
    workspaces.filter((workspace) => !workspace.inspectionId && !workspace.deletedAt)
  ), [workspaces]);

  async function handleClassifyUnclassifiedWorkspaces(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) return;
    setBusy('classify-batch');
    let successCount = 0;
    for (const { workspaceId, inspectionId } of assignments) {
      try {
        await updateReportWorkspace(workspaceId, { inspectionId }, { updatedBy: userEmail || 'web' });
        successCount += 1;
      } catch (error) {
        console.error('Falha ao classificar workspace', workspaceId, error);
      }
    }
    setBusy('');
    if (successCount > 0) {
      showToast(`${successCount} workspace(s) classificado(s).`, 'success');
    }
    if (successCount < assignments.length) {
      showToast(`${assignments.length - successCount} falha(s) ao classificar.`, 'error');
    }
  }

  async function handleCreateInspectionForClassification({ projetoId, dataInicio, responsavel }) {
    try {
      const id = await saveInspection(
        { projetoId, dataInicio, responsavel, status: 'aberta' },
        { updatedBy: userEmail || 'web' },
      );
      return { id };
    } catch (error) {
      showToast(error?.message || 'Erro ao criar vistoria.', 'error');
      return null;
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
        // Dedupe: filtrar fotos ja enviadas em tentativas anteriores desse workspace.
        const previousState = readImportState(workspace.id) || { completedFingerprints: [], failedFingerprints: [] };
        const completedSet = new Set(previousState.completedFingerprints);
        const fingerprintByFile = new Map();
        const filesToProcess = [];
        let skippedCount = 0;
        for (const file of pendingFiles) {
          const fp = fingerprintFile(file);
          fingerprintByFile.set(file, fp);
          if (fp && completedSet.has(fp)) {
            skippedCount += 1;
          } else {
            filesToProcess.push(file);
          }
        }
        if (skippedCount > 0) {
          showToast(`${skippedCount} foto(s) ja foram enviadas anteriormente e serao ignoradas.`, 'info');
        }

        if (filesToProcess.length === 0) {
          showToast('Nenhuma foto nova para importar.', 'info');
          setBusy('');
          setUploadProgress({ total: 0, completed: 0, currentFileName: '' });
          return;
        }

        // Pool de uploads com concorrencia controlada + retry por foto + continue-on-error.
        const CONCURRENCY = 3;
        const MAX_RETRIES = 3;
        const RETRY_BASE_MS = 800;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        let inferredTowerCount = 0;
        let pendingTowerCount = 0;
        let completedCount = 0;
        const failedItems = [];
        // Reset failedFingerprints do run anterior — vamos re-tentar todas as falhas junto das novas.
        const completedFingerprints = Array.from(completedSet);
        const failedFingerprints = [];
        setUploadProgress({ total: filesToProcess.length, completed: 0, currentFileName: String(filesToProcess[0]?.name || '') });

        async function uploadOneWithRetry(file, index) {
          let lastErr;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            try {
              const inferredTowerId = workspaceImportMode === 'tower_subfolders'
                ? inferTowerIdFromRelativePath(file.webkitRelativePath || file.name)
                : '';
              const uploaded = await uploadWorkspaceFile(file, workspace, index, workspaceImportMode, { inferredTowerId });
              return { ok: true, uploaded, inferredTowerId };
            } catch (err) {
              lastErr = err;
              const status = Number(err?.status) || 0;
              if (status === 401) {
                try { await getAuthToken(true); } catch { /* ignorar — proxima tentativa vai falhar de novo */ }
              } else if (status === 429 || status >= 500 || status === 0) {
                await sleep(RETRY_BASE_MS * (2 ** attempt));
              } else {
                // 4xx nao-recuperaveis (400, 403, 404, etc.): desiste logo.
                break;
              }
            }
          }
          return { ok: false, file, error: lastErr };
        }

        const queue = filesToProcess.map((file, idx) => ({ file, idx }));
        async function worker() {
          while (queue.length > 0) {
            const item = queue.shift();
            if (!item) return;
            const result = await uploadOneWithRetry(item.file, item.idx);
            completedCount += 1;
            setUploadProgress({
              total: filesToProcess.length,
              completed: completedCount,
              currentFileName: String(item.file?.name || ''),
            });

            const fp = fingerprintByFile.get(item.file) || fingerprintFile(item.file);

            if (result.ok) {
              uploadedMediaIds.push(result.uploaded.mediaAssetId);
              if (result.inferredTowerId) inferredTowerCount += 1;
              else if (workspaceImportMode === 'tower_subfolders') pendingTowerCount += 1;

              if (fp && !completedFingerprints.includes(fp)) {
                completedFingerprints.push(fp);
              }
            } else {
              failedItems.push(result);
              if (fp && !failedFingerprints.includes(fp)) {
                failedFingerprints.push(fp);
              }
            }

            // Checkpoint por-foto: persiste imediatamente para sobreviver a crash/reload.
            writeImportState(workspace.id, { completedFingerprints, failedFingerprints });
          }
        }

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, filesToProcess.length) }, () => worker()));

        if (workspaceImportMode === 'tower_subfolders' && pendingTowerCount > 0) {
          warnings.push(`${pendingTowerCount} foto(s) ficaram sem torre inferida pelas subpastas.`);
        }
        if (failedItems.length > 0) {
          warnings.push(`${failedItems.length} foto(s) falharam apos retries.`);
        }

        // Fecha a importacao mesmo com falhas parciais — summary reflete a realidade.
        await importReportWorkspace(workspace.id, {
          sourceType: workspaceImportMode,
          importSource: workspaceImportMode,
          warnings,
          summaryJson: {
            filesReceived: filesToProcess.length,
            filesSkipped: skippedCount,
            uploadedMediaIds,
            inferredTowerCount,
            pendingTowerCount,
            failedCount: failedItems.length,
          },
        }, { updatedBy: userEmail || 'web' });

        if (failedItems.length === 0) {
          // Sucesso total: limpa o registro persistido.
          clearImportState(workspace.id);
          showToast(
            workspaceImportMode === 'tower_subfolders'
              ? `Importacao concluida para ${uploadedMediaIds.length} foto(s), com ${inferredTowerCount} torre(s) inferida(s).`
              : `Upload concluido para ${uploadedMediaIds.length} foto(s).`,
            'success',
          );
        } else {
          showToast(
            `Importacao parcial: ${uploadedMediaIds.length} enviada(s), ${failedItems.length} falhou(falharam). Clique novamente pra retentar apenas as que falharam.`,
            'error',
          );
        }
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

  async function handleRestoreTowerTrashedPhotos(photos) {
    if (!selectedWorkspace || !Array.isArray(photos) || photos.length === 0) return;
    const busyKey = `restore-tower:${photos[0]?.towerId || '__none__'}`;
    setBusy(busyKey);
    const restoredIds = new Set();
    for (const photo of photos) {
      try {
        await restoreWorkspacePhoto(selectedWorkspace.id, photo.id);
        restoredIds.add(photo.id);
      } catch (error) {
        console.error('Falha ao restaurar foto', photo.id, error);
      }
    }
    setBusy('');
    if (restoredIds.size > 0) {
      showToast(`${restoredIds.size} foto(s) restaurada(s).`, 'success');
      setTrashedPhotos((prev) => prev.filter((p) => !restoredIds.has(p.id)));
      await refreshWorkspacePhotos(selectedWorkspace.id);
    }
  }

  async function handleRestoreSelectedTrashedPhotos(photoIds) {
    if (!selectedWorkspace || !Array.isArray(photoIds) || photoIds.length === 0) return;
    setBusy('restore-selected');
    const restoredIds = new Set();
    for (const photoId of photoIds) {
      try {
        await restoreWorkspacePhoto(selectedWorkspace.id, photoId);
        restoredIds.add(photoId);
      } catch (error) {
        console.error('Falha ao restaurar foto', photoId, error);
      }
    }
    setBusy('');
    if (restoredIds.size > 0) {
      showToast(`${restoredIds.size} foto(s) restaurada(s).`, 'success');
      setTrashedPhotos((prev) => prev.filter((p) => !restoredIds.has(p.id)));
      await refreshWorkspacePhotos(selectedWorkspace.id);
    }
  }

  async function handleUnarchivePhotoToTrash(workspaceId, photoId) {
    if (!workspaceId || !photoId) return;
    try {
      setBusy(`unarchive:${photoId}`);
      await unarchivePhotoToTrash(workspaceId, photoId);
      showToast('Foto devolvida para a lixeira.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao desarquivar foto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleArchiveOldTrashedPhotos(days) {
    if (!selectedWorkspace) return;
    setBusy('archive-old-trash');
    try {
      const result = await archiveTrashedPhotosOlderThan(selectedWorkspace.id, days);
      const count = result?.data?.count || 0;
      if (count > 0) {
        showToast(`${count} foto(s) arquivada(s).`, 'success');
        setTrashedPhotos((prev) => prev.filter((p) => {
          const deletedMs = new Date(p.deletedAt || 0).getTime();
          return !Number.isFinite(deletedMs) || deletedMs >= Date.now() - days * 86_400_000;
        }));
      } else {
        showToast('Nenhuma foto antiga para arquivar.', 'info');
      }
    } catch (error) {
      showToast(error?.message || 'Erro ao arquivar fotos antigas.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleHardDeleteSelectedTrashedPhotos(photoIds) {
    if (!selectedWorkspace || !Array.isArray(photoIds) || photoIds.length === 0) return;
    setBusy('hard-delete-selected');
    const deletedIds = new Set();
    for (const photoId of photoIds) {
      try {
        await deleteReportWorkspacePhoto(selectedWorkspace.id, photoId);
        deletedIds.add(photoId);
      } catch (error) {
        console.error('Falha ao excluir foto permanentemente', photoId, error);
      }
    }
    setBusy('');
    if (deletedIds.size > 0) {
      showToast(`${deletedIds.size} foto(s) excluida(s) permanentemente.`, 'success');
      setTrashedPhotos((prev) => prev.filter((p) => !deletedIds.has(p.id)));
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

  async function handleArchiveAllTrashedPhotos() {
    if (!selectedWorkspace || trashedPhotos.length === 0) return;
    setBusy('archive-all-trash');
    try {
      const result = await archiveAllTrashedPhotos(selectedWorkspace.id);
      const count = result?.data?.count ?? trashedPhotos.length;
      if (count > 0) {
        showToast(`${count} foto(s) arquivada(s).`, 'success');
        setTrashedPhotos([]);
      } else {
        showToast('Nenhuma foto para arquivar.', 'info');
      }
    } catch (error) {
      showToast(error?.message || 'Erro ao arquivar lixeira.', 'error');
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

  async function handleManualPhotoReorder(newPhotoIds) {
    if (!selectedWorkspace) return;
    if (!Array.isArray(newPhotoIds) || newPhotoIds.length === 0) return;

    // Otimista: reordena o estado local imediatamente atribuindo sort_order
    // 1..N conforme a nova sequencia e entra em modo manual.
    const orderIndex = new Map(newPhotoIds.map((id, index) => [id, index + 1]));
    setWorkspacePhotos((prev) => {
      const updated = prev.map((photo) => {
        const nextOrder = orderIndex.get(photo.id);
        return nextOrder ? { ...photo, sortOrder: nextOrder } : photo;
      });
      updated.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
      return updated;
    });
    setPhotoSortMode('sort_order_asc');

    try {
      setBusy('reorder');
      await reorderWorkspacePhotosManual(selectedWorkspace.id, newPhotoIds, { updatedBy: userEmail || 'web' });
      await refreshWorkspacePhotos(selectedWorkspace.id);
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar ordem manual.', 'error');
      // Reverte recarregando do backend
      try { await refreshWorkspacePhotos(selectedWorkspace.id); } catch (_) {}
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

  async function handleImportCaptions(file) {
    if (!file) return;
    const workspace = selectedWorkspace;
    if (!workspace) {
      showToast('Selecione um workspace valido para importar legendas.', 'error');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch (error) {
      showToast(error?.message || 'Erro ao ler o arquivo de legendas.', 'error');
      return;
    }
    const { rows, warnings } = parseCaptionsFile(text, file.name || '');
    if (rows.length === 0) {
      const msg = warnings[0] || 'Nenhuma linha valida encontrada no arquivo.';
      showToast(`Importacao de legendas: ${msg}`, 'error');
      setCaptionsImportSummary({ atualizadas: 0, inalteradas: 0, ignoradas: [], erros: [], warnings });
      return;
    }

    const photosById = new Map(workspacePhotos.map((photo) => [photo.id, photo]));
    const summary = { atualizadas: 0, inalteradas: 0, ignoradas: [], erros: [], warnings };
    const toUpdate = [];
    for (const row of rows) {
      const photo = photosById.get(row.id);
      if (!photo) {
        summary.ignoradas.push(row.id);
        continue;
      }
      const draft = workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo);
      const currentCaption = String(draft.caption ?? photo.caption ?? '');
      const nextCaption = String(row.caption ?? '');
      if (currentCaption === nextCaption) {
        summary.inalteradas += 1;
        continue;
      }
      toUpdate.push({ photo, draft, nextCaption });
    }

    if (toUpdate.length === 0) {
      setCaptionsImportSummary(summary);
      const msg = summary.ignoradas.length > 0
        ? `Nenhuma legenda alterada. ${summary.ignoradas.length} ignorada(s).`
        : 'Nenhuma legenda alterada.';
      showToast(msg, summary.ignoradas.length > 0 ? 'error' : 'success');
      return;
    }

    setBusy('import-captions');
    try {
      const CONCURRENCY = 4;
      let cursor = 0;
      async function worker() {
        while (cursor < toUpdate.length) {
          const idx = cursor;
          cursor += 1;
          const item = toUpdate[idx];
          const { photo, draft, nextCaption } = item;
          const nextTowerId = String(draft.towerId || '').trim();
          const nextData = {
            caption: nextCaption.trim(),
            towerId: nextTowerId || null,
            towerSource: nextTowerId ? 'manual' : 'pending',
            includeInReport: Boolean(draft.includeInReport),
            curationStatus: getWorkspacePhotoStatus(photo, { ...draft, caption: nextCaption }),
            manualOverride: Boolean(nextTowerId),
          };
          try {
            const result = await saveReportWorkspacePhoto(workspace.id, photo.id, nextData, { updatedBy: userEmail || 'web' });
            const savedPhoto = result?.data || { ...photo, ...nextData };
            setWorkspacePhotos((prev) => prev.map((p) => (p.id === photo.id ? savedPhoto : p)));
            setWorkspacePhotoDrafts((prev) => ({ ...prev, [photo.id]: buildWorkspacePhotoDraft(savedPhoto) }));
            setProjectPhotos((prev) => prev.map((p) => (p.id === photo.id ? savedPhoto : p)));
            summary.atualizadas += 1;
          } catch (error) {
            summary.erros.push({ id: photo.id, message: String(error?.message || error || 'erro desconhecido').slice(0, 200) });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toUpdate.length) }, worker));
      setCaptionsImportSummary(summary);
      const toastMsg = `Legendas importadas: ${summary.atualizadas} atualizadas, ${summary.inalteradas} inalteradas, ${summary.ignoradas.length} ignoradas, ${summary.erros.length} com erro.`;
      showToast(toastMsg, summary.erros.length === 0 ? 'success' : 'error');
    } finally {
      setBusy('');
    }
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

  function buildSharedTextsPayload(draft) {
    const trimField = (key) => String(draft[key] || '').trim();
    const profLookup = Object.fromEntries(profissoes.map((p) => [p.id, p.nome]));
    const elaboradoresArr = (draft.elaboradores || []).map((id) => {
      const sig = signatariosCandidatos.find((s) => s.id === id);
      return buildSignatarySnapshot(sig, profLookup);
    }).filter(Boolean);
    const revisoresArr = (draft.revisores || []).map((id) => {
      const sig = signatariosCandidatos.find((s) => s.id === id);
      return buildSignatarySnapshot(sig, profLookup);
    }).filter(Boolean);
    return {
      nome_lt: trimField('nome_lt'),
      titulo_programa: trimField('titulo_programa'),
      codigo_documento: trimField('codigo_documento'),
      revisao: trimField('revisao') || '00',
      introducao: trimField('introducao'),
      geologia: trimField('geologia'),
      geotecnia: trimField('geotecnia'),
      geomorfologia: trimField('geomorfologia'),
      descricao_atividades: trimField('descricao_atividades'),
      conclusoes: trimField('conclusoes'),
      analise_evolucao: trimField('analise_evolucao'),
      observacoes: trimField('observacoes'),
      elaboradores: elaboradoresArr,
      revisores: revisoresArr,
      includeTowerCoordinates: !!draft.includeTowerCoordinates,
      towerCoordinateFormat: draft.towerCoordinateFormat || 'decimal',
      anexoFichasMode: ['none', 'all', 'selected'].includes(draft.anexoFichasMode)
        ? draft.anexoFichasMode
        : 'none',
      anexoFichasErosionIds: Array.isArray(draft.anexoFichasErosionIds)
        ? draft.anexoFichasErosionIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [],
    };
  }

  async function handleCreateCompound(draftArg) {
    const draft = draftArg && typeof draftArg === 'object' && 'nome' in draftArg
      ? draftArg
      : compoundDraft;
    if (!String(draft.nome || '').trim()) {
      showToast('Informe um nome para o relatório.', 'error');
      throw new Error('Nome obrigatório.');
    }
    try {
      setBusy('compound');
      const result = await createReportCompound({
        id: `RC-${Date.now()}`,
        nome: draft.nome.trim(),
        sharedTextsJson: buildSharedTextsPayload(draft),
        status: 'draft',
        workspaceIds: [],
        orderJson: [],
      }, { updatedBy: userEmail || 'web' });
      setCompoundDraft({
        nome: '', nome_lt: '', titulo_programa: '', codigo_documento: '', revisao: '00',
        introducao: '', geologia: '', geotecnia: '', geomorfologia: '', descricao_atividades: '',
        conclusoes: '', analise_evolucao: '', observacoes: '', elaboradores: [], revisores: [],
        includeTowerCoordinates: false, towerCoordinateFormat: 'decimal',
      });
      await refreshCompounds();
      showToast('Relatório criado.', 'success');
      return result?.data || null;
    } catch (error) {
      showToast(error?.message || 'Erro ao criar relatório.', 'error');
      throw error;
    } finally {
      setBusy('');
    }
  }

  async function handleUpdateCompoundDraft(compound, draft) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-update:${compound.id}`);
      const result = await updateReportCompound(compound.id, {
        nome: String(draft.nome || '').trim() || compound.nome,
        sharedTextsJson: buildSharedTextsPayload(draft),
      }, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) {
        setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      } else {
        await refreshCompounds();
      }
      showToast('Relatório atualizado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao atualizar relatório.', 'error');
      throw error;
    } finally {
      setBusy('');
    }
  }

  async function handleCompoundAddWorkspace(compound, workspaceIdArg) {
    // Aceita workspaceId explícito (wizard passando stage a stage) ou cai para
    // a selecao em compoundWorkspaceSelections (fluxo da lista).
    const workspaceId = workspaceIdArg
      ? String(workspaceIdArg).trim()
      : String(compoundWorkspaceSelections[compound?.id] || '').trim();
    if (!compound?.id || !workspaceId) { showToast('Selecione um workspace para adicionar ao relatorio composto.', 'error'); return null; }
    try {
      setBusy(`compound-add:${compound.id}`);
      const result = await addWorkspaceToReportCompound(compound.id, workspaceId, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      if (!workspaceIdArg) setCompoundWorkspaceSelections((prev) => ({ ...prev, [compound.id]: '' }));
      setCompoundPreflights((prev) => { const next = { ...prev }; delete next[compound.id]; return next; });
      showToast('Workspace adicionado ao relatorio composto.', 'success');
      return savedCompound || null;
    } catch (error) {
      showToast(error?.message || 'Erro ao adicionar workspace ao relatorio composto.', 'error');
      return null;
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

  async function handleCompoundGenerate(compound, options = {}) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-generate:${compound.id}`);
      const result = await generateReportCompound(compound.id, options);
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      else await refreshCompounds();
      const withCoords = options?.ensureTowerCoordinates === true;
      showToast(
        withCoords
          ? 'Relatorio enfileirado para re-geracao com coordenadas de torres.'
          : 'Geracao do relatorio composto enfileirada.',
        'success',
      );
    } catch (error) {
      showToast(error?.message || 'Erro ao enfileirar geracao do relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleUpdateCompoundSignatures(compound, elaboradoresArr, revisoresArr) {
    if (!compound?.id) return;
    try {
      setBusy(`compound-update-sig:${compound.id}`);
      const result = await updateReportCompound(compound.id, {
        sharedTextsJson: {
          ...(compound.sharedTextsJson || {}),
          elaboradores: elaboradoresArr,
          revisores: revisoresArr,
        },
      }, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      else await refreshCompounds();
      showToast('Assinaturas atualizadas.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao atualizar assinaturas.', 'error');
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
            workspacePhotos={workspacePhotos}
            workspacePhotoDrafts={workspacePhotoDrafts}
            setWorkspacePhotoDrafts={setWorkspacePhotoDrafts}
            workspaceMetrics={workspaceMetrics}
            workspaceCurationSummary={workspaceCurationSummary}
            workspaceAutosave={workspaceAutosave}
            towerFilter={towerFilter}
            setTowerFilter={setTowerFilter}
            photoCountsByTower={photoCountsByTower}
            towerCurationStatus={towerCurationStatus}
            sortedTowerOptions={sortedTowerOptions}
            filteredWorkspacePhotos={filteredWorkspacePhotos}
            visibleWorkspacePhotos={visibleWorkspacePhotos}
            activePreviewPhotoId={activePreviewPhotoId}
            setActivePreviewPhotoId={setActivePreviewPhotoId}
            photoPreviewUrls={photoPreviewUrls}
            photoPreviewLoading={photoPreviewLoading}
            ensurePhotoPreview={ensurePhotoPreview}
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
            handleRestoreTowerTrashedPhotos={handleRestoreTowerTrashedPhotos}
            handleRestoreSelectedTrashedPhotos={handleRestoreSelectedTrashedPhotos}
            handleHardDeleteSelectedTrashedPhotos={handleHardDeleteSelectedTrashedPhotos}
            handleArchiveOldTrashedPhotos={handleArchiveOldTrashedPhotos}
            handleArchiveAllTrashedPhotos={handleArchiveAllTrashedPhotos}
            handleEmptyPhotoTrash={handleEmptyPhotoTrash}
            retentionDays={retentionDays}
            handleRequestWorkspaceKmz={handleRequestWorkspaceKmz}
            handleDownloadWorkspaceKmz={handleDownloadWorkspaceKmz}
            photoSortMode={photoSortMode}
            handlePhotoSortModeChange={handlePhotoSortModeChange}
            handleManualPhotoReorder={handleManualPhotoReorder}
            handleExportCaptions={handleExportCaptions}
            handleImportCaptions={handleImportCaptions}
            captionsImportSummary={captionsImportSummary}
            onDismissCaptionsImportSummary={() => setCaptionsImportSummary(null)}
            handleTrashWorkspace={handleTrashWorkspace}
            handleRestoreWorkspace={handleRestoreWorkspace}
            handleHardDeleteWorkspace={handleHardDeleteWorkspace}
            projectInspections={projectInspections}
            inspections={inspections}
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
            workspaces={workspaces}
            inspections={inspections}
            handleUnarchivePhotoToTrash={handleUnarchivePhotoToTrash}
            showToast={showToast}
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
            handleUpdateCompoundDraft={handleUpdateCompoundDraft}
            handleCompoundAddWorkspace={handleCompoundAddWorkspace}
            handleCompoundRemoveWorkspace={handleCompoundRemoveWorkspace}
            handleCompoundReorder={handleCompoundReorder}
            handleCompoundGenerate={handleCompoundGenerate}
            handleTrashCompound={handleTrashCompound}
            handleRestoreCompound={handleRestoreCompound}
            handleHardDeleteCompound={handleHardDeleteCompound}
            handleDownloadReportOutput={handleDownloadReportOutput}
            buildCompoundDownloadFileName={buildCompoundDownloadFileName}
            userEmail={userEmail}
            showToast={showToast}
          />
        ) : null}
      </div>

      {/* Bloqueia a aba Workspaces quando ha workspaces sem vistoria no
          empreendimento selecionado. Nao possui close explicito — so sai
          quando todos forem classificados e submetidos. */}
      <UnclassifiedWorkspacesModal
        open={tab === 'workspaces' && unclassifiedWorkspaces.length > 0}
        unclassifiedWorkspaces={unclassifiedWorkspaces}
        inspections={inspections}
        projectNamesById={projectNamesById}
        busy={busy}
        onAssign={handleClassifyUnclassifiedWorkspaces}
        onCreateInspection={handleCreateInspectionForClassification}
      />
    </section>
  );
}
