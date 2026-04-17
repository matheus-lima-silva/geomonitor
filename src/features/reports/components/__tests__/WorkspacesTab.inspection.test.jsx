import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspacesTab from '../WorkspacesTab';

function buildStubProps(overrides = {}) {
  return {
    projects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    projectOptions: [{ value: 'PRJ-01', label: 'Projeto' }],
    projectNamesById: new Map([['PRJ-01', 'Projeto']]),
    sortedProjects: [{ id: 'PRJ-01', nome: 'Projeto' }],
    workspaces: [],
    workspaceCandidates: [],
    filteredWorkspaceList: [],
    workspaceSearchQuery: '',
    setWorkspaceSearchQuery: vi.fn(),
    selectedProjectId: 'PRJ-01',
    setSelectedProjectId: vi.fn(),
    workspaceImportTargetId: '',
    setWorkspaceImportTargetId: vi.fn(),
    selectedWorkspace: null,
    selectedWorkspaceProject: null,
    workspaceTowerOptions: [],
    workspaceDraft: { projectId: 'PRJ-01', inspectionId: '', nome: 'Teste', descricao: '' },
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
    projectInspections: [],
    inspections: [],
    ...overrides,
  };
}

describe('WorkspacesTab — picker de vistoria', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('desabilita o bot\u00e3o de criar workspace quando nenhuma vistoria foi selecionada', async () => {
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps()} />);
    });

    const createBtn = container.querySelector('[data-testid="create-workspace-submit"]');
    expect(createBtn).not.toBeNull();
    expect(createBtn.disabled).toBe(true);
  });

  it('habilita o bot\u00e3o quando vistoria \u00e9 selecionada e nome est\u00e1 preenchido', async () => {
    const inspections = [{ id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-04-10', responsavel: 'Teste' }];
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({
        projectInspections: inspections,
        workspaceDraft: { projectId: 'PRJ-01', inspectionId: 'VS-01', nome: 'Teste', descricao: '' },
      })} />);
    });

    const createBtn = container.querySelector('[data-testid="create-workspace-submit"]');
    expect(createBtn.disabled).toBe(false);
  });

  it('lista vistorias do projeto no dropdown, excluindo vistorias de outros projetos', async () => {
    const inspections = [
      { id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-04-10' },
      { id: 'VS-02', projetoId: 'PRJ-02', dataInicio: '2026-04-12' },
      { id: 'VS-03', projetoId: 'PRJ-01', dataInicio: '2026-04-05' },
    ];
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ projectInspections: inspections })} />);
    });

    const select = container.querySelector('#rw-inspection');
    expect(select).not.toBeNull();
    const values = [...select.querySelectorAll('option')].map((opt) => opt.value);
    expect(values).toContain('VS-01');
    expect(values).toContain('VS-03');
    expect(values).not.toContain('VS-02');
  });

  it('mostra mensagem de "sem vistoria" quando o workspace ativo n\u00e3o tem inspectionId', async () => {
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({
        selectedWorkspace: { id: 'RW-1', nome: 'W', projectId: 'PRJ-01', inspectionId: null },
      })} />);
    });

    expect(container.textContent).toContain('Sem vistoria vinculada');
  });

  it('exibe badge com a vistoria quando o workspace ativo tem inspectionId', async () => {
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({
        selectedWorkspace: { id: 'RW-1', nome: 'W', projectId: 'PRJ-01', inspectionId: 'VS-01' },
        projectInspections: [{ id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-04-10' }],
      })} />);
    });

    const badge = container.querySelector('[data-testid="workspace-inspection-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('VS-01');
  });
});

describe('WorkspacesTab — card de workspace exibe mes da vistoria', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function renderCard(overrides = {}) {
    const baseWorkspace = {
      id: 'RW-CARD-1',
      nome: 'Card workspace',
      projectId: 'PRJ-01',
      inspectionId: null,
      status: 'draft',
      updatedAt: '2026-04-17T17:11:38Z',
    };
    const workspace = { ...baseWorkspace, ...(overrides.workspace || {}) };
    return {
      ...buildStubProps({
        selectedWorkspace: null,
        workspaces: [workspace],
        filteredWorkspaceList: [workspace],
        ...overrides.props,
      }),
    };
  }

  it('renderiza "Vistoria: Abril/2026" quando o workspace aponta para uma inspection com dataInicio', async () => {
    const props = renderCard({
      workspace: { inspectionId: 'VS-01' },
      props: {
        inspections: [{ id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-04-10' }],
      },
    });

    await act(async () => {
      root.render(<WorkspacesTab {...props} />);
    });

    expect(container.textContent).toContain('Vistoria: Abril/2026');
  });

  it('renderiza "Sem vistoria" quando o workspace nao tem inspectionId', async () => {
    const props = renderCard({ workspace: { inspectionId: null } });

    await act(async () => {
      root.render(<WorkspacesTab {...props} />);
    });

    expect(container.textContent).toContain('Sem vistoria');
  });

  it('usa o lookup global inspections mesmo quando projectInspections esta vazio', async () => {
    const props = renderCard({
      workspace: { inspectionId: 'VS-FAR' },
      props: {
        selectedProjectId: '',
        projectInspections: [],
        inspections: [{ id: 'VS-FAR', projetoId: 'PRJ-02', dataInicio: '2025-12-15T12:00:00Z' }],
      },
    });

    await act(async () => {
      root.render(<WorkspacesTab {...props} />);
    });

    expect(container.textContent).toContain('Vistoria: Dezembro/2025');
  });

  it('cai em "Sem vistoria" quando dataInicio da inspection eh invalida', async () => {
    const props = renderCard({
      workspace: { inspectionId: 'VS-BAD' },
      props: {
        inspections: [{ id: 'VS-BAD', projetoId: 'PRJ-01', dataInicio: 'data-ruim' }],
      },
    });

    await act(async () => {
      root.render(<WorkspacesTab {...props} />);
    });

    expect(container.textContent).toContain('Sem vistoria');
    expect(container.textContent).not.toContain('Vistoria: NaN');
  });
});
