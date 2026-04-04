import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select, Textarea } from '../../../components/ui';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { subscribeProjects } from '../../../services/projectService';
import {
  createProjectDossier,
  generateProjectDossier,
  listProjectDossiers,
  runProjectDossierPreflight,
} from '../../../services/projectDossierService';
import { downloadProjectPhotoExport, listProjectPhotos, requestProjectPhotoExport } from '../../../services/projectPhotoLibraryService';
import {
  addWorkspaceToReportCompound,
  createReportCompound,
  generateReportCompound,
  listReportCompounds,
  reorderReportCompound,
  runReportCompoundPreflight,
  subscribeReportCompounds,
} from '../../../services/reportCompoundService';
import { completeMediaUpload, createMediaUpload, downloadMediaAsset, uploadMediaBinary } from '../../../services/mediaService';
import { getProjectTowerList } from '../../../utils/getProjectTowerList';
import {
  createReportWorkspace,
  getWorkspaceKmzRequest,
  importReportWorkspace,
  listReportWorkspacePhotos,
  processWorkspaceKmz,
  requestWorkspaceKmz,
  saveReportWorkspacePhoto,
  subscribeReportWorkspaces,
  updateReportWorkspace,
  deleteReportWorkspacePhoto,
} from '../../../services/reportWorkspaceService';
import { listProfissoes, listSignatarios } from '../../../services/userService';

const TABS = [
  ['workspaces', 'Workspaces', 'file-text'],
  ['library', 'Biblioteca do Empreendimento', 'search'],
  ['dossier', 'Dossie do Empreendimento', 'clipboard'],
  ['compounds', 'Relatorios Compostos', 'details'],
];

const STEPS = [
  ['Empreendimento', 'Cada workspace pertence a um unico empreendimento.'],
  ['Importacao', 'Aceita fotos soltas, subpastas por torre e KMZ organizado.'],
  ['Curadoria', 'Legenda, torre e inclusao da foto sao decididas aqui.'],
  ['Textos', 'Os textos-base do empreendimento viram um rascunho do workspace.'],
  ['Preflight', 'Valida foto, torre, legenda e consistencia.'],
  ['Geracao', 'DOCX e KMZ entram na trilha do worker.'],
];

const IMPORT_MODES = {
  loose_photos: {
    label: 'Fotos Soltas',
    inputLabel: 'Fotos Soltas',
    hint: 'Envie imagens avulsas. O upload usa URL assinada quando MEDIA_BACKEND=tigris e fallback local em desenvolvimento.',
    buttonLabel: 'Importar Fotos Soltas',
    accept: 'image/*',
    multiple: true,
  },
  tower_subfolders: {
    label: 'Subpastas por Torre',
    inputLabel: 'Pasta com Subpastas',
    hint: 'Selecione a pasta raiz. O sistema tenta inferir a torre pela ultima subpasta valida antes do arquivo.',
    buttonLabel: 'Importar Subpastas por Torre',
    accept: 'image/*',
    multiple: true,
  },
  organized_kmz: {
    label: 'KMZ Organizado',
    inputLabel: 'Pacote KMZ',
    hint: 'O KMZ sera processado no backend: fotos extraidas, torres inferidas por pasta e placemarks vinculados.',
    buttonLabel: 'Importar KMZ Organizado',
    accept: '.kmz,.zip,application/vnd.google-earth.kmz',
    multiple: false,
  },
};

function fmt(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function tone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('queued') || value.includes('process') || value.includes('saving') || value.includes('pending')) return 'bg-amber-100 text-amber-700';
  if (value.includes('ready') || value.includes('done') || value.includes('ativo') || value.includes('complete')) return 'bg-emerald-100 text-emerald-700';
  if (value.includes('error') || value.includes('fail')) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function isPendingExecutionStatus(status) {
  const value = String(status || '').toLowerCase();
  return value.includes('queued') || value.includes('process');
}

function getStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('queued')) return 'Na fila...';
  if (s.includes('process')) return 'Gerando documento...';
  if (s.includes('error') || s.includes('fail')) return 'Erro na geracao';
  if (s.includes('complet')) return 'Concluido';
  return null;
}

function buildDefaultCaption(fileName = '') {
  return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}


function normalizeTowerToken(rawValue = '') {
  const normalized = String(rawValue || '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized) return '';

  const directMatch = normalized.match(/^(?:TORRE|T)?\s*(\d+)([A-Z]*)$/);
  if (!directMatch) return '';

  return `${Number(directMatch[1])}${directMatch[2] || ''}`;
}

function inferTowerIdFromRelativePath(relativePath = '') {
  const segments = String(relativePath || '')
    .split(/[\\/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const inferred = normalizeTowerToken(segments[index]);
    if (inferred) return inferred;
  }

  return '';
}

function buildWorkspacePhotoDraft(photo = {}) {
  return {
    caption: String(photo.caption || ''),
    towerId: String(photo.towerId || ''),
    includeInReport: Boolean(photo.includeInReport),
  };
}

function getPersistedWorkspaceCurationDrafts(workspace = null) {
  const persistedDrafts = workspace?.draftState?.curationDrafts;
  return persistedDrafts && typeof persistedDrafts === 'object' ? persistedDrafts : {};
}

function buildWorkspacePhotoDrafts(photos = [], persistedDrafts = {}) {
  return Object.fromEntries((Array.isArray(photos) ? photos : []).map((photo) => {
    const persistedDraft = persistedDrafts[photo.id];
    return [
      photo.id,
      persistedDraft && typeof persistedDraft === 'object'
        ? {
          caption: String(persistedDraft.caption ?? photo.caption ?? ''),
          towerId: String(persistedDraft.towerId ?? photo.towerId ?? ''),
          includeInReport: Boolean(
            persistedDraft.includeInReport ?? photo.includeInReport,
          ),
        }
        : buildWorkspacePhotoDraft(photo),
    ];
  }));
}

function isWorkspacePhotoDirty(photo = {}, draft = {}) {
  return String(draft.caption || '').trim() !== String(photo.caption || '').trim()
    || String(draft.towerId || '').trim() !== String(photo.towerId || '').trim()
    || Boolean(draft.includeInReport) !== Boolean(photo.includeInReport);
}

function getWorkspacePhotoStatus(photo = {}, draft = {}) {
  const hasCaption = Boolean(String(draft.caption || '').trim());
  const hasTower = Boolean(String(draft.towerId || '').trim());
  const includeInReport = Boolean(draft.includeInReport);

  if (includeInReport && hasCaption && hasTower) return 'curated';
  if (hasCaption || hasTower || includeInReport) return 'reviewed';
  return String(photo.curationStatus || 'uploaded').trim() || 'uploaded';
}

function buildProjectPhotoFilters(filters = {}) {
  const workspaceId = String(filters.workspaceId || '').trim();
  const towerId = String(filters.towerId || '').trim();
  const captionQuery = String(filters.captionQuery || '').trim();
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();

  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(towerId ? { towerId } : {}),
    ...(captionQuery ? { captionQuery } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
}

function getProjectPhotoDate(photo = {}) {
  return photo.captureAt || photo.createdAt || photo.updatedAt || '';
}

function triggerBlobDownload(filename, blob) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = String(filename || 'exportacao.zip');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return true;
}

function sanitizeDownloadName(value = '', fallback = 'documento.docx') {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '-');
  return normalized || fallback;
}

function buildDossierDownloadFileName(projectId, dossier = {}) {
  return sanitizeDownloadName(`dossie-${projectId}-${dossier.id || 'documento'}.docx`);
}

function buildCompoundDownloadFileName(compound = {}) {
  return sanitizeDownloadName(`relatorio-composto-${compound.id || 'documento'}.docx`);
}

function buildWorkspaceKmzDownloadFileName(workspace = {}, requestEntry = {}) {
  return sanitizeDownloadName(`workspace-${workspace.id || 'workspace'}-${requestEntry.token || 'fotos'}.kmz`, 'workspace-fotos.kmz');
}

const DOSSIER_SCOPE_FIELDS = [
  ['includeLicencas', 'Licencas'],
  ['includeInspecoes', 'Inspecoes'],
  ['includeErosoes', 'Erosoes'],
  ['includeEntregas', 'Entregas'],
  ['includeWorkspaces', 'Workspaces'],
  ['includeFotos', 'Fotos'],
];

function buildDefaultDossierScope() {
  return Object.fromEntries(DOSSIER_SCOPE_FIELDS.map(([key]) => [key, true]));
}

function summarizeDossierScope(scopeJson = {}) {
  return DOSSIER_SCOPE_FIELDS
    .filter(([key]) => Boolean(scopeJson?.[key]))
    .map(([, label]) => label);
}

function buildCompoundWorkspaceOrder(compound = {}) {
  const workspaceIds = Array.from(new Set(
    (Array.isArray(compound.workspaceIds) ? compound.workspaceIds : [])
      .map((workspaceId) => String(workspaceId || '').trim())
      .filter(Boolean),
  ));
  const orderedWorkspaceIds = Array.from(new Set(
    (Array.isArray(compound.orderJson) ? compound.orderJson : [])
      .map((workspaceId) => String(workspaceId || '').trim())
      .filter((workspaceId) => workspaceIds.includes(workspaceId)),
  ));
  const missingWorkspaceIds = workspaceIds.filter((workspaceId) => !orderedWorkspaceIds.includes(workspaceId));
  return [...orderedWorkspaceIds, ...missingWorkspaceIds];
}

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
  const [workspaceDraft, setWorkspaceDraft] = useState({ projectId: '', nome: '', descricao: '' });
  const [dossierDraft, setDossierDraft] = useState({ nome: '', observacoes: '', scopeJson: buildDefaultDossierScope() });
  const [compoundDraft, setCompoundDraft] = useState({
    nome: '',
    nome_lt: '',
    titulo_programa: '',
    codigo_documento: '',
    revisao: '00',
    introducao: '',
    caracterizacao_tecnica: '',
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
  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    completed: 0,
    currentFileName: '',
  });
  const [deletedPhotoIds, setDeletedPhotoIds] = useState([]);
  const [lastDeletedPhotoId, setLastDeletedPhotoId] = useState('');
  const [activePreviewPhotoId, setActivePreviewPhotoId] = useState('');
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [photoPreviewLoading, setPhotoPreviewLoading] = useState({});
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState({});
  const [busy, setBusy] = useState('');

  useEffect(() => subscribeReportWorkspaces((rows) => setWorkspaces(rows || []), () => showToast('Erro ao carregar workspaces.', 'error')), [showToast]);
  useEffect(() => subscribeProjects((rows) => setProjects(rows || []), () => showToast('Erro ao carregar empreendimentos.', 'error')), [showToast]);
  useEffect(() => subscribeReportCompounds((rows) => setCompounds(rows || []), () => showToast('Erro ao carregar compostos.', 'error')), [showToast]);

  useEffect(() => {
    listProfissoes().then(setProfissoes).catch(() => {});
    listSignatarios().then(setSignatariosCandidatos).catch(() => {});
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const fallbackId = String(projects[0]?.id || '');
    if (!selectedProjectId) setSelectedProjectId(fallbackId);
    if (!workspaceDraft.projectId) setWorkspaceDraft((prev) => ({ ...prev, projectId: fallbackId }));
  }, [projects, selectedProjectId, workspaceDraft.projectId]);

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

  const libraryQueryFilters = useMemo(
    () => buildProjectPhotoFilters(libraryFilters),
    [libraryFilters],
  );

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectPhotos([]);
      return;
    }
    let cancelled = false;
    listProjectPhotos(selectedProjectId, libraryQueryFilters)
      .then((photos) => {
        if (cancelled) return;
        setProjectPhotos(Array.isArray(photos) ? photos : []);
      })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar fotos do empreendimento.', 'error'));
    return () => { cancelled = true; };
  }, [libraryQueryFilters, selectedProjectId, showToast]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectDossiers([]);
      setProjectDossierPreflights({});
      return;
    }
    let cancelled = false;
    refreshProjectDossiers(selectedProjectId)
      .then((dossiers) => {
        if (cancelled) return;
        setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
        setProjectDossierPreflights({});
      })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar dados do empreendimento.', 'error'));
    return () => { cancelled = true; };
  }, [selectedProjectId, showToast]);

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

  useEffect(() => {
    if (!workspaceImportTargetId) {
      setWorkspacePhotos([]);
      setWorkspacePhotoDrafts({});
      setLastPersistedWorkspaceDraftSignature('');
      setTowerFilter('');
      setWorkspaceTextsDraft({ introducao: '', observacoes: '' });
      setWorkspaceAutosave({ status: 'idle', savedAt: '', error: '' });
      return;
    }

    let cancelled = false;
    listReportWorkspacePhotos(workspaceImportTargetId)
      .then((photos) => {
        if (cancelled) return;
        const nextPhotos = Array.isArray(photos) ? photos : [];
        const nextDrafts = buildWorkspacePhotoDrafts(
          nextPhotos,
          getPersistedWorkspaceCurationDrafts(selectedWorkspace),
        );
        setWorkspacePhotos(nextPhotos);
        setWorkspacePhotoDrafts(nextDrafts);
        setLastPersistedWorkspaceDraftSignature(JSON.stringify(nextDrafts));
        setWorkspaceAutosave({
          status: selectedWorkspace?.draftState?.autosave?.savedAt ? 'saved' : 'idle',
          savedAt: String(selectedWorkspace?.draftState?.autosave?.savedAt || ''),
          error: '',
        });
      })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar fotos do workspace.', 'error'));

    return () => { cancelled = true; };
  }, [workspaceImportTargetId, selectedWorkspace, showToast]);

  useEffect(() => {
    setDeletedPhotoIds([]);
    setLastDeletedPhotoId('');
    setActivePreviewPhotoId('');
    setPhotoPreviewLoading({});
    setPhotoPreviewFailed({});

    setPhotoPreviewUrls((prev) => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        Object.values(prev).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
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

  const projectTowerOptions = useMemo(
    () => getProjectTowerList(selectedProject),
    [selectedProject],
  );

  const libraryTowerOptions = useMemo(
    () => Array.from(new Set([
      ...projectTowerOptions,
      ...projectPhotos.map((photo) => String(photo.towerId || '').trim()).filter(Boolean),
    ])),
    [projectPhotos, projectTowerOptions],
  );

  const workspaceTowerOptions = useMemo(
    () => getProjectTowerList(selectedWorkspaceProject),
    [selectedWorkspaceProject],
  );

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

  const [towerFilter, setTowerFilter] = useState('');

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

  const activePreviewPhoto = useMemo(
    () => workspacePhotos.find((photo) => photo.id === activePreviewPhotoId) || null,
    [activePreviewPhotoId, workspacePhotos],
  );

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

  const activeImportMode = IMPORT_MODES[workspaceImportMode] || IMPORT_MODES.loose_photos;

  const workspaceDraftSnapshot = useMemo(
    () => Object.fromEntries(
      workspacePhotos.map((photo) => [
        photo.id,
        workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo),
      ]),
    ),
    [workspacePhotoDrafts, workspacePhotos],
  );

  const workspaceDraftSignature = useMemo(
    () => JSON.stringify(workspaceDraftSnapshot),
    [workspaceDraftSnapshot],
  );

  const uploadPercent = uploadProgress.total > 0
    ? Math.min(100, Math.round((uploadProgress.completed / uploadProgress.total) * 100))
    : 0;

  useEffect(() => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;

    const pendingPreviews = visibleWorkspacePhotos
      .filter((photo) => {
        const mediaAssetId = String(photo.mediaAssetId || '').trim();
        return mediaAssetId
          && !photoPreviewUrls[photo.id]
          && !photoPreviewLoading[photo.id]
          && !photoPreviewFailed[photo.id];
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
          // Falha de preview nao deve interromper a curadoria.
          setPhotoPreviewFailed((prev) => ({ ...prev, [photo.id]: true }));
        } finally {
          if (!cancelled) {
            setPhotoPreviewLoading((prev) => ({ ...prev, [photo.id]: false }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoPreviewFailed, visibleWorkspacePhotos]);

  function handleMovePhotoToTrash(photoId) {
    const normalizedPhotoId = String(photoId || '').trim();
    if (!normalizedPhotoId) return;

    setDeletedPhotoIds((prev) => (prev.includes(normalizedPhotoId) ? prev : [...prev, normalizedPhotoId]));
    setLastDeletedPhotoId(normalizedPhotoId);
    if (activePreviewPhotoId === normalizedPhotoId) {
      setActivePreviewPhotoId('');
    }
  }

  function handleUndoLastDeletedPhoto() {
    const targetId = String(lastDeletedPhotoId || '').trim();
    if (!targetId) return;

    setDeletedPhotoIds((prev) => prev.filter((photoId) => photoId !== targetId));
    setLastDeletedPhotoId('');
  }

  function handleRestoreAllDeletedPhotos() {
    setDeletedPhotoIds([]);
    setLastDeletedPhotoId('');
  }

  async function handleEmptyTrash() {
    if (!selectedWorkspace || deletedPhotoIds.length === 0) return;

    if (!window.confirm(`Tem certeza que deseja APELAR FINALMENTE ${deletedPhotoIds.length} foto(s) do workspace? Isso apagara os registros do relatorio definitivamente e nao pode ser desfeito.`)) {
      return;
    }

    setBusy('empty-trash');
    let successCount = 0;

    for (const photoId of deletedPhotoIds) {
      if (!photoId) continue;
      try {
        await deleteReportWorkspacePhoto(selectedWorkspace.id, photoId);
        successCount++;
      } catch (error) {
        console.error('Falha ao deletar foto permanentemente', photoId, error);
      }
    }

    setBusy('');

    if (successCount > 0) {
      showToast(`${successCount} foto(s) apagada(s) do workspace definitivamente.`, 'success');
      await refreshWorkspacePhotos(selectedWorkspace.id);
      setDeletedPhotoIds([]);
      setLastDeletedPhotoId('');
    } else {
      showToast('Nenhuma foto pode ser apagada do servidor.', 'error');
    }
  }

  async function refreshWorkspacePhotos(workspaceId) {
    if (!workspaceId) {
      setWorkspacePhotos([]);
      setWorkspacePhotoDrafts({});
      return [];
    }

    const photos = await listReportWorkspacePhotos(workspaceId);
    const nextPhotos = Array.isArray(photos) ? photos : [];
    const workspace = workspaces.find((item) => item.id === workspaceId) || null;
    const nextDrafts = buildWorkspacePhotoDrafts(
      nextPhotos,
      getPersistedWorkspaceCurationDrafts(workspace),
    );
    setWorkspacePhotos(nextPhotos);
    setWorkspacePhotoDrafts(nextDrafts);
    return nextPhotos;
  }

  async function refreshProjectPhotos(projectId) {
    if (!projectId) {
      setProjectPhotos([]);
      return [];
    }

    const photos = await listProjectPhotos(projectId, libraryQueryFilters);
    const nextPhotos = Array.isArray(photos) ? photos : [];
    setProjectPhotos(nextPhotos);
    return nextPhotos;
  }

  async function refreshProjectDossiers(projectId) {
    if (!projectId) {
      setProjectDossiers([]);
      return [];
    }

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

  useEffect(() => {
    if (!selectedWorkspace || workspacePhotos.length === 0) return undefined;
    if (workspaceDraftSignature === lastPersistedWorkspaceDraftSignature) {
      return undefined;
    }

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
        autosave: {
          status: 'saved',
          savedAt,
          photoCount: workspacePhotos.length,
        },
      };
      setWorkspaceAutosave({ status: 'saving', savedAt: '', error: '' });

      try {
        const result = await updateReportWorkspace(
          selectedWorkspace.id,
          {
            draftState: nextDraftState,
          },
          { updatedBy: userEmail || 'web' },
        );

        setWorkspaces((prev) => prev.map((workspace) => (
          workspace.id === selectedWorkspace.id
            ? {
              ...workspace,
              ...(result?.data || {}),
              draftState: nextDraftState,
            }
            : workspace
        )));
        setLastPersistedWorkspaceDraftSignature(workspaceDraftSignature);
        setWorkspaceAutosave({ status: 'saved', savedAt, error: '' });
      } catch (error) {
        setWorkspaceAutosave({
          status: 'error',
          savedAt: '',
          error: error?.message || 'Erro ao autosalvar rascunho do workspace.',
        });
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [
    lastPersistedWorkspaceDraftSignature,
    selectedWorkspace,
    userEmail,
    workspaceDraftSignature,
    workspaceDraftSnapshot,
    workspacePhotos.length,
  ]);

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
          if (!cancelled) {
            setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
          }
        }

        const nextCompounds = await listReportCompounds();
        if (!cancelled) {
          setCompounds(Array.isArray(nextCompounds) ? nextCompounds : []);
        }

        const pendingKmzRequests = Object.entries(workspaceKmzRequests)
          .filter(([, requestEntry]) => requestEntry?.token && isPendingExecutionStatus(requestEntry?.statusExecucao));

        if (pendingKmzRequests.length > 0) {
          const refreshedRequests = await Promise.all(
            pendingKmzRequests.map(async ([workspaceId, requestEntry]) => {
              const result = await getWorkspaceKmzRequest(workspaceId, requestEntry.token);
              return [workspaceId, result?.data || requestEntry];
            }),
          );

          if (!cancelled) {
            setWorkspaceKmzRequests((prev) => ({
              ...prev,
              ...Object.fromEntries(refreshedRequests),
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error?.message || 'Erro ao atualizar status dos relatórios.', 'error');
        }
      }
    };

    const intervalId = window.setInterval(() => {
      runRefresh();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasPendingReportOutputs, selectedProjectId, showToast, workspaceKmzRequests]);

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
    await completeMediaUpload({
      id: mediaAsset?.id,
      storedSizeBytes: file.size,
    }, { updatedBy: userEmail || 'web' });

    if (metadata.skipPhotoRegistration) {
      return { mediaAssetId: mediaAsset?.id, photoId: null };
    }

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
      setProjectDossierPreflights((prev) => ({
        ...prev,
        [dossier.id]: result?.data || null,
      }));
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
      const downloaded = triggerBlobDownload(
        fileName || sanitizeDownloadName(`relatorio-${mediaId}.docx`),
        result?.blob,
      );
      if (!downloaded) {
        throw new Error('Ambiente sem suporte para disparar o download.');
      }
      showToast('DOCX baixado com sucesso.', 'success', 4500);
    } catch (error) {
      showToast(error?.message || 'Erro ao baixar o DOCX final.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCreateCompound() {
    if (!String(compoundDraft.nome || '').trim()) {
      showToast('Informe um nome para o relatorio composto.', 'error');
      return;
    }
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
          nome_lt: trimField('nome_lt'),
          titulo_programa: trimField('titulo_programa'),
          codigo_documento: trimField('codigo_documento'),
          revisao: trimField('revisao') || '00',
          introducao: trimField('introducao'),
          caracterizacao_tecnica: trimField('caracterizacao_tecnica'),
          descricao_atividades: trimField('descricao_atividades'),
          conclusoes: trimField('conclusoes'),
          analise_evolucao: trimField('analise_evolucao'),
          observacoes: trimField('observacoes'),
          elaboradores: elaboradoresArr,
          revisores: revisoresArr,
        },
        status: 'draft',
        workspaceIds: [],
        orderJson: [],
      }, { updatedBy: userEmail || 'web' });
      setCompoundDraft({
        nome: '', nome_lt: '', titulo_programa: '', codigo_documento: '', revisao: '00',
        introducao: '', caracterizacao_tecnica: '', descricao_atividades: '',
        conclusoes: '', analise_evolucao: '', observacoes: '',
        elaboradores: {}, revisores: {},
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
    if (!compound?.id || !workspaceId) {
      showToast('Selecione um workspace para adicionar ao relatorio composto.', 'error');
      return;
    }

    try {
      setBusy(`compound-add:${compound.id}`);
      const result = await addWorkspaceToReportCompound(compound.id, workspaceId, { updatedBy: userEmail || 'web' });
      const savedCompound = result?.data;
      if (savedCompound?.id) {
        setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      }
      setCompoundWorkspaceSelections((prev) => ({ ...prev, [compound.id]: '' }));
      setCompoundPreflights((prev) => {
        const next = { ...prev };
        delete next[compound.id];
        return next;
      });
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
      setCompoundPreflights((prev) => ({
        ...prev,
        [compound.id]: result?.data || null,
      }));
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
      if (savedCompound?.id) {
        setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      } else {
        await refreshCompounds();
      }
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
      if (savedCompound?.id) {
        setCompounds((prev) => prev.map((item) => (item.id === savedCompound.id ? savedCompound : item)));
      }
      showToast('Ordem do relatorio composto atualizada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao reordenar relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handlePhotoExport() {
    if (!selectedProjectId) {
      showToast('Selecione um empreendimento para exportar as fotos.', 'error');
      return;
    }
    try {
      setBusy('export');
      const result = await requestProjectPhotoExport(selectedProjectId, {
        folderMode: 'tower',
        filters: libraryQueryFilters,
      }, { updatedBy: userEmail || 'web' });
      const token = String(result?.data?.token || '');
      const itemCount = Number(result?.data?.itemCount || 0);

      if (itemCount <= 0) {
        showToast('Nenhuma foto corresponde ao recorte atual da biblioteca.', 'error');
        return;
      }

      if (!token) {
        throw new Error('Token da exportacao nao foi retornado pela API.');
      }

      const download = await downloadProjectPhotoExport(selectedProjectId, token);
      triggerBlobDownload(download.fileName, download.blob);
      showToast(`ZIP exportado com ${itemCount} foto(s).`, 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao solicitar exportacao.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleImportWorkspace() {
    if (!workspaceImportTargetId) {
      showToast('Selecione um workspace para importar as fotos.', 'error');
      return;
    }
    if (pendingFiles.length === 0) {
      showToast('Selecione ao menos um arquivo para importar.', 'error');
      return;
    }

    const workspace = workspaces.find((item) => item.id === workspaceImportTargetId);
    if (!workspace) {
      showToast('Workspace alvo nao encontrado.', 'error');
      return;
    }

    try {
      setBusy('workspace-import');
      setUploadProgress({
        total: pendingFiles.length,
        completed: 0,
        currentFileName: String(pendingFiles[0]?.name || ''),
      });
      const uploadedMediaIds = [];
      const warnings = [];

      if (workspaceImportMode === 'organized_kmz') {
        const kmzFile = pendingFiles[0];
        setUploadProgress({
          total: 1,
          completed: 0,
          currentFileName: String(kmzFile?.name || ''),
        });
        const uploaded = await uploadWorkspaceFile(
          kmzFile,
          workspace,
          0,
          'organized_kmz',
          { purpose: 'workspace-import', skipPhotoRegistration: true },
        );
        uploadedMediaIds.push(uploaded.mediaAssetId);
        setUploadProgress({
          total: 1,
          completed: 1,
          currentFileName: String(kmzFile?.name || ''),
        });

        const processResult = await processWorkspaceKmz(workspace.id, {
          mediaAssetId: uploaded.mediaAssetId,
        }, { updatedBy: userEmail || 'web' });

        const summary = processResult?.data?.summary || {};
        if (Array.isArray(summary.warnings)) warnings.push(...summary.warnings);

        const parts = [];
        if (summary.photosCreated > 0) parts.push(`${summary.photosCreated} foto(s) importada(s)`);
        if (summary.towersInferred > 0) parts.push(`${summary.towersInferred} torre(s) inferida(s)`);
        if (summary.pendingLinkage > 0) parts.push(`${summary.pendingLinkage} pendente(s)`);
        if (summary.photosSkipped > 0) parts.push(`${summary.photosSkipped} duplicada(s) ignorada(s)`);
        const toastMsg = parts.length > 0 ? `KMZ processado: ${parts.join(', ')}.` : 'KMZ processado (nenhuma foto encontrada).';
        showToast(toastMsg, 'success');
      } else {
        let inferredTowerCount = 0;
        let pendingTowerCount = 0;

        for (const [index, file] of pendingFiles.entries()) {
          setUploadProgress({
            total: pendingFiles.length,
            completed: index,
            currentFileName: String(file?.name || ''),
          });
          const inferredTowerId = workspaceImportMode === 'tower_subfolders'
            ? inferTowerIdFromRelativePath(file.webkitRelativePath || file.name)
            : '';

          const uploaded = await uploadWorkspaceFile(
            file,
            workspace,
            index,
            workspaceImportMode,
            { inferredTowerId },
          );

          uploadedMediaIds.push(uploaded.mediaAssetId);
          setUploadProgress({
            total: pendingFiles.length,
            completed: index + 1,
            currentFileName: String(file?.name || ''),
          });
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
          summaryJson: {
            filesReceived: pendingFiles.length,
            uploadedMediaIds,
            inferredTowerCount,
            pendingTowerCount,
          },
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

    if (!workspace) {
      showToast('Selecione um workspace valido para salvar a curadoria.', 'error');
      return;
    }

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

      const result = await saveReportWorkspacePhoto(
        workspace.id,
        photo.id,
        nextData,
        { updatedBy: userEmail || 'web' },
      );

      const savedPhoto = result?.data || { ...photo, ...nextData };
      setWorkspacePhotos((prev) => prev.map((item) => (item.id === photo.id ? savedPhoto : item)));
      setWorkspacePhotoDrafts((prev) => ({
        ...prev,
        [photo.id]: buildWorkspacePhotoDraft(savedPhoto),
      }));
      setProjectPhotos((prev) => prev.map((item) => (item.id === photo.id ? savedPhoto : item)));
      showToast('Curadoria da foto salva.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar curadoria da foto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleRequestWorkspaceKmz() {
    if (!selectedWorkspace?.id) {
      showToast('Selecione um workspace para gerar o KMZ.', 'error');
      return;
    }

    try {
      setBusy('workspace-kmz');
      const result = await requestWorkspaceKmz(selectedWorkspace.id, { updatedBy: userEmail || 'web' });
      const requestEntry = result?.data || {};
      setWorkspaceKmzRequests((prev) => ({
        ...prev,
        [selectedWorkspace.id]: requestEntry,
      }));
      showToast('KMZ com fotos enfileirado para o workspace atual.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao solicitar KMZ do workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDownloadWorkspaceKmz(requestEntry) {
    const mediaId = String(requestEntry?.outputKmzMediaId || '').trim();
    if (!mediaId || !selectedWorkspace?.id) {
      showToast('O KMZ ainda nao esta pronto para download.', 'error');
      return;
    }

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

  async function handleSaveWorkspaceTexts() {
    if (!selectedWorkspace?.id) return;
    try {
      setBusy('workspace-texts');
      await updateReportWorkspace(
        selectedWorkspace.id,
        { texts: workspaceTextsDraft },
        { updatedBy: userEmail || 'web' },
      );
      showToast('Textos do workspace salvos.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao salvar textos do workspace.', 'error');
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
      content = 'ID,Torre,Legenda,No Relatorio\n' + rows.map((r) =>
        `"${r.id}","${r.tower}","${r.caption.replace(/"/g, '""')}",${r.included}`,
      ).join('\n');
      mimeType = 'text/csv;charset=utf-8';
      ext = 'csv';
    } else {
      content = '| ID | Torre | Legenda | No Relatorio |\n|---|---|---|---|\n' + rows.map((r) =>
        `| ${r.id} | ${r.tower} | ${r.caption} | ${r.included ? 'Sim' : 'Nao'} |`,
      ).join('\n');
      mimeType = 'text/markdown;charset=utf-8';
      ext = 'md';
    }

    const blob = new Blob([content], { type: mimeType });
    const name = (selectedWorkspace?.nome || selectedWorkspace?.id || 'workspace').replace(/\s+/g, '_');
    triggerBlobDownload(`${name}-legendas.${ext}`, blob);
  }

  const selectedWorkspaceKmzRequest = selectedWorkspace?.id
    ? (workspaceKmzRequests[selectedWorkspace.id] || null)
    : null;

  return (
    <section className="flex flex-col gap-5 p-2">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-xl font-bold text-slate-800"><AppIcon name="file-text" />Relatorios</h2>
        <p className="mt-1 text-sm text-slate-500">O modulo passa a separar workspaces, biblioteca agregada de fotos, dossies por empreendimento e relatorios compostos.</p>
      </div>

      <Card variant="nested" className="flex flex-wrap gap-2">
        {TABS.map(([id, label, icon]) => (
          <Button key={id} size="sm" variant={tab === id ? 'primary' : 'outline'} onClick={() => setTab(id)}>
            <AppIcon name={icon} />
            {label}
          </Button>
        ))}
      </Card>

      {tab === 'workspaces' ? (
        <>
          <Card variant="nested">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <span>Fluxo do Workspace</span>
              <HintText label="Fluxo do workspace">O fluxo guiado substitui a logica dispersa e prepara curadoria, textos, preflight e geracao.</HintText>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STEPS.map(([label, hint], index) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-slate-500">
                    <span>Etapa {index + 1}</span>
                    <HintText label={label}>{hint}</HintText>
                  </div>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SearchableSelect id="rw-project" label="Empreendimento" hint="Toda inferencia espacial acontece dentro do empreendimento selecionado." value={workspaceDraft.projectId} onChange={(val) => { setWorkspaceDraft((prev) => ({ ...prev, projectId: val })); setSelectedProjectId(val); }} options={projectOptions} placeholder="Buscar empreendimento..." />
            <Input id="rw-name" label="Nome" value={workspaceDraft.nome} onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: RT LT Norte - Abril" />
            <Input id="rw-desc" label="Descricao" hint="Os textos-base do empreendimento serao copiados para um rascunho editavel." value={workspaceDraft.descricao} onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, descricao: event.target.value }))} placeholder="Escopo, periodo ou observacoes" />
            <div className="md:col-span-3 flex justify-end">
              <Button onClick={handleCreateWorkspace} disabled={busy === 'workspace'}><AppIcon name="plus" />{busy === 'workspace' ? 'Criando...' : 'Criar Workspace'}</Button>
            </div>
          </Card>

          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Select id="rw-import-target" label="Workspace Alvo" hint="A importacao e a curadoria sempre acontecem dentro do workspace selecionado." value={workspaceImportTargetId} onChange={(event) => setWorkspaceImportTargetId(event.target.value)}>
              <option value="">Selecione...</option>
              {workspaceCandidates.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.nome || workspace.id}</option>)}
            </Select>
            <Select id="rw-import-mode" label="Modo de Importacao" hint="Os contratos do backend ja aceitam `fotos soltas`, `subpastas por torre` e `KMZ organizado`." value={workspaceImportMode} onChange={(event) => { setWorkspaceImportMode(event.target.value); setPendingFiles([]); }}>
              {Object.entries(IMPORT_MODES).map(([mode, config]) => (
                <option key={mode} value={mode}>{config.label}</option>
              ))}
            </Select>
            <Input
              key={workspaceImportMode}
              id="rw-import-files"
              label={activeImportMode.inputLabel}
              hint={activeImportMode.hint}
              type="file"
              accept={activeImportMode.accept}
              multiple={activeImportMode.multiple}
              webkitdirectory={workspaceImportMode === 'tower_subfolders' ? '' : undefined}
              directory={workspaceImportMode === 'tower_subfolders' ? '' : undefined}
              onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
            />
            <div className="flex items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">
                <div className="font-bold uppercase tracking-wide text-slate-600">Selecao Atual</div>
                <div>{activeImportMode.label}</div>
                <div>{pendingFiles.length} arquivo(s) pronto(s) para envio.</div>
                {busy === 'workspace-import' ? (
                  <>
                    <div className="mt-2 font-semibold text-slate-700">
                      Progresso: {uploadProgress.completed}/{uploadProgress.total} ({uploadPercent}%)
                    </div>
                    {uploadProgress.currentFileName ? (
                      <div className="truncate" title={uploadProgress.currentFileName}>
                        Arquivo atual: {uploadProgress.currentFileName}
                      </div>
                    ) : null}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <Button onClick={handleImportWorkspace} disabled={busy === 'workspace-import' || !workspaceImportTargetId || pendingFiles.length === 0}>
                <AppIcon name={workspaceImportMode === 'organized_kmz' ? 'file-text' : 'upload'} />
                {busy === 'workspace-import'
                  ? (workspaceImportMode === 'organized_kmz' ? 'Registrando...' : 'Enviando...')
                  : activeImportMode.buttonLabel}
              </Button>
            </div>
          </Card>

          <Card variant="nested" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>Curadoria do Workspace</span>
                <HintText label="Curadoria do workspace">Edite legenda, torre e inclusao da foto usando o workspace alvo atual. A organizacao automatica mais rica continua pendente.</HintText>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {selectedWorkspace ? `${selectedWorkspace.nome || selectedWorkspace.id} • ${workspaceMetrics.total} foto(s)` : 'Selecione um workspace para comecar a curadoria.'}
                </span>
                {selectedWorkspace ? (
                  <span className={`rounded-full px-2 py-1 ${tone(workspaceAutosave.status)}`}>
                    {workspaceAutosave.status === 'saving' ? 'Autosave salvando...' : null}
                    {workspaceAutosave.status === 'pending' ? 'Autosave pendente' : null}
                    {workspaceAutosave.status === 'saved' ? `Autosave salvo ${fmt(workspaceAutosave.savedAt)}` : null}
                    {workspaceAutosave.status === 'error' ? 'Autosave com erro' : null}
                    {workspaceAutosave.status === 'idle' ? 'Autosave inativo' : null}
                  </span>
                ) : null}
                {selectedWorkspaceKmzRequest ? (
                  <span className={`rounded-full px-2 py-1 ${tone(selectedWorkspaceKmzRequest.statusExecucao)}`}>
                    KMZ: {selectedWorkspaceKmzRequest.statusExecucao || 'queued'}
                  </span>
                ) : null}
              </div>
            </div>
            {selectedWorkspace && workspaceAutosave.status === 'error' ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {workspaceAutosave.error || 'Erro ao autosalvar rascunho do workspace.'}
              </div>
            ) : null}
            {selectedWorkspaceKmzRequest?.lastError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {selectedWorkspaceKmzRequest.lastError}
              </div>
            ) : null}

            {selectedWorkspace ? (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="flex h-fit flex-col gap-3 xl:sticky xl:top-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="m-0 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace Ativo</p>
                      <p className="mt-2 mb-1 text-sm font-bold text-slate-800">{selectedWorkspace.nome || selectedWorkspace.id}</p>
                      <p className="m-0 text-xs text-slate-500">{selectedWorkspace.id}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="m-0 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Resumo Persistente</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                          {workspaceCurationSummary.completionPercent}% curado
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${workspaceCurationSummary.completionPercent}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                          <strong className="text-slate-800">{workspaceMetrics.total}</strong>
                          <p className="mt-1 mb-0 text-slate-500">Fotos</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
                          <strong className="text-emerald-700">{workspaceCurationSummary.curated}</strong>
                          <p className="mt-1 mb-0 text-emerald-700">Curadas</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                          <strong className="text-amber-700">{workspaceCurationSummary.pending}</strong>
                          <p className="mt-1 mb-0 text-amber-700">Pendentes</p>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2">
                          <strong className="text-blue-700">{workspaceMetrics.included}</strong>
                          <p className="mt-1 mb-0 text-blue-700">No relatorio</p>
                        </div>
                      </div>
                      <p className="mt-3 mb-0 text-xs text-slate-500">
                        Falta curadoria completa em {workspaceMetrics.missingCaption} sem legenda e {workspaceMetrics.missingTower} sem torre.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="m-0 mb-3 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Textos do Relatorio</p>
                      <div className="flex flex-col gap-3">
                        <Textarea
                          id="ws-texto-intro"
                          label="Introducao"
                          hint="Texto de introducao do workspace no DOCX."
                          rows={3}
                          value={workspaceTextsDraft.introducao}
                          onChange={(event) => setWorkspaceTextsDraft((prev) => ({ ...prev, introducao: event.target.value }))}
                          placeholder="Descreva o contexto desta campanha..."
                        />
                        <Textarea
                          id="ws-texto-obs"
                          label="Observacoes"
                          hint="Texto de observacoes ao final do workspace no DOCX."
                          rows={2}
                          value={workspaceTextsDraft.observacoes}
                          onChange={(event) => setWorkspaceTextsDraft((prev) => ({ ...prev, observacoes: event.target.value }))}
                          placeholder="Observacoes gerais ou pendencias..."
                        />
                        <Button variant="outline" onClick={handleSaveWorkspaceTexts} disabled={busy === 'workspace-texts'}>
                          <AppIcon name="save" />
                          {busy === 'workspace-texts' ? 'Salvando...' : 'Salvar Textos'}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={handleRequestWorkspaceKmz}
                          disabled={busy === 'workspace-kmz' || !selectedWorkspace}
                        >
                          <AppIcon name="file-text" />
                          {busy === 'workspace-kmz' ? 'Enfileirando KMZ...' : 'Gerar KMZ com Fotos'}
                        </Button>
                        {selectedWorkspaceKmzRequest?.outputKmzMediaId ? (
                          <Button
                            variant="outline"
                            onClick={() => handleDownloadWorkspaceKmz(selectedWorkspaceKmzRequest)}
                            disabled={busy === `download:${selectedWorkspaceKmzRequest.outputKmzMediaId}`}
                          >
                            <AppIcon name="download" />
                            {busy === `download:${selectedWorkspaceKmzRequest.outputKmzMediaId}` ? 'Baixando...' : 'Baixar KMZ'}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="m-0 mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Torres</p>
                      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                        <button
                          type="button"
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${!towerFilter ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                          onClick={() => setTowerFilter('')}
                        >
                          <span>Todas</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-slate-600">{visibleWorkspacePhotos.length}</span>
                        </button>
                        {(photoCountsByTower.__none__ || 0) > 0 && (
                          <button
                            type="button"
                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${towerFilter === '__none__' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            onClick={() => setTowerFilter('__none__')}
                          >
                            <span className="italic">Sem torre</span>
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">{photoCountsByTower.__none__}</span>
                          </button>
                        )}
                        {workspaceTowerOptions.filter((tower) => (photoCountsByTower[tower] || 0) > 0).map((tower) => (
                          <button
                            key={tower}
                            type="button"
                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${towerFilter === tower ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            onClick={() => setTowerFilter(tower)}
                          >
                            <span>Torre {tower}</span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-slate-600">{photoCountsByTower[tower] || 0}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="m-0 mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">Exportar Legendas</p>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={() => handleExportCaptions('csv')} disabled={visibleWorkspacePhotos.length === 0}>
                          <AppIcon name="download" />
                          CSV
                        </Button>
                        <Button variant="outline" onClick={() => handleExportCaptions('md')} disabled={visibleWorkspacePhotos.length === 0}>
                          <AppIcon name="download" />
                          Markdown
                        </Button>
                      </div>
                    </div>
                  </aside>

                  <div className="flex min-w-0 w-full flex-col gap-3">
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{workspaceCurationSummary.reviewed} revisadas</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{workspaceCurationSummary.curated} aptas</span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{workspaceCurationSummary.pending} pendentes</span>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{workspaceMetrics.included} marcadas para o DOCX</span>
                        {towerFilter && (
                          <button type="button" className="rounded-full bg-brand-100 px-2 py-1 text-brand-700 hover:bg-brand-200 transition-colors" onClick={() => setTowerFilter('')}>
                            {towerFilter === '__none__' ? 'Sem torre' : `Torre ${towerFilter}`} ({filteredWorkspacePhotos.length}) ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {deletedPhotoIds.length > 0 ? (
                        <div className="col-span-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 sm:col-span-2 lg:col-span-3 2xl:col-span-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-rose-800">
                            <span className="font-semibold px-1">{deletedPhotoIds.length} foto(s) pendentes na lixeira.</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" onClick={handleUndoLastDeletedPhoto} disabled={!lastDeletedPhotoId || busy === 'empty-trash'}>
                                <AppIcon name="chevron-left" />Desfazer ultima
                              </Button>
                              <Button variant="outline" onClick={handleRestoreAllDeletedPhotos} disabled={busy === 'empty-trash'}>
                                <AppIcon name="reset" />Restaurar todas
                              </Button>
                              <div className="flex pl-2 border-l border-rose-200 ml-1">
                                <Button onClick={handleEmptyTrash} disabled={busy === 'empty-trash'} className="bg-rose-600 hover:bg-rose-700 text-white border-0">
                                  <AppIcon name="trash" className="text-white" />
                                  {busy === 'empty-trash' ? 'Esvaziando...' : 'Esvaziar Definitivo'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {filteredWorkspacePhotos.map((photo) => {
                    const draft = workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo);
                    const dirty = isWorkspacePhotoDirty(photo, draft);
                    const currentStatus = getWorkspacePhotoStatus(photo, draft);
                    const towerOptions = draft.towerId && !workspaceTowerOptions.includes(draft.towerId)
                      ? [draft.towerId, ...workspaceTowerOptions]
                      : workspaceTowerOptions;
                    const previewUrl = photoPreviewUrls[photo.id];
                    const previewLoading = Boolean(photoPreviewLoading[photo.id]);

                    return (
                      <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {previewUrl ? (
                            <button
                              type="button"
                              className="block w-full"
                              onClick={() => setActivePreviewPhotoId(photo.id)}
                              title="Abrir preview da foto"
                            >
                              <img
                                src={previewUrl}
                                alt={draft.caption || photo.id}
                                className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-105"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="flex aspect-[4/3] w-full items-center justify-center text-xs text-slate-500">
                              {previewLoading ? 'Carregando miniatura...' : 'Miniatura indisponivel'}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <strong className="text-slate-800">{photo.id}</strong>
                            <p className="mt-1 mb-0 text-xs text-slate-500">
                              Origem: {photo.importSource || '-'} • Torre sugerida: {photo.towerId || '-'} ({photo.towerSource || 'pendente'})
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={() => setActivePreviewPhotoId(photo.id)}>
                              <AppIcon name="details" />Visualizar
                            </Button>
                            <Button variant="outline" onClick={() => handleMovePhotoToTrash(photo.id)}>
                              <AppIcon name="trash" />Lixeira
                            </Button>
                            {dirty ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Alteracoes pendentes</span> : null}
                            <span className={`rounded-full px-2 py-1 text-xs ${tone(currentStatus)}`}>{currentStatus}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-4">
                          <Input
                            id={`rw-photo-caption-${photo.id}`}
                            label="Legenda"
                            value={draft.caption}
                            onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                              ...prev,
                              [photo.id]: {
                                ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                caption: event.target.value,
                              },
                            }))}
                            placeholder="Descreva a foto que vai para o relatorio"
                          />
                          <Select
                            id={`rw-photo-tower-${photo.id}`}
                            label="Torre"
                            value={draft.towerId}
                            onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                              ...prev,
                              [photo.id]: {
                                ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                towerId: event.target.value,
                              },
                            }))}
                          >
                            <option value="">Pendente</option>
                            {towerOptions.map((towerId) => (
                              <option key={towerId} value={towerId}>{towerId}</option>
                            ))}
                          </Select>
                          
                          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <label htmlFor={`rw-photo-include-${photo.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                id={`rw-photo-include-${photo.id}`}
                                className="shrink-0"
                                type="checkbox"
                                checked={Boolean(draft.includeInReport)}
                                onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                                  ...prev,
                                  [photo.id]: {
                                    ...(prev[photo.id] || buildWorkspacePhotoDraft(photo)),
                                    includeInReport: event.target.checked,
                                  },
                                }))}
                              />
                              <span>Incluir no relatorio</span>
                            </label>
                            
                            <Button
                              variant={dirty ? 'primary' : 'outline'}
                              onClick={() => handleSaveWorkspacePhoto(photo)}
                              disabled={busy === `photo:${photo.id}` || !dirty}
                            >
                              <AppIcon name="save" />
                              {busy === `photo:${photo.id}` ? 'Salvando...' : 'Salvar Curadoria'}
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                      })}
                      {visibleWorkspacePhotos.length === 0 ? (
                        <div className="col-span-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                          Nenhuma foto visivel para curadoria neste workspace.
                        </div>
                      ) : null}
                    </div>

                    {activePreviewPhoto ? (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
                        <div className="flex max-h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl xl:max-w-screen-2xl">
                          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shrink-0">
                            <strong className="text-slate-800">Preview da Foto - {activePreviewPhoto.id}</strong>
                            <button
                              type="button"
                              className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                              onClick={() => setActivePreviewPhotoId('')}
                            >
                              Fechar
                            </button>
                          </div>
                          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
                            <div className="flex items-center justify-center bg-slate-950 p-4">
                              {photoPreviewUrls[activePreviewPhoto.id] ? (
                                <img
                                  src={photoPreviewUrls[activePreviewPhoto.id]}
                                  alt={workspacePhotoDrafts[activePreviewPhoto.id]?.caption || activePreviewPhoto.id}
                                  className="max-h-[80vh] w-full rounded-lg object-contain"
                                />
                              ) : (
                                <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-200">
                                  Preview indisponivel para esta foto.
                                </div>
                              )}
                            </div>
                            <div className="p-4 text-sm text-slate-600">
                              <p className="m-0"><strong>ID:</strong> {activePreviewPhoto.id}</p>
                              <p className="mt-2 mb-0"><strong>Origem:</strong> {activePreviewPhoto.importSource || '-'}</p>
                              <p className="mt-2 mb-0"><strong>Torre sugerida:</strong> {workspacePhotoDrafts[activePreviewPhoto.id]?.towerId || activePreviewPhoto.towerId || 'Pendente'}</p>
                              
                              <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <Textarea
                                  id={`modal-caption-${activePreviewPhoto.id}`}
                                  label="Editar Legenda"
                                  rows={3}
                                  value={workspacePhotoDrafts[activePreviewPhoto.id]?.caption || ''}
                                  onChange={(event) => setWorkspacePhotoDrafts((prev) => ({
                                    ...prev,
                                    [activePreviewPhoto.id]: {
                                      ...(prev[activePreviewPhoto.id] || buildWorkspacePhotoDraft(activePreviewPhoto)),
                                      caption: event.target.value,
                                    },
                                  }))}
                                  placeholder="Detalhe os achados operacionais desta foto..."
                                />
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-500">A legenda sera salva neste workspace.</span>
                                  <Button
                                    variant={isWorkspacePhotoDirty(activePreviewPhoto, workspacePhotoDrafts[activePreviewPhoto.id] || buildWorkspacePhotoDraft(activePreviewPhoto)) ? 'primary' : 'outline'}
                                    onClick={() => handleSaveWorkspacePhoto(activePreviewPhoto)}
                                    disabled={busy === `photo:${activePreviewPhoto.id}` || !isWorkspacePhotoDirty(activePreviewPhoto, workspacePhotoDrafts[activePreviewPhoto.id] || buildWorkspacePhotoDraft(activePreviewPhoto))}
                                  >
                                    <AppIcon name="save" />
                                    {busy === `photo:${activePreviewPhoto.id}` ? 'Salvando...' : 'Salvar Legenda'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Nenhum workspace alvo selecionado para curadoria.
              </div>
            )}
          </Card>

          <Card variant="nested" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <SearchableSelect id="ws-list-project" label="Filtrar por Empreendimento" value={selectedProjectId} onChange={(val) => setSelectedProjectId(val)} options={[{ value: '', label: 'Todos' }, ...projectOptions]} placeholder="Buscar empreendimento..." />
              </div>
              <div className="flex-1 min-w-48">
                <Input id="ws-list-search" label="Buscar Workspace" placeholder="Nome, descricao ou empreendimento..." value={workspaceSearchQuery} onChange={(event) => setWorkspaceSearchQuery(event.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                {(selectedProjectId || workspaceSearchQuery) ? (
                  <Button variant="outline" onClick={() => { setSelectedProjectId(''); setWorkspaceSearchQuery(''); }}>
                    <AppIcon name="close" />
                    Limpar Filtros
                  </Button>
                ) : null}
                <span className="text-xs text-slate-500">{filteredWorkspaceList.length} de {workspaces.length} workspace(s)</span>
              </div>
            </div>
            {filteredWorkspaceList.map((workspace) => (
              <article key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{workspace.nome || workspace.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">{workspace.descricao || 'Sem descricao'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(workspace.status)}`}>{workspace.status || 'draft'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Empreendimento: {projectNamesById.get(workspace.projectId) || workspace.projectId || '-'}</span>
                  <span>Slots: {Array.isArray(workspace.slots) ? workspace.slots.length : 0}</span>
                  <span>Atualizado: {fmt(workspace.updatedAt)}</span>
                </div>
              </article>
            ))}
            {workspaces.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum workspace criado ainda.</div> : null}
            {workspaces.length > 0 && filteredWorkspaceList.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum workspace encontrado com o filtro atual.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'library' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SearchableSelect id="library-project" label="Empreendimento" hint="A biblioteca cruza todas as fotos do empreendimento, nao apenas as de um workspace." value={selectedProjectId} onChange={(val) => setSelectedProjectId(val)} options={projectOptions} placeholder="Buscar empreendimento..." />
            <Select
              id="library-workspace"
              label="Workspace"
              hint="Filtra a biblioteca agregada por origem do workspace."
              value={libraryFilters.workspaceId}
              onChange={(event) => setLibraryFilters((prev) => ({ ...prev, workspaceId: event.target.value }))}
            >
              <option value="">Todos</option>
              {workspaceCandidates.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.nome || workspace.id}</option>)}
            </Select>
            <Select
              id="library-tower"
              label="Torre"
              hint="Use a torre para cruzar a curadoria ja aplicada nas fotos."
              value={libraryFilters.towerId}
              onChange={(event) => setLibraryFilters((prev) => ({ ...prev, towerId: event.target.value }))}
            >
              <option value="">Todas</option>
              {libraryTowerOptions.map((towerId) => <option key={towerId} value={towerId}>{towerId}</option>)}
            </Select>
            <Input
              id="library-caption"
              label="Legenda"
              hint="Busca por trecho da legenda da foto."
              value={libraryFilters.captionQuery}
              onChange={(event) => setLibraryFilters((prev) => ({ ...prev, captionQuery: event.target.value }))}
              placeholder="Ex: fundacao, isolador, erosao"
            />
            <Input
              id="library-date-from"
              label="Data Inicial"
              type="date"
              value={libraryFilters.dateFrom}
              onChange={(event) => setLibraryFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
            <Input
              id="library-date-to"
              label="Data Final"
              type="date"
              value={libraryFilters.dateTo}
              onChange={(event) => setLibraryFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
            <div className="flex flex-col justify-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">
                {Object.keys(libraryQueryFilters).length > 0
                  ? `${Object.keys(libraryQueryFilters).length} filtro(s) ativo(s) nesta biblioteca.`
                  : 'Nenhum filtro adicional ativo; a biblioteca mostra todas as fotos do empreendimento.'}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLibraryFilters({ workspaceId: '', towerId: '', captionQuery: '', dateFrom: '', dateTo: '' })}
                  disabled={Object.keys(libraryQueryFilters).length === 0}
                >
                  <AppIcon name="close" />
                  Limpar Filtros
                </Button>
                <Button variant="outline" onClick={handlePhotoExport} disabled={busy === 'export' || !selectedProjectId}>
                  <AppIcon name="save" />
                  {busy === 'export' ? 'Solicitando...' : 'Baixar Tudo Filtrado'}
                </Button>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card variant="nested"><strong className="text-slate-800">{metrics.total}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Fotos agregadas</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.included}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Incluidas</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.missingCaption}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem legenda</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.missingTower}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem torre</p></Card>
          </div>
          <Card variant="nested" className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span>Biblioteca agregada</span>
              <HintText label="Biblioteca agregada">O download total ou parcial sera entregue como ZIP efemero, sem persistencia duravel.</HintText>
            </div>
            <div className="text-xs text-slate-500">
              {selectedProjectId
                ? `${projectPhotos.length} foto(s) encontradas para o recorte atual.`
                : 'Selecione um empreendimento para abrir a biblioteca agregada.'}
            </div>
            {projectPhotos.map((photo) => (
              <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <strong className="text-slate-800">{photo.id}</strong>
                <p className="mt-1 mb-0 text-xs text-slate-500">{photo.caption || 'Sem legenda ainda'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">Torre: {photo.towerId || '-'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Workspace: {photo.workspaceId || '-'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Origem: {photo.importSource || '-'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Data: {fmt(getProjectPhotoDate(photo))}</span>
                </div>
              </article>
            ))}
            {selectedProjectId && projectPhotos.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhuma foto agregada encontrada para este empreendimento.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'dossier' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SearchableSelect id="dossier-project" label="Empreendimento" hint="O dossie consolida dados operacionais de um unico empreendimento." value={selectedProjectId} onChange={(val) => setSelectedProjectId(val)} options={projectOptions} placeholder="Buscar empreendimento..." />
            <Input id="dossier-name" label="Nome do Dossie" value={dossierDraft.nome} onChange={(event) => setDossierDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: Dossie operacional" />
            <Textarea id="dossier-notes" label="Observacoes" hint="O dossie tera seu proprio rascunho persistido, independente do workspace." rows={2} value={dossierDraft.observacoes} onChange={(event) => setDossierDraft((prev) => ({ ...prev, observacoes: event.target.value }))} />
            <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>Escopo Editorial</span>
                <HintText label="Escopo editorial do dossie">Escolha quais blocos operacionais entram no preflight e na geracao do dossie.</HintText>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {DOSSIER_SCOPE_FIELDS.map(([key, label]) => (
                  <label key={key} htmlFor={`dossier-scope-${key}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      id={`dossier-scope-${key}`}
                      type="checkbox"
                      checked={Boolean(dossierDraft.scopeJson?.[key])}
                      onChange={(event) => setDossierDraft((prev) => ({
                        ...prev,
                        scopeJson: {
                          ...(prev.scopeJson || buildDefaultDossierScope()),
                          [key]: event.target.checked,
                        },
                      }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 flex justify-end"><Button onClick={handleCreateDossier} disabled={busy === 'dossier' || !selectedProjectId}><AppIcon name="plus" />{busy === 'dossier' ? 'Criando...' : 'Criar Dossie'}</Button></div>
          </Card>
          <Card variant="nested" className="flex flex-col gap-3">
            {projectDossiers.map((dossier) => (
              <article key={dossier.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{dossier.nome || dossier.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">{dossier.observacoes || 'Sem observacoes'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(dossier.status)}`}>{dossier.status || 'draft'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {summarizeDossierScope(dossier.scopeJson).map((label) => (
                    <span key={label} className="rounded-full bg-slate-100 px-2 py-1">{label}</span>
                  ))}
                  {summarizeDossierScope(dossier.scopeJson).length === 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Escopo vazio</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => handleDossierPreflight(dossier)} disabled={busy === `dossier-preflight:${dossier.id}`}>
                    <AppIcon name="search" />
                    {busy === `dossier-preflight:${dossier.id}` ? 'Validando...' : 'Rodar Preflight'}
                  </Button>
                  <Button onClick={() => handleDossierGenerate(dossier)} disabled={busy === `dossier-generate:${dossier.id}`}>
                    <AppIcon name="file-text" />
                    {busy === `dossier-generate:${dossier.id}` ? 'Enfileirando...' : 'Enfileirar Geracao'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadReportOutput(
                      dossier.outputDocxMediaId,
                      buildDossierDownloadFileName(selectedProjectId, dossier),
                    )}
                    disabled={!dossier.outputDocxMediaId || busy === `download:${dossier.outputDocxMediaId}`}
                  >
                    <AppIcon name={busy === `download:${dossier.outputDocxMediaId}` ? 'loader' : 'download'} className={busy === `download:${dossier.outputDocxMediaId}` ? 'animate-spin' : ''} />
                    {busy === `download:${dossier.outputDocxMediaId}` ? 'Baixando...' : 'Baixar DOCX'}
                  </Button>
                </div>
                {isPendingExecutionStatus(dossier.status) && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <AppIcon name="loader" size={12} className="animate-spin" />
                      {getStatusLabel(dossier.status)}
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                )}
                {dossier.lastError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {dossier.lastError}
                  </div>
                ) : null}
                {projectDossierPreflights[dossier.id] ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <strong className="text-slate-800">Preflight</strong>
                      <span className={`rounded-full px-2 py-1 ${tone(projectDossierPreflights[dossier.id]?.canGenerate ? 'ready' : 'pending')}`}>
                        {projectDossierPreflights[dossier.id]?.canGenerate ? 'Pronto para gerar' : 'Ajustes necessarios'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2 py-1">Licencas: {projectDossierPreflights[dossier.id]?.summary?.licenseCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Inspecoes: {projectDossierPreflights[dossier.id]?.summary?.inspectionCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Erosoes: {projectDossierPreflights[dossier.id]?.summary?.erosionCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Entregas: {projectDossierPreflights[dossier.id]?.summary?.deliveryTrackingCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Workspaces: {projectDossierPreflights[dossier.id]?.summary?.workspaceCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Fotos: {projectDossierPreflights[dossier.id]?.summary?.photoCount ?? 0}</span>
                    </div>
                    {Array.isArray(projectDossierPreflights[dossier.id]?.warnings) && projectDossierPreflights[dossier.id].warnings.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {projectDossierPreflights[dossier.id].warnings.map((warning) => (
                          <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
            {selectedProjectId && projectDossiers.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum dossie criado ainda para este empreendimento.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'compounds' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="compound-name"
                label="Nome do relatorio"
                value={compoundDraft.nome}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex: Consolidado trimestral"
                hint="Identificador interno do relatorio composto."
              />
              <Input
                id="compound-revisao"
                label="Revisao"
                value={compoundDraft.revisao}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, revisao: event.target.value }))}
                placeholder="Ex: 00"
                hint="Numero de revisao do documento."
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cabecalho do documento</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="compound-nome-lt"
                label="Nome da LT"
                value={compoundDraft.nome_lt}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome_lt: event.target.value }))}
                placeholder="Ex: LT 500 kV Cachoeira Paulista – Adrianopolis III"
                hint="Sera exibido no cabecalho de todas as paginas."
              />
              <Input
                id="compound-titulo-programa"
                label="Titulo do programa"
                value={compoundDraft.titulo_programa}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, titulo_programa: event.target.value }))}
                placeholder="Ex: Programa de monitoramento de processos erosivos"
                hint="Subtitulo do relatorio exibido na capa e no cabecalho."
              />
              <Input
                id="compound-codigo-doc"
                label="Codigo do documento"
                value={compoundDraft.codigo_documento}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, codigo_documento: event.target.value }))}
                placeholder="Ex: OOSEMB.RT.061.2026"
                hint="Numero do documento conforme sistema de gestao."
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secoes de texto</p>
            <div className="grid grid-cols-1 gap-4">
              <Textarea
                id="compound-introducao"
                label="1. Introducao"
                hint="Contexto e objetivo do relatorio."
                rows={4}
                value={compoundDraft.introducao}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, introducao: event.target.value }))}
              />
              <Textarea
                id="compound-caract-tecnica"
                label="2. Caracterizacao Tecnica"
                hint="Geologia, geotecnia e geomorfologia da LT."
                rows={4}
                value={compoundDraft.caracterizacao_tecnica}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, caracterizacao_tecnica: event.target.value }))}
              />
              <Textarea
                id="compound-descr-atividades"
                label="3. Descricao das Atividades"
                hint="Metodologia e atividades realizadas na vistoria."
                rows={4}
                value={compoundDraft.descricao_atividades}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, descricao_atividades: event.target.value }))}
              />
              <Textarea
                id="compound-conclusoes"
                label="5. Conclusoes e Recomendacoes"
                hint="Diagnostico por torre e recomendacoes tecnicas."
                rows={4}
                value={compoundDraft.conclusoes}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, conclusoes: event.target.value }))}
              />
              <Textarea
                id="compound-analise-evolucao"
                label="6. Analise da Evolucao dos Processos Erosivos"
                hint="Comparativo com relatorios anteriores."
                rows={4}
                value={compoundDraft.analise_evolucao}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, analise_evolucao: event.target.value }))}
              />
              <Textarea
                id="compound-consideracoes"
                label="7. Consideracoes Finais"
                hint="Texto de encerramento e consideracoes gerais."
                rows={4}
                value={compoundDraft.observacoes}
                onChange={(event) => setCompoundDraft((prev) => ({ ...prev, observacoes: event.target.value }))}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assinaturas</p>
            {signatariosCandidatos.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2">
                  {signatariosCandidatos.map((sig) => {
                    const registro = [
                      sig.registro_conselho && sig.registro_estado ? `${sig.registro_conselho}-${sig.registro_estado}` : sig.registro_conselho || '',
                      sig.registro_numero ? (sig.registro_sufixo ? `${sig.registro_numero}/${sig.registro_sufixo}` : sig.registro_numero) : '',
                    ].filter(Boolean).join(' ');
                    const profNome = profissoes.find((p) => p.id === sig.profissao_id)?.nome || sig.profissao_nome || '';
                    const isElab = !!compoundDraft.elaboradores?.[sig.id];
                    const isRev = !!compoundDraft.revisores?.[sig.id];
                    return (
                      <label key={sig.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${isElab || isRev ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={isElab} onChange={(e) => setCompoundDraft((prev) => ({ ...prev, elaboradores: { ...prev.elaboradores, [sig.id]: e.target.checked } }))} />
                            Elaborador
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={isRev} onChange={(e) => setCompoundDraft((prev) => ({ ...prev, revisores: { ...prev.revisores, [sig.id]: e.target.checked } }))} />
                            Revisor
                          </label>
                        </div>
                        <span className="flex-1 text-slate-800">{sig.nome}</span>
                        <span className="text-xs text-slate-500">{[profNome, registro].filter(Boolean).join(' \u2013 ')}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhum signatario cadastrado. Adicione no seu perfil.</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleCreateCompound} disabled={busy === 'compound'}>
                <AppIcon name="plus" />
                {busy === 'compound' ? 'Criando...' : 'Criar Relatorio Composto'}
              </Button>
            </div>
          </Card>
          <Card variant="nested" className="flex flex-col gap-3">
            {compounds.map((compound) => (
              <article key={compound.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{compound.nome || compound.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Workspaces: {Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(compound.status)}`}>{compound.status || 'draft'}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">Atualizado: {fmt(compound.updatedAt)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {(Array.isArray(compound.workspaceIds) ? compound.workspaceIds : []).map((workspaceId) => (
                    <span key={workspaceId} className="rounded-full bg-slate-100 px-2 py-1">
                      {workspaceLabelsById.get(workspaceId) || workspaceId}
                    </span>
                  ))}
                  {(Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0) === 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Sem workspaces vinculados</span>
                  ) : null}
                </div>
                {buildCompoundWorkspaceOrder(compound).length > 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <span>Ordem dos Blocos</span>
                      <HintText label="Ordenacao do composto">A ordem abaixo define a sequencia dos workspaces no relatorio composto.</HintText>
                    </div>
                    <div className="flex flex-col gap-2">
                      {buildCompoundWorkspaceOrder(compound).map((workspaceId, index, orderedWorkspaceIds) => (
                        <div id={`compound-order-${compound.id}-${workspaceId}`} key={`${compound.id}-${workspaceId}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                              {index + 1}
                            </span>
                            <span>{workspaceLabelsById.get(workspaceId) || workspaceId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Mover ${workspaceLabelsById.get(workspaceId) || workspaceId} para cima`}
                              onClick={() => handleCompoundReorder(compound, workspaceId, 'up')}
                              disabled={index === 0 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                            >
                              <AppIcon name="chevron-left" className="rotate-90" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Mover ${workspaceLabelsById.get(workspaceId) || workspaceId} para baixo`}
                              onClick={() => handleCompoundReorder(compound, workspaceId, 'down')}
                              disabled={index === orderedWorkspaceIds.length - 1 || busy === `compound-reorder:${compound.id}:${workspaceId}`}
                            >
                              <AppIcon name="chevron-right" className="rotate-90" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Select
                    id={`compound-workspace-${compound.id}`}
                    label="Adicionar Workspace"
                    value={compoundWorkspaceSelections[compound.id] || ''}
                    onChange={(event) => setCompoundWorkspaceSelections((prev) => ({ ...prev, [compound.id]: event.target.value }))}
                  >
                    <option value="">Selecione um workspace</option>
                    {workspaces
                      .filter((workspace) => !(compound.workspaceIds || []).includes(workspace.id))
                      .map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspaceLabelsById.get(workspace.id) || workspace.nome || workspace.id}
                        </option>
                      ))}
                  </Select>
                  <div className="flex flex-wrap justify-end gap-2 md:self-end">
                    <Button variant="outline" onClick={() => handleCompoundAddWorkspace(compound)} disabled={busy === `compound-add:${compound.id}`}>
                      <AppIcon name="plus" />
                      {busy === `compound-add:${compound.id}` ? 'Adicionando...' : 'Adicionar Workspace'}
                    </Button>
                    <Button variant="outline" onClick={() => handleCompoundPreflight(compound)} disabled={busy === `compound-preflight:${compound.id}`}>
                      <AppIcon name="search" />
                      {busy === `compound-preflight:${compound.id}` ? 'Validando...' : 'Rodar Preflight'}
                    </Button>
                    <Button onClick={() => handleCompoundGenerate(compound)} disabled={busy === `compound-generate:${compound.id}`}>
                      <AppIcon name="file-text" />
                      {busy === `compound-generate:${compound.id}` ? 'Enfileirando...' : 'Enfileirar Geracao'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadReportOutput(
                        compound.outputDocxMediaId,
                        buildCompoundDownloadFileName(compound),
                      )}
                      disabled={!compound.outputDocxMediaId || busy === `download:${compound.outputDocxMediaId}`}
                    >
                      <AppIcon name={busy === `download:${compound.outputDocxMediaId}` ? 'loader' : 'download'} className={busy === `download:${compound.outputDocxMediaId}` ? 'animate-spin' : ''} />
                      {busy === `download:${compound.outputDocxMediaId}` ? 'Baixando...' : 'Baixar DOCX'}
                    </Button>
                  </div>
                </div>
                {isPendingExecutionStatus(compound.status) && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <AppIcon name="loader" size={12} className="animate-spin" />
                      {getStatusLabel(compound.status)}
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                )}
                {compound.lastError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {compound.lastError}
                  </div>
                ) : null}
                {compoundPreflights[compound.id] ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <strong className="text-slate-800">Preflight</strong>
                      <span className={`rounded-full px-2 py-1 ${tone(compoundPreflights[compound.id]?.canGenerate ? 'ready' : 'pending')}`}>
                        {compoundPreflights[compound.id]?.canGenerate ? 'Pronto para gerar' : 'Ajustes necessarios'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2 py-1">Declarados: {compoundPreflights[compound.id]?.workspaceCount ?? 0}</span>
                      <span className="rounded-full bg-white px-2 py-1">Encontrados: {compoundPreflights[compound.id]?.foundWorkspaceCount ?? 0}</span>
                    </div>
                    {Array.isArray(compoundPreflights[compound.id]?.warnings) && compoundPreflights[compound.id].warnings.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {compoundPreflights[compound.id].warnings.map((warning) => (
                          <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
            {compounds.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum relatorio composto criado ainda.</div> : null}
          </Card>
        </>
      ) : null}
    </section>
  );
}
