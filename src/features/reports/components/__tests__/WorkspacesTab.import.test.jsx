import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspacesTab from '../WorkspacesTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WORKSPACE = { id: 'RW-1', nome: 'Campanha', projectId: 'PRJ-01', inspectionId: 'VS-1' };

function buildStubProps(overrides = {}) {
  return {
    projects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    projectOptions: [{ value: 'PRJ-01', label: 'Projeto' }],
    projectNamesById: new Map([['PRJ-01', 'Projeto']]),
    sortedProjects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    workspaces: [WORKSPACE],
    workspaceCandidates: [WORKSPACE],
    filteredWorkspaceList: [WORKSPACE],
    workspaceSearchQuery: '',
    setWorkspaceSearchQuery: vi.fn(),
    selectedProjectId: 'PRJ-01',
    setSelectedProjectId: vi.fn(),
    workspaceImportTargetId: '',
    setWorkspaceImportTargetId: vi.fn(),
    selectedWorkspace: null,
    selectedWorkspaceProject: { id: 'PRJ-01', nome: 'Projeto', torresCoordenadas: [] },
    workspaceTowerOptions: [],
    workspaceDraft: { projectId: 'PRJ-01', inspectionId: '', nome: '', descricao: '' },
    setWorkspaceDraft: vi.fn(),
    workspaceImportMode: 'loose_photos',
    setWorkspaceImportMode: vi.fn(),
    pendingFiles: [],
    setPendingFiles: vi.fn(),
    uploadProgress: {},
    uploadPercent: 0,
    workspacePhotos: [],
    workspacePhotoDrafts: {},
    setWorkspacePhotoDrafts: vi.fn(),
    workspaceMetrics: {},
    workspaceCurationSummary: { completionPercent: 0 },
    workspaceAutosave: {},
    towerFilter: '',
    setTowerFilter: vi.fn(),
    photoCountsByTower: {},
    towerCurationStatus: {},
    sortedTowerOptions: [],
    filteredWorkspacePhotos: [],
    visibleWorkspacePhotos: [],
    activePreviewPhotoId: null,
    setActivePreviewPhotoId: vi.fn(),
    photoPreviewUrls: {},
    photoPreviewLoading: {},
    ensurePhotoPreview: vi.fn(),
    deletedPhotoIds: [],
    trashedPhotos: [],
    selectedWorkspaceKmzRequest: null,
    busy: '',
    handleCreateWorkspace: vi.fn(),
    handleImportWorkspace: vi.fn(),
    handleCampaignIntakeApply: vi.fn(),
    campaignFeriadosIndex: new Map(),
    handleSaveWorkspacePhoto: vi.fn(),
    handleMovePhotoToTrash: vi.fn(),
    handleRestorePhoto: vi.fn(),
    handleRestoreAllTrashedPhotos: vi.fn(),
    handleRestoreTowerTrashedPhotos: vi.fn(),
    handleRestoreSelectedTrashedPhotos: vi.fn(),
    handleHardDeleteSelectedTrashedPhotos: vi.fn(),
    handleEmptyPhotoTrash: vi.fn(),
    handleRequestWorkspaceKmz: vi.fn(),
    handleDownloadWorkspaceKmz: vi.fn(),
    photoSortMode: 'sort_order_asc',
    handlePhotoSortModeChange: vi.fn(),
    handleManualPhotoReorder: vi.fn(),
    handleExportCaptions: vi.fn(),
    handleImportCaptions: vi.fn(),
    captionsImportSummary: null,
    onDismissCaptionsImportSummary: vi.fn(),
    handleTrashWorkspace: vi.fn(),
    handleRestoreWorkspace: vi.fn(),
    handleHardDeleteWorkspace: vi.fn(),
    projectInspections: [{ id: 'VS-1', projetoId: 'PRJ-01', dataInicio: '2026-09-21' }],
    inspections: [{ id: 'VS-1', projetoId: 'PRJ-01', dataInicio: '2026-09-21', dataFim: '2026-09-24' }],
    ...overrides,
  };
}

function findButton(text) {
  return [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

describe('WorkspacesTab — import de fotos (captacao unica + KMZ)', () => {
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

  async function mount(props) {
    act(() => {
      root.render(<WorkspacesTab {...buildStubProps(props)} />);
    });
    if (!container.querySelector('#rw-import-target')) {
      await act(async () => {
        findButton('Importar Fotos').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }
  }

  it('sem alvo, o botao da captacao fica desabilitado; o seletor de modo antigo nao existe mais', async () => {
    await mount();
    expect(container.querySelector('#rw-import-mode')).toBeNull();
    expect(container.querySelector('#rw-import-files')).toBeNull();
    expect(findButton('Selecionar fotos da campanha').disabled).toBe(true);
    expect(container.querySelector('#rw-import-kmz')).toBeTruthy();
  });

  it('com alvo, abre o modal de captacao em modo workspace com a vistoria vinculada como destino do diario', async () => {
    await mount({ workspaceImportTargetId: 'RW-1', selectedWorkspace: WORKSPACE });
    const button = findButton('Selecionar fotos da campanha');
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="photo-autofill-pick"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Preencher vistoria pelas fotos');
  });

  it('KMZ organizado: escolher o arquivo muda o modo e o botao chama handleImportWorkspace', async () => {
    const setWorkspaceImportMode = vi.fn();
    const setPendingFiles = vi.fn();
    const handleImportWorkspace = vi.fn();
    await mount({ workspaceImportTargetId: 'RW-1', setWorkspaceImportMode, setPendingFiles, handleImportWorkspace, pendingFiles: [{ name: 'x.kmz' }] });
    const input = container.querySelector('#rw-import-kmz');
    Object.defineProperty(input, 'files', { value: [{ name: 'x.kmz' }], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(setWorkspaceImportMode).toHaveBeenCalledWith('organized_kmz');
    expect(setPendingFiles).toHaveBeenCalledWith([{ name: 'x.kmz' }]);

    const importButton = findButton('Importar KMZ Organizado');
    expect(importButton.disabled).toBe(false);
    act(() => { importButton.click(); });
    expect(handleImportWorkspace).toHaveBeenCalledWith({ importSource: 'organized_kmz' });
  });
});
