// ── Constantes ───────────────────────────────────────────────────────────────

export const TABS = [
  ['workspaces', 'Workspaces', 'file-text'],
  ['library', 'Biblioteca do Empreendimento', 'search'],
  ['dossier', 'Dossie do Empreendimento', 'clipboard'],
  ['compounds', 'Relatório Final', 'file-text'],
];

export const STEPS = [
  ['Empreendimento', 'Cada workspace pertence a um unico empreendimento.'],
  ['Importacao', 'Aceita fotos soltas, subpastas por torre e KMZ organizado.'],
  ['Curadoria', 'Legenda, torre e inclusao da foto sao decididas aqui.'],
  ['Textos', 'Os textos-base do empreendimento viram um rascunho do workspace.'],
  ['Preflight', 'Valida foto, torre, legenda e consistencia.'],
  ['Geracao', 'DOCX e KMZ entram na trilha do worker.'],
];

export const IMPORT_MODES = {
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

export const DOSSIER_SCOPE_FIELDS = [
  ['includeLicencas', 'Licencas'],
  ['includeInspecoes', 'Inspecoes'],
  ['includeErosoes', 'Erosoes'],
  ['includeEntregas', 'Entregas'],
  ['includeWorkspaces', 'Workspaces'],
  ['includeFotos', 'Fotos'],
];

export const STATUS_LABELS = {
  draft: 'Rascunho',
  queued: 'Na fila',
  processing: 'Processando',
  completed: 'Concluido',
  done: 'Concluido',
  error: 'Erro',
  failed: 'Erro',
  fail: 'Erro',
  ativo: 'Ativo',
  active: 'Ativo',
  ready: 'Pronto',
  uploaded: 'Enviada',
  reviewed: 'Revisada',
  curated: 'Curada',
  pending: 'Pendente',
};

// ── Formatacao ───────────────────────────────────────────────────────────────

export function fmt(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

export const PT_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatInspectionMonthYear(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${PT_MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
}

export function tone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('queued') || value.includes('process') || value.includes('saving') || value.includes('pending')) return 'bg-amber-100 text-amber-700';
  if (value.includes('ready') || value.includes('done') || value.includes('ativo') || value.includes('complete')) return 'bg-emerald-100 text-emerald-700';
  if (value.includes('error') || value.includes('fail')) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

export function isPendingExecutionStatus(status) {
  const value = String(status || '').toLowerCase();
  return value.includes('queued') || value.includes('process');
}

export function getStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('queued')) return 'Na fila...';
  if (s.includes('process')) return 'Gerando documento...';
  if (s.includes('error') || s.includes('fail')) return 'Erro na geracao';
  if (s.includes('complet')) return 'Concluido';
  return STATUS_LABELS[s] || null;
}

export function getTranslatedStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  return STATUS_LABELS[s] || status || 'Rascunho';
}

// ── Fotos e curadoria ────────────────────────────────────────────────────────

export function buildDefaultCaption(fileName = '') {
  return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export function normalizeTowerToken(rawValue = '') {
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

export function inferTowerIdFromRelativePath(relativePath = '') {
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

export function buildWorkspacePhotoDraft(photo = {}) {
  return {
    caption: String(photo.caption || ''),
    towerId: String(photo.towerId || ''),
    includeInReport: Boolean(photo.includeInReport),
  };
}

export function getPersistedWorkspaceCurationDrafts(workspace = null) {
  const persistedDrafts = workspace?.draftState?.curationDrafts;
  return persistedDrafts && typeof persistedDrafts === 'object' ? persistedDrafts : {};
}

export function buildWorkspacePhotoDrafts(photos = [], persistedDrafts = {}) {
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

export function isWorkspacePhotoDirty(photo = {}, draft = {}) {
  return String(draft.caption || '').trim() !== String(photo.caption || '').trim()
    || String(draft.towerId || '').trim() !== String(photo.towerId || '').trim()
    || Boolean(draft.includeInReport) !== Boolean(photo.includeInReport);
}

export function getWorkspacePhotoStatus(photo = {}, draft = {}) {
  const hasCaption = Boolean(String(draft.caption || '').trim());
  const hasTower = Boolean(String(draft.towerId || '').trim());
  const includeInReport = Boolean(draft.includeInReport);

  if (includeInReport && hasCaption && hasTower) return 'curated';
  if (hasCaption || hasTower || includeInReport) return 'reviewed';
  return String(photo.curationStatus || 'uploaded').trim() || 'uploaded';
}

// ── Ordenacao e agrupamento de fotos ─────────────────────────────────────────

function getEffectiveDraft(photo, drafts) {
  const draft = drafts && drafts[photo.id];
  return {
    towerId: String((draft && draft.towerId != null ? draft.towerId : photo.towerId) || '').trim(),
    caption: String((draft && draft.caption != null ? draft.caption : photo.caption) || '').trim(),
    captureAt: photo.captureAt || photo.createdAt || 0,
    sortOrder: Number(photo.sortOrder) || 0,
  };
}

// Espelha backend/utils/reportJobContext.js::sortPhotosByMode, mas usando os
// valores efetivos dos rascunhos do cliente (torre/legenda editadas).
export function sortPhotosByMode(photos = [], drafts = {}, mode = 'sort_order_asc') {
  const list = Array.isArray(photos) ? [...photos] : [];
  const getEff = (photo) => getEffectiveDraft(photo, drafts);
  switch (mode) {
    case 'tower_desc':
      list.sort((a, b) => {
        const ea = getEff(a);
        const eb = getEff(b);
        if (ea.towerId !== eb.towerId) return eb.towerId.localeCompare(ea.towerId, undefined, { numeric: true });
        return ea.sortOrder - eb.sortOrder;
      });
      break;
    case 'tower_asc':
      list.sort((a, b) => {
        const ea = getEff(a);
        const eb = getEff(b);
        if (ea.towerId !== eb.towerId) return ea.towerId.localeCompare(eb.towerId, undefined, { numeric: true });
        return ea.sortOrder - eb.sortOrder;
      });
      break;
    case 'capture_date_asc':
      list.sort((a, b) => new Date(getEff(a).captureAt || 0).getTime() - new Date(getEff(b).captureAt || 0).getTime());
      break;
    case 'capture_date_desc':
      list.sort((a, b) => new Date(getEff(b).captureAt || 0).getTime() - new Date(getEff(a).captureAt || 0).getTime());
      break;
    case 'caption_asc':
      list.sort((a, b) => getEff(a).caption.localeCompare(getEff(b).caption, undefined, { numeric: true }));
      break;
    case 'sort_order_asc':
    default:
      list.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
      break;
  }
  return list;
}

// Agrupa fotos ja ordenadas por torre, preservando a ordem de entrada. Usado
// tanto pelo grid quanto pelo preview de numeracao do DOCX.
export function groupPhotosByTower(photos = [], drafts = {}) {
  const groups = [];
  const lookup = {};
  for (const photo of photos) {
    const eff = getEffectiveDraft(photo, drafts);
    const label = eff.towerId ? `Torre ${eff.towerId}` : 'Sem torre';
    if (!lookup[label]) {
      lookup[label] = { label, items: [] };
      groups.push(lookup[label]);
    }
    lookup[label].items.push(photo);
  }
  return groups;
}

// ── Status de curadoria por torre ───────────────────────────────────────────

export function computeTowerCurationStatus(photos = [], drafts = {}) {
  const grouped = {};
  for (const photo of photos) {
    const draft = drafts[photo.id] || buildWorkspacePhotoDraft(photo);
    const tower = (draft.towerId || photo.towerId || '').trim() || '__none__';
    if (!grouped[tower]) grouped[tower] = { total: 0, curated: 0 };
    grouped[tower].total += 1;
    if (getWorkspacePhotoStatus(photo, draft) === 'curated') {
      grouped[tower].curated += 1;
    }
  }
  const result = {};
  for (const [tower, counts] of Object.entries(grouped)) {
    result[tower] = counts.total > 0 && counts.curated === counts.total;
  }
  return result;
}

// ── Filtros ──────────────────────────────────────────────────────────────────

export function buildProjectPhotoFilters(filters = {}) {
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

export function getProjectPhotoDate(photo = {}) {
  return photo.captureAt || photo.createdAt || photo.updatedAt || '';
}

// ── Download e arquivo ───────────────────────────────────────────────────────

export function triggerBlobDownload(filename, blob) {
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

export function sanitizeDownloadName(value = '', fallback = 'documento.docx') {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '-');
  return normalized || fallback;
}

export function buildDossierDownloadFileName(projectId, dossier = {}) {
  return sanitizeDownloadName(`dossie-${projectId}-${dossier.id || 'documento'}.docx`);
}

export function buildCompoundDownloadFileName(compound = {}) {
  return sanitizeDownloadName(`relatorio-composto-${compound.id || 'documento'}.docx`);
}

export function buildWorkspaceKmzDownloadFileName(workspace = {}, requestEntry = {}) {
  return sanitizeDownloadName(`workspace-${workspace.id || 'workspace'}-${requestEntry.token || 'fotos'}.kmz`, 'workspace-fotos.kmz');
}

// ── Dossie ───────────────────────────────────────────────────────────────────

export function buildDefaultDossierScope() {
  return Object.fromEntries(DOSSIER_SCOPE_FIELDS.map(([key]) => [key, true]));
}

export function summarizeDossierScope(scopeJson = {}) {
  return DOSSIER_SCOPE_FIELDS
    .filter(([key]) => Boolean(scopeJson?.[key]))
    .map(([, label]) => label);
}

// ── Compostos ────────────────────────────────────────────────────────────────

export function buildCompoundWorkspaceOrder(compound = {}) {
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

export function formatSignatarioRegistro(sig) {
  if (!sig || typeof sig !== 'object') return '';
  const conselho = String(sig.registro_conselho || '').trim();
  const estado = String(sig.registro_estado || '').trim();
  const numero = String(sig.registro_numero || '').trim();
  const sufixo = String(sig.registro_sufixo || '').trim();
  return [
    conselho && estado ? `${conselho}-${estado}` : conselho || '',
    numero ? (sufixo ? `${numero}/${sufixo}` : numero) : '',
  ].filter(Boolean).join(' ');
}

export function buildSignatarySnapshot(sig, profLookup = {}) {
  if (!sig) return null;
  return {
    nome: String(sig.nome || '').trim(),
    profissao: profLookup[sig.profissao_id] || String(sig.profissao_nome || '').trim(),
    registro: formatSignatarioRegistro(sig),
  };
}
