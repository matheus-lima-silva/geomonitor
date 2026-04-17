import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspacesTab from '../WorkspacesTab';

function buildStubProps(overrides = {}) {
  return {
    projects: [],
    projectOptions: [],
    projectNamesById: new Map(),
    sortedProjects: [],
    workspaces: [],
    workspaceCandidates: [],
    filteredWorkspaceList: [],
    workspaceSearchQuery: '',
    setWorkspaceSearchQuery: vi.fn(),
    selectedProjectId: 'PRJ-01',
    setSelectedProjectId: vi.fn(),
    workspaceImportTargetId: 'RW-1',
    setWorkspaceImportTargetId: vi.fn(),
    selectedWorkspace: { id: 'RW-1', nome: 'Workspace 1', projectId: 'PRJ-01', status: 'draft' },
    selectedWorkspaceProject: { id: 'PRJ-01', nome: 'Projeto' },
    workspaceTowerOptions: [],
    workspaceDraft: { projectId: '', nome: '', descricao: '' },
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
    handleArchiveOldTrashedPhotos: vi.fn(),
    handleEmptyPhotoTrash: vi.fn(),
    retentionDays: 30,
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
    ...overrides,
  };
}

async function openTrashSection(container) {
  const trashButton = [...container.querySelectorAll('button')].find(
    (btn) => btn.textContent.trim().startsWith('Lixeira'),
  );
  if (!trashButton) throw new Error('Botao Lixeira nao encontrado');
  await act(async () => {
    trashButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('WorkspacesTab — lixeira por torre', () => {
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

  it('agrupa fotos deletadas por torre e mostra contador por secao', async () => {
    const trashedPhotos = [
      { id: 'RPH-1', towerId: 'T-01', caption: 'Foto A', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-01', caption: 'Foto B', deletedAt: '2026-04-17T11:00:00Z' },
      { id: 'RPH-3', towerId: 'T-02', caption: 'Foto C', deletedAt: '2026-04-17T12:00:00Z' },
      { id: 'RPH-4', towerId: '', caption: 'Sem torre', deletedAt: '2026-04-17T13:00:00Z' },
    ];
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ trashedPhotos })} />);
    });
    await openTrashSection(container);

    const grouped = container.querySelector('[data-testid="trash-grouped"]');
    expect(grouped).not.toBeNull();
    const groups = grouped.querySelectorAll('[data-testid^="trash-group-"]');
    expect(groups.length).toBe(3);

    const text = grouped.textContent;
    expect(text).toContain('Torre T-01 · 2');
    expect(text).toContain('Torre T-02 · 1');
    expect(text).toContain('Sem torre · 1');
  });

  it('chama handleRestoreTowerTrashedPhotos com as fotos da torre clicada', async () => {
    const handleRestoreTowerTrashedPhotos = vi.fn();
    const trashedPhotos = [
      { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-01', caption: 'B', deletedAt: '2026-04-17T11:00:00Z' },
      { id: 'RPH-3', towerId: 'T-02', caption: 'C', deletedAt: '2026-04-17T12:00:00Z' },
    ];
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ trashedPhotos, handleRestoreTowerTrashedPhotos })} />);
    });
    await openTrashSection(container);

    const groupT01 = container.querySelector('[data-testid="trash-group-T-01"]');
    expect(groupT01).not.toBeNull();
    const restoreBtn = groupT01.querySelector('button[aria-label^="Restaurar todas"]');
    expect(restoreBtn).not.toBeNull();

    await act(async () => {
      restoreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleRestoreTowerTrashedPhotos).toHaveBeenCalledTimes(1);
    const calledWith = handleRestoreTowerTrashedPhotos.mock.calls[0][0];
    expect(calledWith.map((photo) => photo.id)).toEqual(['RPH-1', 'RPH-2']);
  });

  it('mostra empty state quando a lixeira esta vazia', async () => {
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ trashedPhotos: [] })} />);
    });
    await openTrashSection(container);

    expect(container.querySelector('[data-testid="trash-grouped"]')).toBeNull();
    expect(container.textContent).toContain('Lixeira vazia');
  });

  it('desabilita o botao de restaurar torre enquanto a operacao esta em andamento', async () => {
    const trashedPhotos = [
      { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
    ];
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ trashedPhotos, busy: 'restore-tower:T-01' })} />);
    });
    await openTrashSection(container);

    const groupT01 = container.querySelector('[data-testid="trash-group-T-01"]');
    const restoreBtn = groupT01.querySelector('button[aria-label^="Restaurar todas"]');
    expect(restoreBtn.disabled).toBe(true);
  });
});

describe('WorkspacesTab — modal expandido da lixeira', () => {
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

  async function openExpandedModal(trashedPhotos, extraProps = {}) {
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({ trashedPhotos, ...extraProps })} />);
    });
    await openTrashSection(container);
    const expandBtn = container.querySelector('[data-testid="trash-expand-button"]');
    if (!expandBtn) throw new Error('Botao Expandir nao encontrado');
    await act(async () => {
      expandBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('abre o modal expandido e lista todas as fotos agrupadas por torre', async () => {
    await openExpandedModal([
      { id: 'RPH-1', towerId: 'T-01', caption: 'Foto A', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-01', caption: 'Foto B', deletedAt: '2026-04-17T11:00:00Z' },
      { id: 'RPH-3', towerId: 'T-02', caption: 'Foto C', deletedAt: '2026-04-17T12:00:00Z' },
    ]);

    const body = document.querySelector('[data-testid="trash-expanded-body"]');
    expect(body).not.toBeNull();
    expect(body.textContent).toContain('Foto A');
    expect(body.textContent).toContain('Foto B');
    expect(body.textContent).toContain('Foto C');
  });

  it('filtra por torre via dropdown independente da ordenacao', async () => {
    await openExpandedModal([
      { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-01', caption: 'B', deletedAt: '2026-04-17T11:00:00Z' },
      { id: 'RPH-3', towerId: 'T-02', caption: 'C', deletedAt: '2026-04-17T12:00:00Z' },
      { id: 'RPH-4', towerId: '', caption: 'SemTorre', deletedAt: '2026-04-17T13:00:00Z' },
    ]);

    const towerSelect = document.querySelector('#trash-expanded-tower');
    expect(towerSelect).not.toBeNull();
    const values = [...towerSelect.querySelectorAll('option')].map((o) => o.value);
    expect(values).toContain('__all__');
    expect(values).toContain('T-01');
    expect(values).toContain('T-02');
    expect(values).toContain('__none__');

    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    await act(async () => {
      setter.call(towerSelect, 'T-01');
      towerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const cards = document.querySelectorAll('[data-testid^="trash-card-RPH-"]');
    expect(cards.length).toBe(2);
    const ids = [...cards].map((c) => c.getAttribute('data-testid'));
    expect(ids).toContain('trash-card-RPH-1');
    expect(ids).toContain('trash-card-RPH-2');
    expect(ids).not.toContain('trash-card-RPH-3');
  });

  it('toggle "agrupar por torre" funciona com qualquer ordenacao', async () => {
    await openExpandedModal([
      { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-02', caption: 'B', deletedAt: '2026-04-17T11:00:00Z' },
    ]);

    // Sem toggle (sort = deleted_desc por default) → 1 secao sem header h3
    let body = document.querySelector('[data-testid="trash-expanded-body"]');
    expect(body.querySelectorAll('section h3').length).toBe(0);
    expect(body.querySelectorAll('[data-testid^="trash-expanded-group-"]').length).toBe(1);

    const toggle = document.querySelector('[data-testid="trash-group-toggle"]');
    await act(async () => { toggle.click(); });

    body = document.querySelector('[data-testid="trash-expanded-body"]');
    expect(body.querySelectorAll('section h3').length).toBe(2);
    expect(body.querySelector('[data-testid="trash-expanded-group-T-01"]')).not.toBeNull();
    expect(body.querySelector('[data-testid="trash-expanded-group-T-02"]')).not.toBeNull();
  });

  it('banner "arquivar antigas" aparece quando ha fotos > retencao; botao dispara handler', async () => {
    const handleArchiveOldTrashedPhotos = vi.fn();
    const oldDate = new Date(Date.now() - 45 * 86_400_000).toISOString();
    await openExpandedModal(
      [
        { id: 'RPH-OLD', towerId: 'T-01', caption: 'antiga', deletedAt: oldDate },
        { id: 'RPH-NEW', towerId: 'T-01', caption: 'recente', deletedAt: new Date().toISOString() },
      ],
      {
        handleArchiveOldTrashedPhotos,
        selectedWorkspace: { id: 'RW-1', nome: 'W', projectId: 'PRJ-01', currentUserRole: 'owner' },
      },
    );

    const banner = document.querySelector('[data-testid="trash-old-banner"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('1');

    const btn = document.querySelector('[data-testid="trash-archive-old-button"]');
    expect(btn.disabled).toBe(false);
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleArchiveOldTrashedPhotos).toHaveBeenCalledWith(30);
  });

  it('botao de arquivar antigas fica desabilitado sem canWrite', async () => {
    const oldDate = new Date(Date.now() - 45 * 86_400_000).toISOString();
    // Renderiza direto pelo modal (como nos outros testes do panel isolado)
    // para poder controlar canWrite sem depender de currentUserRole do workspace.
    const props = buildStubProps({
      trashedPhotos: [{ id: 'RPH-OLD', towerId: 'T-01', caption: 'x', deletedAt: oldDate }],
      selectedWorkspace: { id: 'RW-1', nome: 'W', projectId: 'PRJ-01', currentUserRole: 'viewer' },
    });
    await act(async () => { root.render(<WorkspacesTab {...props} />); });
    await openTrashSection(container);
    const expandBtn = container.querySelector('[data-testid="trash-expand-button"]');
    await act(async () => { expandBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const btn = document.querySelector('[data-testid="trash-archive-old-button"]');
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it('badge amarelo "antigas" aparece na sidebar quando ha fotos antigas', async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await act(async () => {
      root.render(<WorkspacesTab {...buildStubProps({
        trashedPhotos: [
          { id: 'RPH-OLD', towerId: 'T-01', caption: 'a', deletedAt: oldDate },
          { id: 'RPH-NEW', towerId: 'T-01', caption: 'b', deletedAt: new Date().toISOString() },
        ],
      })} />);
    });
    await openTrashSection(container);

    const badge = container.querySelector('[data-testid="sidebar-old-trash-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('1');
  });

  it('exibe badge >30 dias em fotos antigas', async () => {
    const oldDate = new Date(Date.now() - 35 * 86_400_000).toISOString();
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    await openExpandedModal([
      { id: 'RPH-OLD', towerId: 'T-01', caption: 'antiga', deletedAt: oldDate },
      { id: 'RPH-NEW', towerId: 'T-01', caption: 'nova', deletedAt: recentDate },
    ]);

    expect(document.querySelector('[data-testid="trash-card-old-RPH-OLD"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="trash-card-old-RPH-NEW"]')).toBeNull();
  });

  it('filtra as fotos quando o campo de busca e preenchido', async () => {
    await openExpandedModal([
      { id: 'RPH-1', towerId: 'T-01', caption: 'Fundacao leste', deletedAt: '2026-04-17T10:00:00Z' },
      { id: 'RPH-2', towerId: 'T-02', caption: 'Vista aerea', deletedAt: '2026-04-17T11:00:00Z' },
    ]);

    const searchInput = document.querySelector('#trash-expanded-search');
    const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      inputSetter.call(searchInput, 'fundacao');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const body = document.querySelector('[data-testid="trash-expanded-body"]');
    expect(body.textContent).toContain('Fundacao leste');
    expect(body.textContent).not.toContain('Vista aerea');
  });

  it('restaura fotos selecionadas via checkbox', async () => {
    const handleRestoreSelectedTrashedPhotos = vi.fn();
    await openExpandedModal(
      [
        { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
        { id: 'RPH-2', towerId: 'T-01', caption: 'B', deletedAt: '2026-04-17T11:00:00Z' },
      ],
      { handleRestoreSelectedTrashedPhotos },
    );

    const card1 = document.querySelector('[data-testid="trash-card-RPH-1"]');
    const checkbox1 = card1.querySelector('input[type="checkbox"]');
    await act(async () => {
      checkbox1.click();
    });

    const selectionBar = document.querySelector('[data-testid="trash-selection-bar"]');
    expect(selectionBar).not.toBeNull();
    expect(selectionBar.textContent).toContain('1 selecionada');

    const restoreBtn = [...selectionBar.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Restaurar selecionadas'),
    );
    await act(async () => {
      restoreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleRestoreSelectedTrashedPhotos).toHaveBeenCalledTimes(1);
    expect(handleRestoreSelectedTrashedPhotos).toHaveBeenCalledWith(['RPH-1']);
  });

  it('pagina a lixeira expandida e navega entre paginas', async () => {
    const trashedPhotos = Array.from({ length: 30 }, (_, i) => ({
      id: `RPH-${i + 1}`,
      towerId: `T-${(i % 3) + 1}`,
      caption: `Foto ${i + 1}`,
      deletedAt: new Date(Date.now() - i * 1000).toISOString(),
    }));

    await openExpandedModal(trashedPhotos);

    // Pagina 1 — 24 primeiros cards
    let cards = document.querySelectorAll('[data-testid^="trash-card-"]');
    expect(cards.length).toBe(24);

    const indicator = document.querySelector('[data-testid="trash-page-indicator"]');
    expect(indicator.textContent).toBe('1/2');

    const nextBtn = document.querySelector('[data-testid="trash-page-next"]');
    const prevBtn = document.querySelector('[data-testid="trash-page-prev"]');
    expect(nextBtn.disabled).toBe(false);
    expect(prevBtn.disabled).toBe(true);

    await act(async () => {
      nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    cards = document.querySelectorAll('[data-testid^="trash-card-"]');
    expect(cards.length).toBe(6);
    expect(document.querySelector('[data-testid="trash-page-indicator"]').textContent).toBe('2/2');
    expect(document.querySelector('[data-testid="trash-page-next"]').disabled).toBe(true);
  });

  it('volta para pagina 1 quando o filtro muda', async () => {
    const trashedPhotos = Array.from({ length: 30 }, (_, i) => ({
      id: `RPH-${i + 1}`,
      towerId: 'T-01',
      caption: i === 29 ? 'unico-match' : `comum-${i + 1}`,
      deletedAt: new Date().toISOString(),
    }));

    await openExpandedModal(trashedPhotos);

    const nextBtn = document.querySelector('[data-testid="trash-page-next"]');
    await act(async () => {
      nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="trash-page-indicator"]').textContent).toBe('2/2');

    const searchInput = document.querySelector('#trash-expanded-search');
    const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      inputSetter.call(searchInput, 'unico-match');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Apos filtrar para 1 resultado, deve voltar para pagina 1
    expect(document.querySelector('[data-testid="trash-page-indicator"]').textContent).toBe('1/1');
    expect(document.querySelectorAll('[data-testid^="trash-card-"]').length).toBe(1);
  });

  it('permite alterar o tamanho da pagina', async () => {
    const trashedPhotos = Array.from({ length: 30 }, (_, i) => ({
      id: `RPH-${i + 1}`,
      towerId: 'T-01',
      caption: `Foto ${i + 1}`,
      deletedAt: new Date().toISOString(),
    }));

    await openExpandedModal(trashedPhotos);

    expect(document.querySelectorAll('[data-testid^="trash-card-"]').length).toBe(24);

    const sizeSelect = document.querySelector('#trash-page-size');
    const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    await act(async () => {
      selectSetter.call(sizeSelect, '48');
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.querySelectorAll('[data-testid^="trash-card-"]').length).toBe(30);
    expect(document.querySelector('[data-testid="trash-page-indicator"]').textContent).toBe('1/1');
  });

  it('confirma exclusao permanente das fotos selecionadas', async () => {
    const handleHardDeleteSelectedTrashedPhotos = vi.fn();
    await openExpandedModal(
      [
        { id: 'RPH-1', towerId: 'T-01', caption: 'A', deletedAt: '2026-04-17T10:00:00Z' },
      ],
      { handleHardDeleteSelectedTrashedPhotos },
    );

    const checkbox = document.querySelector('[data-testid="trash-card-RPH-1"] input[type="checkbox"]');
    await act(async () => { checkbox.click(); });

    const selectionBar = document.querySelector('[data-testid="trash-selection-bar"]');
    const deleteBtn = [...selectionBar.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Excluir permanentemente'),
    );
    await act(async () => {
      deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Modal de confirmacao aparece
    const confirmModal = [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
      dialog.textContent.includes('Esta ação não pode ser desfeita'),
    );
    expect(confirmModal).toBeTruthy();

    const confirmBtn = [...confirmModal.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Excluir 1 foto'),
    );
    await act(async () => {
      confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleHardDeleteSelectedTrashedPhotos).toHaveBeenCalledTimes(1);
    expect(handleHardDeleteSelectedTrashedPhotos).toHaveBeenCalledWith(['RPH-1']);
  });
});
