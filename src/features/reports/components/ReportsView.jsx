import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select, Textarea } from '../../../components/ui';
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
  reorderReportCompound,
  runReportCompoundPreflight,
  subscribeReportCompounds,
} from '../../../services/reportCompoundService';
import { completeMediaUpload, createMediaUpload, uploadMediaBinary } from '../../../services/mediaService';
import { getProjectTowerList } from '../../../utils/getProjectTowerList';
import {
  createReportWorkspace,
  importReportWorkspace,
  listReportWorkspacePhotos,
  processWorkspaceKmz,
  saveReportWorkspacePhoto,
  subscribeReportWorkspaces,
  updateReportWorkspace,
} from '../../../services/reportWorkspaceService';

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
  if (value.includes('ready') || value.includes('done') || value.includes('ativo')) return 'bg-emerald-100 text-emerald-700';
  if (value.includes('error') || value.includes('fail')) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
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
  const [workspaceDraft, setWorkspaceDraft] = useState({ projectId: '', nome: '', descricao: '' });
  const [dossierDraft, setDossierDraft] = useState({ nome: '', observacoes: '', scopeJson: buildDefaultDossierScope() });
  const [compoundDraft, setCompoundDraft] = useState({ nome: '', texto: '' });
  const [workspaceImportTargetId, setWorkspaceImportTargetId] = useState('');
  const [workspaceImportMode, setWorkspaceImportMode] = useState('loose_photos');
  const [workspacePhotos, setWorkspacePhotos] = useState([]);
  const [workspacePhotoDrafts, setWorkspacePhotoDrafts] = useState({});
  const [workspaceAutosave, setWorkspaceAutosave] = useState({ status: 'idle', savedAt: '', error: '' });
  const [lastPersistedWorkspaceDraftSignature, setLastPersistedWorkspaceDraftSignature] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => subscribeReportWorkspaces((rows) => setWorkspaces(rows || []), () => showToast('Erro ao carregar workspaces.', 'error')), [showToast]);
  useEffect(() => subscribeProjects((rows) => setProjects(rows || []), () => showToast('Erro ao carregar empreendimentos.', 'error')), [showToast]);
  useEffect(() => subscribeReportCompounds((rows) => setCompounds(rows || []), () => showToast('Erro ao carregar compostos.', 'error')), [showToast]);

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
    listProjectDossiers(selectedProjectId)
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
      const dossiers = await listProjectDossiers(selectedProjectId);
      setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
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
        const dossiers = await listProjectDossiers(selectedProjectId);
        setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
      }
      showToast('Geracao do dossie enfileirada.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao enfileirar geracao do dossie.', 'error');
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
      await createReportCompound({
        id: `RC-${Date.now()}`,
        nome: compoundDraft.nome.trim(),
        sharedTextsJson: { introducao: String(compoundDraft.texto || '').trim() },
        status: 'draft',
        workspaceIds: [],
        orderJson: [],
      }, { updatedBy: userEmail || 'web' });
      setCompoundDraft({ nome: '', texto: '' });
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
      const uploadedMediaIds = [];
      const warnings = [];

      if (workspaceImportMode === 'organized_kmz') {
        const kmzFile = pendingFiles[0];
        const uploaded = await uploadWorkspaceFile(
          kmzFile,
          workspace,
          0,
          'organized_kmz',
          { purpose: 'workspace-import', skipPhotoRegistration: true },
        );
        uploadedMediaIds.push(uploaded.mediaAssetId);

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
            <Select id="rw-project" label="Empreendimento" hint="Toda inferencia espacial acontece dentro do empreendimento selecionado." value={workspaceDraft.projectId} onChange={(event) => { setWorkspaceDraft((prev) => ({ ...prev, projectId: event.target.value })); setSelectedProjectId(event.target.value); }}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
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
              </div>
            </div>
            {selectedWorkspace && workspaceAutosave.status === 'error' ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {workspaceAutosave.error || 'Erro ao autosalvar rascunho do workspace.'}
              </div>
            ) : null}

            {selectedWorkspace ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Card variant="nested"><strong className="text-slate-800">{workspaceMetrics.total}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Fotos no workspace</p></Card>
                  <Card variant="nested"><strong className="text-slate-800">{workspaceMetrics.included}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Incluidas no relatorio</p></Card>
                  <Card variant="nested"><strong className="text-slate-800">{workspaceMetrics.missingCaption}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem legenda</p></Card>
                  <Card variant="nested"><strong className="text-slate-800">{workspaceMetrics.missingTower}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem torre</p></Card>
                </div>

                <div className="flex flex-col gap-3">
                  {workspacePhotos.map((photo) => {
                    const draft = workspacePhotoDrafts[photo.id] || buildWorkspacePhotoDraft(photo);
                    const dirty = isWorkspacePhotoDirty(photo, draft);
                    const currentStatus = getWorkspacePhotoStatus(photo, draft);
                    const towerOptions = draft.towerId && !workspaceTowerOptions.includes(draft.towerId)
                      ? [draft.towerId, ...workspaceTowerOptions]
                      : workspaceTowerOptions;

                    return (
                      <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <strong className="text-slate-800">{photo.id}</strong>
                            <p className="mt-1 mb-0 text-xs text-slate-500">
                              Origem: {photo.importSource || '-'} • Torre sugerida: {photo.towerId || '-'} ({photo.towerSource || 'pendente'})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {dirty ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Alteracoes pendentes</span> : null}
                            <span className={`rounded-full px-2 py-1 text-xs ${tone(currentStatus)}`}>{currentStatus}</span>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_220px_auto]">
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
                          <div className="flex h-full flex-col justify-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <label htmlFor={`rw-photo-include-${photo.id}`} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                              <input
                                id={`rw-photo-include-${photo.id}`}
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
                            <p className="mt-2 mb-0 text-xs text-slate-500">Use a curadoria manual para confirmar o que vira insumo do DOCX.</p>
                          </div>
                          <div className="flex items-end justify-end">
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
                  {workspacePhotos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                      Nenhuma foto registrada ainda neste workspace.
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Nenhum workspace alvo selecionado para curadoria.
              </div>
            )}
          </Card>

          <Card variant="nested" className="flex flex-col gap-3">
            {workspaces.map((workspace) => (
              <article key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{workspace.nome || workspace.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">{workspace.descricao || 'Sem descricao'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(workspace.status)}`}>{workspace.status || 'draft'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Empreendimento: {workspace.projectId || '-'}</span>
                  <span>Slots: {Array.isArray(workspace.slots) ? workspace.slots.length : 0}</span>
                  <span>Atualizado: {fmt(workspace.updatedAt)}</span>
                </div>
              </article>
            ))}
            {workspaces.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum workspace criado ainda.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'library' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Select id="library-project" label="Empreendimento" hint="A biblioteca cruza todas as fotos do empreendimento, nao apenas as de um workspace." value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
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
            <Select id="dossier-project" label="Empreendimento" hint="O dossie consolida dados operacionais de um unico empreendimento." value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
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
                </div>
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
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input id="compound-name" label="Nome" value={compoundDraft.nome} onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: Consolidado trimestral" />
            <Textarea id="compound-text" label="Texto Global" hint="Esse texto e do relatorio composto e nao sobrescreve os workspaces filhos." rows={2} value={compoundDraft.texto} onChange={(event) => setCompoundDraft((prev) => ({ ...prev, texto: event.target.value }))} />
            <div className="md:col-span-2 flex justify-end"><Button onClick={handleCreateCompound} disabled={busy === 'compound'}><AppIcon name="plus" />{busy === 'compound' ? 'Criando...' : 'Criar Relatorio Composto'}</Button></div>
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
                  </div>
                </div>
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
