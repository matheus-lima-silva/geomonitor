import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompoundsTab from '../CompoundsTab';
import { storageKeyFor } from '../../hooks/useCompoundDraftAutoSave';

function renderTab(root, props = {}) {
  const defaults = {
    compoundDraft: {},
    setCompoundDraft: vi.fn(),
    profissoes: [],
    signatariosCandidatos: [],
    compounds: [],
    workspaces: [],
    workspaceLabelsById: new Map(),
    compoundWorkspaceSelections: {},
    setCompoundWorkspaceSelections: vi.fn(),
    compoundPreflights: {},
    busy: null,
    handleCreateCompound: vi.fn(),
    handleUpdateCompoundDraft: vi.fn(),
    handleCompoundAddWorkspace: vi.fn(),
    handleCompoundRemoveWorkspace: vi.fn(),
    handleCompoundReorder: vi.fn(),
    handleCompoundGenerate: vi.fn(),
    handleTrashCompound: vi.fn(),
    handleRestoreCompound: vi.fn(),
    handleHardDeleteCompound: vi.fn(),
    handleDownloadReportOutput: vi.fn(),
    buildCompoundDownloadFileName: () => 'file.docx',
    userEmail: 'user@ex.com',
    showToast: vi.fn(),
  };
  act(() => root.render(<CompoundsTab {...defaults} {...props} />));
}

describe('CompoundsTab — banner de rascunho', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('nao mostra banner quando nao ha rascunho', () => {
    renderTab(root);
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).toBeNull();
  });

  it('mostra banner quando ha rascunho com nome', () => {
    window.localStorage.setItem(
      storageKeyFor('user@ex.com'),
      JSON.stringify({ draft: { nome: 'Rascunho 1' }, savedAt: '2026-04-22T10:00:00.000Z' }),
    );
    renderTab(root);
    const card = container.querySelector('[data-testid="compound-draft-resume"]');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Rascunho 1');
  });

  it('descarta rascunho apos confirmacao e mostra toast', () => {
    const key = storageKeyFor('user@ex.com');
    window.localStorage.setItem(
      key,
      JSON.stringify({ draft: { nome: 'A apagar' }, savedAt: '2026-04-22T10:00:00.000Z' }),
    );
    const showToast = vi.fn();
    renderTab(root, { showToast });

    // Abre confirmacao
    act(() => container.querySelector('[data-testid="compound-draft-discard"]').click());
    const confirmBtn = container.querySelector('[data-testid="compound-draft-discard-confirm"]');
    expect(confirmBtn).not.toBeNull();

    act(() => confirmBtn.click());

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Rascunho descartado', 'info');
  });

  it('banner some quando wizard abre via "Continuar edicao"', () => {
    window.localStorage.setItem(
      storageKeyFor('user@ex.com'),
      JSON.stringify({ draft: { nome: 'Em retomada' }, savedAt: '2026-04-22T10:00:00.000Z' }),
    );
    renderTab(root);
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).not.toBeNull();
    act(() => container.querySelector('[data-testid="compound-draft-resume-btn"]').click());
    // wizard aberto — banner nao renderiza mais
    expect(container.querySelector('[data-testid="compound-draft-resume"]')).toBeNull();
  });
});
