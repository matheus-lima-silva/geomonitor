import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionsView from '../InspectionsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const showMock = vi.fn();
const saveInspectionMock = vi.fn();
const deleteInspectionMock = vi.fn();

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      email: 'tester@example.com',
      displayName: 'Tester',
      uid: 'uid-1',
    },
  }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({
    show: showMock,
  }),
}));

vi.mock('../../../../services/inspectionService', () => ({
  saveInspection: (...args) => saveInspectionMock(...args),
  deleteInspection: (...args) => deleteInspectionMock(...args),
}));

function renderView(root, props = {}) {
  const baseProps = {
    inspections: [],
    projects: [
      { id: 'P1', nome: 'Projeto 1', torres: '10' },
      { id: 'P2', nome: 'Projeto 2', torres: '20' },
    ],
    erosions: [],
    forcedProjectFilterId: null,
    onClearForcedProjectFilter: vi.fn(),
    searchTerm: '',
    planningDraft: null,
    onPlanningDraftConsumed: vi.fn(),
    ...props,
  };

  act(() => {
    root.render(<InspectionsView {...baseProps} />);
  });
  return baseProps;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function changeInput(el, value) {
  const { set: valueSetter } = Object.getOwnPropertyDescriptor(el, 'value') || {};
  const prototype = Object.getPrototypeOf(el);
  const { set: prototypeSetter } = Object.getOwnPropertyDescriptor(prototype, 'value') || {};
  if (prototypeSetter && valueSetter !== prototypeSetter) {
    prototypeSetter.call(el, value);
  } else if (valueSetter) {
    valueSetter.call(el, value);
  } else {
    el.value = value;
  }
  act(() => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickByText(text, scope = document.body) {
  const button = [...scope.querySelectorAll('button')].find((item) => item.textContent.includes(text));
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  return button;
}

async function clickElement(element) {
  expect(element).toBeTruthy();
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('InspectionsView wizard flow', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveInspectionMock.mockResolvedValue('VS-P1-01022026-0001');
    deleteInspectionMock.mockResolvedValue(undefined);
    showMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('opens wizard, validates steps, generates checklist, saves and keeps pending badge list', async () => {
    renderView(root, {
      inspections: [
        {
          id: 'VS-P2-10012026-0001',
          projetoId: 'P2',
          dataInicio: '2026-01-10',
          dataFim: '2026-01-11',
          responsavel: 'Ana',
          detalhesDias: [],
        },
      ],
      erosions: [
        {
          id: 'ER-1',
          projetoId: 'P2',
          torreRef: '7',
          pendenciasVistoria: [{ vistoriaId: 'VS-P2-10012026-0001', status: 'pendente', dia: '' }],
        },
      ],
    });

    expect(container.textContent).toContain('1 pendente(s)');

    await clickByText('Nova Vistoria');
    expect(document.querySelector('.inspections-wizard-modal')).toBeTruthy();

    await clickByText('Avancar');
    expect(showMock).toHaveBeenCalled();

    const projectSelect = document.querySelector('.inspections-wizard-modal select');
    const dateInputs = document.querySelectorAll('.inspections-wizard-modal input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-02-01');
    changeInput(dateInputs[1], '2026-02-02');
    await flush();

    await clickByText('Avancar');
    expect(document.body.textContent).toContain('Detalhar dia');

    const towerInput = document.querySelector('.inspections-wizard-modal input[placeholder="Ex: 1-3, 5, 7"]');
    changeInput(towerInput, '1, 2');
    await clickByText('Gerar checklist');
    expect(document.body.textContent).toContain('Torre 1');

    await clickByText('Avancar');

    await clickByText('Salvar vistoria');

    expect(saveInspectionMock).toHaveBeenCalled();
    expect(document.querySelector('.inspections-wizard-modal')).toBeNull();
  });

  it('applies suggested towers from planning draft', async () => {
    const onPlanningDraftConsumed = vi.fn();
    renderView(root, {
      planningDraft: {
        projectId: 'P1',
        towerInput: '5, 6',
        towers: [],
      },
      onPlanningDraftConsumed,
    });

    expect(document.querySelector('.inspections-wizard-modal')).toBeTruthy();
    expect(onPlanningDraftConsumed).toHaveBeenCalled();

    const dateInputs = document.querySelectorAll('.inspections-wizard-modal input[type="date"]');
    changeInput(dateInputs[0], '2026-03-01');
    changeInput(dateInputs[1], '2026-03-01');

    await flush();
    await clickByText('Avancar');
    await clickByText('Aplicar sugeridas');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Torre 5');
    expect(document.body.textContent).toContain('Torre 6');
  });

  it('opens full erosion draft from inline modal and forwards technical payload', async () => {
    const onOpenErosionDraft = vi.fn();
    renderView(root, {
      onOpenErosionDraft,
    });

    await clickByText('Nova Vistoria');

    const projectSelect = document.querySelector('.inspections-wizard-modal select');
    const dateInputs = document.querySelectorAll('.inspections-wizard-modal input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-03-10');
    changeInput(dateInputs[1], '2026-03-10');
    await flush();

    await clickByText('Avancar');

    const towerInput = document.querySelector('.inspections-wizard-modal input[placeholder="Ex: 1-3, 5, 7"]');
    changeInput(towerInput, '1');
    await clickByText('Gerar checklist');

    const erosionButton = document.querySelector('.inspections-tower-btn-erosion');
    await clickElement(erosionButton);

    const localSelect = document.querySelector('.inspections-inline-erosion-modal select');
    changeInput(localSelect, 'Base de torre');
    await clickByText('Abrir cadastro completo na aba Erosoes');

    expect(onOpenErosionDraft).toHaveBeenCalledTimes(1);
    expect(onOpenErosionDraft).toHaveBeenCalledWith(expect.objectContaining({
      projetoId: 'P1',
      torreRef: '1',
      presencaAguaFundo: '',
      tiposFeicao: [],
      declividadeClasse: '',
      usosSolo: [],
      saturacaoPorAgua: '',
    }));
    expect(onOpenErosionDraft.mock.calls[0][0]).not.toHaveProperty('alturaMaximaClasse');
  });
});
