import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErosionsView from '../ErosionsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const showMock = vi.fn();
const saveErosionMock = vi.fn();
const saveErosionManualFollowupEventMock = vi.fn();

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

vi.mock('../../../../services/erosionService', () => ({
  deleteErosion: vi.fn(),
  postCalculoErosao: vi.fn(async () => ({
    campos_calculados: {
      criticidade_score: 0,
      criticidade_classe: 'Baixo',
      codigo: 'C1',
      pontos: { T: 0, P: 0, D: 0, S: 0, E: 0 },
      tipo_erosao_classe: 'T1',
      profundidade_classe: 'P1',
      declividade_classe: 'D1',
      solo_classe: 'S1',
      exposicao_classe: 'E1',
      tipo_medida_recomendada: 'preventiva',
      lista_solucoes_sugeridas: [],
      alertas_validacao: [],
    },
    alertas_validacao: [],
  })),
  saveErosion: (...args) => saveErosionMock(...args),
  saveErosionManualFollowupEvent: (...args) => saveErosionManualFollowupEventMock(...args),
}));

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
  await clickElement(button);
}

async function clickElement(button) {
  expect(button).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

async function toggleProjectDropdown(scope = document.body) {
  const trigger = scope.querySelector('button[aria-haspopup="listbox"]');
  expect(trigger).toBeTruthy();
  await clickElement(trigger);
}

async function selectProject(scope, projectId) {
  await toggleProjectDropdown(scope);
  const option = [...scope.querySelectorAll('button[data-project-id]')]
    .find((button) => String(button.getAttribute('data-project-id') || '') === String(projectId || ''));
  expect(option).toBeTruthy();
  await clickElement(option);
}

function renderView(root, props = {}) {
  const baseProps = {
    erosions: [
      {
        id: 'ERS-2',
        projetoId: 'P1',
        torreRef: '10',
        localContexto: {
          localTipo: 'base_torre',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'torre',
          localDescricao: '',
        },
        status: 'Ativo',
        impacto: 'Alto',
        acompanhamentosResumo: [],
      },
      {
        id: 'ERS-1',
        projetoId: 'P1',
        torreRef: '7',
        localContexto: {
          localTipo: 'base_torre',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'torre',
          localDescricao: '',
        },
        status: 'Monitoramento',
        impacto: 'Medio',
        locationCoordinates: {
          latitude: '-22.952',
          longitude: '-43.211',
        },
        acompanhamentosResumo: [],
      },
      {
        id: 'ERS-9',
        projetoId: 'P2',
        torreRef: '1',
        localContexto: {
          localTipo: 'base_torre',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'torre',
          localDescricao: '',
        },
        status: 'Ativo',
        impacto: 'Baixo',
        acompanhamentosResumo: [],
      },
    ],
    projects: [
      { id: 'P1', nome: 'Projeto 1', torres: '10' },
      { id: 'P2', nome: 'Projeto 2', torres: '10' },
    ],
    inspections: [{ id: 'VS-1', projetoId: 'P1', dataInicio: '2026-01-10' }],
    rulesConfig: {},
    searchTerm: '',
    ...props,
  };

  act(() => {
    root.render(<ErosionsView {...baseProps} />);
  });
  return baseProps;
}

describe('ErosionsView', () => {
  let container;
  let root;
  let originalOpen;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showMock.mockReset();
    saveErosionMock.mockReset();
    saveErosionManualFollowupEventMock.mockReset();
    originalOpen = window.open;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
    window.open = originalOpen;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts without selected empreendimento and without cards rendered', () => {
    renderView(root);
    expect(container.textContent).toContain('Selecione um empreendimento para iniciar a leitura de erosoes.');
    expect(container.textContent).not.toContain('ERS-1');
  });

  it('shows cards automatically after selecting empreendimento', async () => {
    renderView(root);
    await selectProject(container, 'P1');
    expect(container.textContent).toContain('ERS-1');
    expect(container.textContent).toContain('ERS-2');
  });

  it('orders cards by torre number', async () => {
    renderView(root);
    await selectProject(container, 'P1');
    const cardTitles = [...container.querySelectorAll('button')]
      .filter((button) => button.textContent.includes('Detalhes'))
      .map((button) => button.closest('article')?.querySelector('h3')?.textContent)
      .filter(Boolean);
    expect(cardTitles).toEqual(['ERS-1', 'ERS-2']);
  });

  it('allows toggling cards visibility with Mostrar/Ocultar cards', async () => {
    renderView(root);
    await selectProject(container, 'P1');

    await clickByText('Ocultar cards', container);
    expect(container.textContent).toContain('Cards ocultos');

    await clickByText('Mostrar cards', container);
    expect(container.textContent).toContain('ERS-1');
    expect(container.textContent).toContain('ERS-2');
  });

  it('keeps cards visible when empreendimento changes', async () => {
    renderView(root);
    await selectProject(container, 'P1');
    expect(container.textContent).toContain('ERS-1');

    await selectProject(container, 'P2');
    expect(container.textContent).toContain('ERS-9');
  });

  it('filters empreendimento options with search embedded in dropdown menu', async () => {
    renderView(root);
    await toggleProjectDropdown(container);

    const searchInput = container.querySelector('input[type="search"]');
    expect(searchInput).toBeTruthy();
    changeInput(searchInput, 'Projeto 2');

    const options = [...container.querySelectorAll('button[data-project-id]')]
      .map((option) => option.textContent || '');
    expect(options).toContain('P2 - Projeto 2');
    expect(options).not.toContain('P1 - Projeto 1');
  });

  it('shows export validation error when empreendimento is not selected', async () => {
    renderView(root);
    await clickByText('Expandir', container);
    await clickByText('Ficha Completa (lote)', container);
    expect(showMock).toHaveBeenCalledWith('Selecione um empreendimento para imprimir fichas.', 'error');
  });

  it('exports report pdf grouped by tower number using selected empreendimento', async () => {
    vi.useFakeTimers();
    const writeMock = vi.fn();
    window.open = vi.fn(() => ({
      document: {
        open: vi.fn(),
        write: writeMock,
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    }));

    renderView(root);
    await selectProject(container, 'P1');
    await clickByText('Expandir', container);
    await clickByText('Exportar PDF', container);

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(writeMock).toHaveBeenCalledTimes(1);
    const html = writeMock.mock.calls[0][0];
    expect(html).toContain('Grupo da torre: Torre 7');
    expect(html.indexOf('Grupo da torre: Torre 7')).toBeLessThan(html.indexOf('Grupo da torre: Torre 10'));
  });

  it('opens Nova Erosao modal without crashing with invalid projects/inspections items', async () => {
    renderView(root, {
      projects: [null, { id: 'P1', nome: 'Projeto 1' }],
      inspections: [undefined, { id: 'VS-1', projetoId: 'P1', dataInicio: '2026-01-10' }],
    });

    await clickByText('Nova Erosao', container);
    expect(container.querySelector('dialog[open], [role="dialog"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Nova Eros/i);
    expect(container.textContent).toContain('Cadastro');
  });

  it('bloqueia salvamento e exibe erro inline quando obrigatorios nao foram preenchidos', async () => {
    renderView(root);

    await clickByText('Nova Erosao', container);
    await clickByText('Salvar', container);

    expect(showMock).toHaveBeenCalledWith('Selecione o empreendimento.', 'error');
    expect(container.textContent).toContain('Selecione o empreendimento.');
  });

  it('salva erosao usando user.nome como updatedBy', async () => {
    renderView(root);

    await clickByText('Nova Erosao', document.body);

    changeInput(document.body.querySelector('#erosion-projeto'), 'P1');
    changeInput(document.body.querySelector('#erosion-torre'), '1');
    changeInput(document.body.querySelector('#erosion-estagio'), 'inicial');
    changeInput(document.body.querySelector('#erosion-dimensionamento'), 'Talude com 8 m de reconformacao.');

    const localSelect = [...document.querySelectorAll('select')]
      .find((element) => [...element.options].some((option) => option.value === 'base_torre'));
    expect(localSelect).toBeTruthy();
    changeInput(localSelect, 'base_torre');

    await clickByText('Salvar', document.body);

    expect(saveErosionMock).toHaveBeenCalledTimes(1);
    expect(saveErosionMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimensionamento: 'Talude com 8 m de reconformacao.' }),
      expect.objectContaining({ updatedBy: 'Tester Nome' }),
    );
  });

  it('opens Editar modal without crashing for incomplete legacy erosion payload', async () => {
    renderView(root, {
      erosions: [
        {
          id: 'ERS-Legado',
          projetoId: 'P1',
          torreRef: '5',
          localContexto: {
            localTipo: 'base_torre',
            exposicao: 'faixa_servidao',
            estruturaProxima: 'torre',
            localDescricao: '',
          },
          status: null,
          impacto: 'Baixo',
          fotosLinks: 'https://example.com/foto.jpg',
          usosSolo: null,
          tiposFeicao: null,
          locationCoordinates: null,
          acompanhamentosResumo: null,
        },
      ],
    });

    await selectProject(container, 'P1');
    await clickByText('Editar', container);

    expect(container.querySelector('dialog[open], [role="dialog"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Editar Eros/i);
    expect(container.textContent).toContain('Salvar');
  });
});
