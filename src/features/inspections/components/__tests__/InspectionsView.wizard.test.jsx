import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InspectionsView from '../InspectionsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const showMock = vi.fn();
const saveInspectionMock = vi.fn();
const deleteInspectionMock = vi.fn();

vi.mock('../../../../firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      nome: 'Tester Nome',
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

function getTowerPickerButton(label, scope = document.body) {
  return [...scope.querySelectorAll('button')]
    .find((item) => item.textContent.trim() === label);
}

function getHotelBaseSelect(scope = document.body) {
  return [...scope.querySelectorAll('select')]
    .find((item) => [...item.options]
      .some((option) => String(option.textContent || '').includes('Torre base da hospedagem')
        || String(option.textContent || '').includes('Selecione torres')));
}

describe('InspectionsView wizard flow', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveInspectionMock.mockReset();
    deleteInspectionMock.mockReset();
    showMock.mockReset();
    saveInspectionMock.mockResolvedValue('VS-P1-01022026-0001');
    deleteInspectionMock.mockResolvedValue(undefined);
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

  it('opens wizard, validates steps, selects towers by buttons and saves inspection', async () => {
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
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    await clickByText('Avancar');
    expect(showMock).toHaveBeenCalled();

    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-02-06');
    changeInput(dateInputs[1], '2026-02-09');
    await flush();

    expect(document.body.textContent).toContain('Dias gerados: 2');

    await clickByText('Avancar');
    expect(document.body.textContent).toContain('Detalhar dia');
    await clickElement(getTowerPickerButton('Torre 1', document.body));
    await clickElement(getTowerPickerButton('Torre 2', document.body));
    expect(document.body.textContent).toContain('Torre 1');

    await clickByText('Avancar');

    await clickByText('Salvar vistoria');

    expect(saveInspectionMock).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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

    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(onPlanningDraftConsumed).toHaveBeenCalled();

    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(dateInputs[0], '2026-03-02');
    changeInput(dateInputs[1], '2026-03-02');

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

  it('opens inline erosion modal without saving inspection first', async () => {
    saveInspectionMock.mockRejectedValueOnce(new Error('nao deveria salvar ao abrir modal inline'));
    renderView(root);

    await clickByText('Nova Vistoria');

    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-03-09');
    changeInput(dateInputs[1], '2026-03-09');
    await flush();

    await clickByText('Avancar');
    await clickElement(getTowerPickerButton('Torre 1', document.body));

    const erosionButton = document.querySelector('button[title*="erosao"]');
    await clickElement(erosionButton);

    expect(document.body.textContent).toContain('Erosao - Torre 1');
    const inlineModal = document.querySelector('[data-testid="inspection-inline-erosion-modal"]');
    const inlineModalForm = inlineModal?.querySelector('form');
    const inlineModalBody = document.querySelector('[data-testid="inspection-inline-erosion-modal-body"]');
    expect(inlineModal?.className).toContain('items-start');
    expect(inlineModal?.className).toContain('min-h-[100dvh]');
    expect(inlineModal?.className).toContain('overscroll-contain');
    expect(inlineModal?.className).not.toContain('sm:items-center');
    expect(inlineModalBody?.className).toContain('overflow-y-auto');
    expect(inlineModalBody?.className).toContain('overscroll-contain');
    expect(inlineModalForm?.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(saveInspectionMock).not.toHaveBeenCalled();
  });

  it('opens full erosion draft from inline modal and forwards technical payload', async () => {
    const onOpenErosionDraft = vi.fn();
    renderView(root, {
      onOpenErosionDraft,
    });

    await clickByText('Nova Vistoria');

    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-03-10');
    changeInput(dateInputs[1], '2026-03-10');
    await flush();

    await clickByText('Avancar');
    await clickElement(getTowerPickerButton('Torre 1', document.body));

    const erosionButton = document.querySelector('button[title*="erosao"]');
    await clickElement(erosionButton);

    const localSelect = [...document.querySelectorAll('select')]
      .find((element) => [...element.options].some((option) => option.value === 'base_torre'));
    expect(localSelect).toBeTruthy();
    changeInput(localSelect, 'base_torre');
    await clickByText('Abrir cadastro completo na aba Erosoes');
    await flush();

    expect(onOpenErosionDraft).toHaveBeenCalledTimes(1);
    expect(saveInspectionMock).toHaveBeenCalledTimes(1);
    expect(onOpenErosionDraft).toHaveBeenCalledWith(expect.objectContaining({
      projetoId: 'P1',
      torreRef: '1',
      localContexto: {
        localTipo: 'base_torre',
        exposicao: 'faixa_servidao',
        estruturaProxima: 'torre',
        localDescricao: '',
      },
      presencaAguaFundo: '',
      tiposFeicao: [],
      usosSolo: [],
      saturacaoPorAgua: '',
      profundidadeMetros: null,
      declividadeGraus: null,
      distanciaEstruturaMetros: null,
    }));
    expect(onOpenErosionDraft.mock.calls[0][0]).not.toHaveProperty('alturaMaximaClasse');
    expect(onOpenErosionDraft.mock.calls[0][0]).not.toHaveProperty('declividadeClasse');
  });

  it('limits torre base to selected day towers and clears when deselected', async () => {
    renderView(root);

    await clickByText('Nova Vistoria');

    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-03-16');
    changeInput(dateInputs[1], '2026-03-16');
    await flush();

    await clickByText('Avancar');
    await clickElement(getTowerPickerButton('Torre 1', document.body));
    await clickElement(getTowerPickerButton('Torre 3', document.body));

    const hotelBaseSelect = getHotelBaseSelect(document.body);
    expect(hotelBaseSelect).toBeTruthy();
    const optionLabels = [...hotelBaseSelect.options].map((option) => option.textContent || '');
    expect(optionLabels).toContain('Torre 1');
    expect(optionLabels).toContain('Torre 3');
    expect(optionLabels).not.toContain('Torre 2');

    changeInput(hotelBaseSelect, '3');
    expect(hotelBaseSelect.value).toBe('3');

    await clickElement(getTowerPickerButton('Torre 3', document.body));
    expect(hotelBaseSelect.value).toBe('');
    const updatedLabels = [...hotelBaseSelect.options].map((option) => option.textContent || '');
    expect(updatedLabels).not.toContain('Torre 3');
  });

  it('supports searchable hotel dropdown, create new, and preserves spaces in hotel name', async () => {
    renderView(root, {
      inspections: [
        {
          id: 'VS-P1-01012026-0001',
          projetoId: 'P1',
          dataInicio: '2026-01-01',
          dataFim: '2026-01-01',
          detalhesDias: [
            {
              data: '2026-01-01',
              hotelNome: 'Pousada Azul',
              hotelMunicipio: 'Cidade A',
              hotelLogisticaNota: '4',
              hotelReservaNota: '5',
              hotelEstadiaNota: '4',
            },
          ],
        },
      ],
    });

    await clickByText('Nova Vistoria');
    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-03-20');
    changeInput(dateInputs[1], '2026-03-20');
    await flush();

    await clickByText('Avancar');

    await clickByText('Selecionar hotel...');
    const searchInput = document.querySelector('input[type="search"]');
    expect(searchInput).toBeTruthy();
    changeInput(searchInput, 'Pousada Azul');
    await clickByText('Pousada Azul');

    const hotelNameInput = document.querySelector('input[placeholder="Hotel (opcional)"]');
    expect(hotelNameInput).toBeTruthy();
    expect(hotelNameInput.value).toBe('Pousada Azul');

    await clickByText('Pousada Azul (Cidade A)');
    const createSearchInput = document.querySelector('input[type="search"]');
    expect(createSearchInput).toBeTruthy();
    changeInput(createSearchInput, 'Hotel Centro Sul');
    await clickByText('Criar novo hotel: "Hotel Centro Sul"');

    expect(hotelNameInput.value).toBe('Hotel Centro Sul');
    changeInput(hotelNameInput, 'Hotel Centro Sul Norte');
    expect(hotelNameInput.value).toBe('Hotel Centro Sul Norte');
  });

  it('allows selecting Portico (T0) and collapsing tower picker', async () => {
    renderView(root);

    await clickByText('Nova Vistoria');
    const _empreendimentoSibling = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Empreendimento')).nextElementSibling;
    const projectSelect = _empreendimentoSibling.tagName === 'SELECT' ? _empreendimentoSibling : _empreendimentoSibling.querySelector('select');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    changeInput(projectSelect, 'P1');
    changeInput(dateInputs[0], '2026-04-01');
    changeInput(dateInputs[1], '2026-04-01');
    await flush();

    await clickByText('Avancar');

    expect(getTowerPickerButton('Portico (T0)', document.body)).toBeTruthy();
    await clickElement(getTowerPickerButton('Portico (T0)', document.body));
    expect(document.body.textContent).toContain('Portico (T0)');

    const toggleButton = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Ocultar'));
    expect(toggleButton).toBeTruthy();
    await clickElement(toggleButton);
    expect(getTowerPickerButton('Portico (T0)', document.body)).toBeFalsy();

    await clickElement(toggleButton);
    expect(getTowerPickerButton('Portico (T0)', document.body)).toBeTruthy();
  });
});
