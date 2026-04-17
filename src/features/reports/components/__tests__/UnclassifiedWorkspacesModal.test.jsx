import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnclassifiedWorkspacesModal from '../UnclassifiedWorkspacesModal';

function renderModal(container, root, props) {
  act(() => root.render(<UnclassifiedWorkspacesModal open {...props} />));
}

function buildProjectNamesById(pairs = []) {
  return new Map(pairs);
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

  it('agrupa workspaces por empreendimento e filtra vistorias por projeto', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [
        { id: 'RW-1', nome: 'Workspace A', projectId: 'PRJ-01' },
        { id: 'RW-2', nome: 'Workspace B', projectId: 'PRJ-01' },
        { id: 'RW-3', nome: 'Workspace C', projectId: 'PRJ-02' },
      ],
      inspections: [
        { id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-03-10', responsavel: 'Joao' },
        { id: 'VS-02', projetoId: 'PRJ-01', dataInicio: '2026-04-05', responsavel: 'Maria' },
        { id: 'VS-10', projetoId: 'PRJ-02', dataInicio: '2026-04-12', responsavel: 'Paulo' },
      ],
      projectNamesById: buildProjectNamesById([['PRJ-01', 'Linha Norte'], ['PRJ-02', 'Linha Sul']]),
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    // Dois grupos (projetos)
    expect(document.querySelector('[data-testid="unclassified-project-PRJ-01"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="unclassified-project-PRJ-02"]')).not.toBeNull();

    // Nome do projeto aparece no header
    expect(document.body.textContent).toContain('Linha Norte');
    expect(document.body.textContent).toContain('Linha Sul');

    // Dropdown do RW-3 (PRJ-02) lista VS-10 mas nao VS-01/VS-02
    const select3 = document.querySelector('#unclassified-select-RW-3');
    const values3 = [...select3.querySelectorAll('option')].map((o) => o.value);
    expect(values3).toContain('VS-10');
    expect(values3).not.toContain('VS-01');
    expect(values3).not.toContain('VS-02');

    // Dropdown do RW-1 (PRJ-01) lista VS-01/VS-02 mas nao VS-10
    const select1 = document.querySelector('#unclassified-select-RW-1');
    const values1 = [...select1.querySelectorAll('option')].map((o) => o.value);
    expect(values1).toContain('VS-01');
    expect(values1).toContain('VS-02');
    expect(values1).not.toContain('VS-10');
  });

  it('habilita salvar apenas quando todos os workspaces tem vistoria atribuida', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [
        { id: 'RW-1', nome: 'Workspace A', projectId: 'PRJ-01' },
        { id: 'RW-2', nome: 'Workspace B', projectId: 'PRJ-01' },
      ],
      inspections: [{ id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-03-10' }],
      projectNamesById: buildProjectNamesById([['PRJ-01', 'Linha Norte']]),
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    const saveButton = [...document.querySelectorAll('button')].find((btn) =>
      btn.textContent.includes('Salvar classifica'),
    );
    expect(saveButton.disabled).toBe(true);

    const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    const select1 = document.querySelector('#unclassified-select-RW-1');
    act(() => {
      selectSetter.call(select1, 'VS-01');
      select1.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(saveButton.disabled).toBe(true);

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
      unclassifiedWorkspaces: [{ id: 'RW-1', nome: 'Workspace A', projectId: 'PRJ-01' }],
      inspections: [{ id: 'VS-01', projetoId: 'PRJ-01', dataInicio: '2026-03-10' }],
      projectNamesById: buildProjectNamesById([['PRJ-01', 'Linha Norte']]),
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

  it('cria nova vistoria inline usando o projeto do workspace', async () => {
    const onCreateInspection = vi.fn().mockResolvedValue({ id: 'VS-NEW' });
    renderModal(container, root, {
      unclassifiedWorkspaces: [{ id: 'RW-1', nome: 'Workspace A', projectId: 'PRJ-02' }],
      inspections: [],
      projectNamesById: buildProjectNamesById([['PRJ-02', 'Linha Sul']]),
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection,
    });

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

    // A vistoria e criada com o projetoId DO WORKSPACE (PRJ-02), nao um prop global
    expect(onCreateInspection).toHaveBeenCalledWith({
      projetoId: 'PRJ-02',
      dataInicio: '2026-05-01',
      responsavel: '',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(async () => {});
    expect(document.querySelector('[data-testid="unclassified-new-form-RW-1"]')).toBeNull();
  });

  it('mostra mensagem de sucesso quando nao ha workspaces por classificar', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [],
      inspections: [],
      projectNamesById: buildProjectNamesById(),
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    expect(document.body.textContent).toContain('ja estao classificados');
  });

  it('cai em "sem empreendimento" quando projectId do workspace esta vazio', () => {
    renderModal(container, root, {
      unclassifiedWorkspaces: [{ id: 'RW-OR', nome: 'Orfao', projectId: '' }],
      inspections: [],
      projectNamesById: buildProjectNamesById(),
      busy: '',
      onAssign: vi.fn(),
      onCreateInspection: vi.fn(),
    });

    expect(document.querySelector('[data-testid="unclassified-project-__none__"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Sem empreendimento');
  });
});
