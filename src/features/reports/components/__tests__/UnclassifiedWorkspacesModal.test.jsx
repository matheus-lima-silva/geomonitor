import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnclassifiedWorkspacesModal from '../UnclassifiedWorkspacesModal';

function renderModal(container, root, props) {
  act(() => root.render(<UnclassifiedWorkspacesModal open {...props} />));
}

describe('UnclassifiedWorkspacesModal', () => {
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

  it('lista workspaces n\u00e3o classificados com dropdown de vistorias existentes', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [
        { id: 'RW-1', nome: 'Workspace A' },
        { id: 'RW-2', nome: 'Workspace B' },
      ],
      projectInspections: [
        { id: 'VS-01', dataInicio: '2026-03-10', responsavel: 'Joao' },
        { id: 'VS-02', dataInicio: '2026-04-05', responsavel: 'Maria' },
      ],
      projectId: 'PRJ-01',
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    expect(document.querySelector('[data-testid="unclassified-row-RW-1"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="unclassified-row-RW-2"]')).not.toBeNull();

    const select1 = document.querySelector('#unclassified-select-RW-1');
    const options = [...select1.querySelectorAll('option')].map((opt) => opt.textContent.trim());
    expect(options).toContain('Selecione uma vistoria...');
    expect(options.some((o) => o.includes('VS-02'))).toBe(true);
    expect(options.some((o) => o.includes('VS-01'))).toBe(true);
  });

  it('habilita salvar apenas quando todos os workspaces t\u00eam vistoria atribu\u00edda', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [
        { id: 'RW-1', nome: 'Workspace A' },
        { id: 'RW-2', nome: 'Workspace B' },
      ],
      projectInspections: [{ id: 'VS-01', dataInicio: '2026-03-10' }],
      projectId: 'PRJ-01',
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    const saveButton = [...document.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Salvar classifica'),
    );
    expect(saveButton.disabled).toBe(true);

    // Atribui VS-01 apenas ao RW-1
    const select1 = document.querySelector('#unclassified-select-RW-1');
    const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    act(() => {
      selectSetter.call(select1, 'VS-01');
      select1.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(saveButton.disabled).toBe(true);

    // Atribui VS-01 tamb\u00e9m ao RW-2
    const select2 = document.querySelector('#unclassified-select-RW-2');
    act(() => {
      selectSetter.call(select2, 'VS-01');
      select2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(saveButton.disabled).toBe(false);
  });

  it('chama onAssign com os pares workspaceId/inspectionId ao salvar', async () => {
    const onAssign = vi.fn().mockResolvedValue();
    renderModal(container, root, {
      unclassifiedWorkspaces: [{ id: 'RW-1', nome: 'Workspace A' }],
      projectInspections: [{ id: 'VS-01', dataInicio: '2026-03-10' }],
      projectId: 'PRJ-01',
      busy: '',
      onAssign,
      onCreateInspection: vi.fn(),
    });

    const select1 = document.querySelector('#unclassified-select-RW-1');
    const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    await act(async () => {
      selectSetter.call(select1, 'VS-01');
      select1.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveButton = [...document.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Salvar classifica'),
    );
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith([{ workspaceId: 'RW-1', inspectionId: 'VS-01' }]);
  });

  it('cria nova vistoria inline e a atribui ao workspace', async () => {
    const onCreateInspection = vi.fn().mockResolvedValue({ id: 'VS-NEW' });
    renderModal(container, root, {
      unclassifiedWorkspaces: [{ id: 'RW-1', nome: 'Workspace A' }],
      projectInspections: [],
      projectId: 'PRJ-01',
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection,
    });

    // Clica em "Nova vistoria"
    const newBtn = [...document.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Nova vistoria'),
    );
    await act(async () => {
      newBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const form = document.querySelector('[data-testid="unclassified-new-form-RW-1"]');
    expect(form).not.toBeNull();

    const dataInput = document.querySelector('#new-inspection-data-RW-1');
    const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      inputSetter.call(dataInput, '2026-05-01');
      dataInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const createAndLinkBtn = [...form.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Criar e vincular'),
    );
    await act(async () => {
      createAndLinkBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCreateInspection).toHaveBeenCalledWith({
      projetoId: 'PRJ-01',
      dataInicio: '2026-05-01',
      responsavel: '',
    });

    // Apos criacao, o form inline some (estado interno fechou)
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(async () => {});
    expect(document.querySelector('[data-testid="unclassified-new-form-RW-1"]')).toBeNull();
  });

  it('mostra mensagem de sucesso quando n\u00e3o h\u00e1 workspaces por classificar', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [],
      projectInspections: [],
      projectId: 'PRJ-01',
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    expect(document.body.textContent).toContain('j\u00e1 est\u00e3o classificados');
  });
});
