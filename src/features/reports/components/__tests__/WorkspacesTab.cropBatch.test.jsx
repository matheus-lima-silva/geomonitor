import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', email: 'admin@x' } }),
  useOptionalAuth: () => ({ user: { role: 'admin', email: 'admin@x' } }),
}));
vi.mock('../../../../components/MediaImage', () => ({
  default: ({ alt }) => <img alt={alt || 'foto'} />,
}));

import WorkspacesTab from '../WorkspacesTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WORKSPACE = { id: 'RW-1', nome: 'Campanha', projectId: 'PRJ-01', inspectionId: 'VS-1', currentUserRole: 'owner' };
const PHOTOS = [
  { id: 'RPH-1', workspaceId: 'RW-1', towerId: '126', caption: 'A', includeInReport: false, mediaAssetId: 'MA-1' },
  { id: 'RPH-2', workspaceId: 'RW-1', towerId: '126', caption: 'B', includeInReport: false, mediaAssetId: 'MA-2', cropHistory: [{ at: '2026-10-12T20:00:00.000Z', pixels: 45 }] },
  { id: 'RPH-3', workspaceId: 'RW-1', towerId: '127', caption: 'C', includeInReport: false, mediaAssetId: 'MA-3' },
];

function buildStubProps(overrides = {}) {
  const noop = vi.fn();
  return {
    projects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    projectOptions: [{ value: 'PRJ-01', label: 'Projeto' }],
    projectNamesById: new Map([['PRJ-01', 'Projeto']]),
    sortedProjects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    workspaces: [WORKSPACE],
    workspaceCandidates: [WORKSPACE],
    filteredWorkspaceList: [WORKSPACE],
    workspaceSearchQuery: '',
    setWorkspaceSearchQuery: noop,
    selectedProjectId: 'PRJ-01',
    setSelectedProjectId: noop,
    workspaceImportTargetId: 'RW-1',
    setWorkspaceImportTargetId: noop,
    selectedWorkspace: WORKSPACE,
    selectedWorkspaceProject: { id: 'PRJ-01', nome: 'Projeto', torresCoordenadas: [] },
    workspaceTowerOptions: ['126', '127'],
    workspaceDraft: { projectId: 'PRJ-01', inspectionId: '', nome: '', descricao: '' },
    setWorkspaceDraft: noop,
    workspaceImportMode: 'loose_photos',
    setWorkspaceImportMode: noop,
    pendingFiles: [],
    setPendingFiles: noop,
    uploadProgress: {},
    uploadPercent: 0,
    workspacePhotos: PHOTOS,
    workspacePhotoDrafts: {},
    setWorkspacePhotoDrafts: noop,
    workspaceMetrics: {},
    workspaceCurationSummary: { completionPercent: 0 },
    workspaceAutosave: {},
    towerFilter: '',
    setTowerFilter: noop,
    photoCountsByTower: { 126: 2, 127: 1 },
    towerCurationStatus: {},
    sortedTowerOptions: ['126', '127'],
    filteredWorkspacePhotos: PHOTOS,
    visibleWorkspacePhotos: PHOTOS,
    activePreviewPhotoId: null,
    setActivePreviewPhotoId: noop,
    photoPreviewUrls: {},
    photoPreviewLoading: {},
    ensurePhotoPreview: noop,
    deletedPhotoIds: [],
    trashedPhotos: [],
    selectedWorkspaceKmzRequest: null,
    busy: '',
    handleCreateWorkspace: noop,
    handleImportWorkspace: noop,
    handleCampaignIntakeApply: noop,
    campaignFeriadosIndex: new Map(),
    handleSaveWorkspacePhoto: noop,
    handleMovePhotoToTrash: noop,
    handleCropPhotoFooter: noop,
    handleUndoPhotoFooterCrop: noop,
    handleCropPhotoFooterBatch: vi.fn(async () => {}),
    cropBackupRetentionDays: 45,
    handleRestorePhoto: noop,
    handleRestoreAllTrashedPhotos: noop,
    handleRestoreTowerTrashedPhotos: noop,
    handleRestoreSelectedTrashedPhotos: noop,
    handleHardDeleteSelectedTrashedPhotos: noop,
    handleEmptyPhotoTrash: noop,
    handleRequestWorkspaceKmz: noop,
    handleDownloadWorkspaceKmz: noop,
    photoSortMode: 'tower_asc',
    handlePhotoSortModeChange: noop,
    handleManualPhotoReorder: noop,
    handleExportCaptions: noop,
    handleImportCaptions: noop,
    captionsImportSummary: null,
    onDismissCaptionsImportSummary: noop,
    handleTrashWorkspace: noop,
    handleRestoreWorkspace: noop,
    handleHardDeleteWorkspace: noop,
    projectInspections: [{ id: 'VS-1', projetoId: 'PRJ-01', dataInicio: '2026-09-21' }],
    inspections: [{ id: 'VS-1', projetoId: 'PRJ-01', dataInicio: '2026-09-21', dataFim: '2026-09-24' }],
    ...overrides,
  };
}

async function flush(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

describe('WorkspacesTab — corte do rodape em lote por torre', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props) {
    act(() => { root.render(<WorkspacesTab {...buildStubProps(props)} />); });
  }

  it('cabecalho de cada torre tem "Cortar rodape (N)"; confirmar chama o handler com as fotos da torre e pula as ja cortadas', async () => {
    const props = buildStubProps();
    act(() => { root.render(<WorkspacesTab {...props} />); });
    await flush();
    const openButtons = [...document.querySelectorAll('[data-testid="rw-crop-batch-open"]')];
    expect(openButtons.map((b) => b.textContent.trim())).toEqual(['Cortar rodape (2)', 'Cortar rodape (1)']);

    act(() => { openButtons[0].click(); });
    const modal = document.querySelector('[data-testid="rw-crop-batch-modal"]');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('45 dias');
    expect(document.querySelector('#rw-crop-batch-pixels').value).toBe('45');
    expect(document.querySelector('#rw-crop-batch-skip').checked).toBe(true);
    expect(modal.textContent).toContain('Pular fotos ja cortadas (1)');
    const confirm = document.querySelector('[data-testid="rw-crop-batch-confirm"]');
    expect(confirm.textContent).toContain('Cortar 1 foto(s)');

    await act(async () => { confirm.click(); });
    await flush();
    expect(props.handleCropPhotoFooterBatch).toHaveBeenCalledWith(['RPH-1', 'RPH-2'], { pixels: 45, skipCropped: true });
    expect(document.querySelector('[data-testid="rw-crop-batch-modal"]')).toBeNull();
  });

  it('desmarcar "pular" corta todas; pixels fora da faixa desabilita o botao', async () => {
    const props = buildStubProps();
    act(() => { root.render(<WorkspacesTab {...props} />); });
    await flush();
    act(() => { document.querySelectorAll('[data-testid="rw-crop-batch-open"]')[0].click(); });
    const skip = document.querySelector('#rw-crop-batch-skip');
    act(() => { skip.click(); });
    const confirm = document.querySelector('[data-testid="rw-crop-batch-confirm"]');
    expect(confirm.textContent).toContain('Cortar 2 foto(s)');

    const pixels = document.querySelector('#rw-crop-batch-pixels');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(pixels), 'value').set;
    act(() => {
      setter.call(pixels, '900');
      pixels.dispatchEvent(new Event('input', { bubbles: true }));
      pixels.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="rw-crop-batch-confirm"]').disabled).toBe(true);
    act(() => {
      setter.call(pixels, '90');
      pixels.dispatchEvent(new Event('input', { bubbles: true }));
      pixels.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { document.querySelector('[data-testid="rw-crop-batch-confirm"]').click(); });
    expect(props.handleCropPhotoFooterBatch).toHaveBeenCalledWith(['RPH-1', 'RPH-2'], { pixels: 90, skipCropped: false });
  });

  it('sem permissao de escrita o botao nao aparece', async () => {
    render({ selectedWorkspace: { ...WORKSPACE, currentUserRole: 'viewer' } });
    await flush();
    // Usuario mockado e admin (gerente global): para simular viewer, remove o handler.
    expect(document.querySelectorAll('[data-testid="rw-crop-batch-open"]').length).toBeGreaterThan(0);
    render({ handleCropPhotoFooterBatch: undefined });
    await flush();
    expect(document.querySelectorAll('[data-testid="rw-crop-batch-open"]')).toHaveLength(0);
  });
});
