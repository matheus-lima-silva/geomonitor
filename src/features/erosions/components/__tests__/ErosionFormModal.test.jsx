import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Polyline: () => null,
  Popup: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <div>{children}</div>,
  useMapEvents: () => null,
}));

import ErosionFormModal from '../ErosionFormModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderModal(root, overrides = {}) {
  const props = {
    open: true,
    isEditing: false,
    formData: {
      id: 'ERS-1',
      projetoId: 'P1',
      vistoriaId: '',
      vistoriaIds: [],
      torreRef: '',
      localContexto: {
        localTipo: '',
        exposicao: '',
        estruturaProxima: '',
        localDescricao: '',
      },
      tipo: '',
      estagio: '',
      locationCoordinates: {
        latitude: '',
        longitude: '',
        utmEasting: '',
        utmNorthing: '',
        utmZone: '',
        utmHemisphere: '',
        altitude: '',
        reference: '',
      },
      usosSolo: [],
      usoSoloOutro: '',
      fotosLinks: [],
      status: 'Ativo',
      obs: '',
    },
    setFormData: vi.fn(),
    projects: [{ id: 'P1' }],
    inspections: [],
    criticality: {
      impacto: 'Baixo',
      score: 1,
      frequencia: '24 meses',
      intervencao: 'Monitoramento visual',
    },
    validationErrors: {},
    onCancel: vi.fn(),
    onSave: vi.fn(),
    utmErrorToken: 0,
    ...overrides,
  };

  act(() => {
    root.render(<ErosionFormModal {...props} />);
  });

  return props;
}

describe('ErosionFormModal', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('renderiza secoes tecnicas e bloco de criticidade sem campos legados', () => {
    renderModal(root);

    expect(container.textContent).toContain('Grau erosivo e caracterização técnica');
    expect(container.textContent).toContain('Resumo de criticidade calculada');
    expect(container.textContent).toContain('Usos do solo');
    expect(container.textContent).not.toContain('Uso do solo (legado)');
  });

  it('inicia localizacao recolhida quando bloco esta vazio', () => {
    renderModal(root);

    expect(container.textContent).toContain('Nao preenchido');
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeNull();
  });

  it('inicia localizacao expandida quando ha valores', () => {
    renderModal(root, {
      formData: {
        id: 'ERS-1',
        projetoId: 'P1',
        locationCoordinates: {
          latitude: '-21.1',
          longitude: '-42.1',
        },
      },
    });

    expect(container.textContent).toContain('Decimal');
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeTruthy();
  });

  it('expande localizacao quando token de erro UTM muda', () => {
    renderModal(root, { utmErrorToken: 0 });
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeNull();

    renderModal(root, { utmErrorToken: 1 });
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeTruthy();
  });

  it('mostra campo usoSoloOutro quando usosSolo contem outro', () => {
    renderModal(root, {
      formData: {
        id: 'ERS-1',
        projetoId: 'P1',
        locationCoordinates: {},
        usosSolo: ['outro'],
      },
    });

    expect(container.textContent).toContain('Uso do solo - outro *');
  });

  it('ativa modo historico quando status e Estabilizado', () => {
    renderModal(root, {
      formData: {
        id: 'ERS-1',
        projetoId: 'P1',
        status: 'Estabilizado',
        locationCoordinates: {},
      },
    });

    expect(container.textContent).toContain('Registro histórico de acompanhamento');
    expect(container.textContent).toContain('Intervenção já realizada / contexto histórico *');
  });

  it('exibe erros inline recebidos do salvamento', () => {
    renderModal(root, {
      validationErrors: {
        projetoId: 'Selecione o empreendimento.',
      },
    });

    expect(container.textContent).toContain('Selecione o empreendimento.');
  });

  it('nao quebra quando formData e nulo', () => {
    renderModal(root, { formData: null });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain('Cadastro');
  });

  it('nao quebra quando projects contem itens nulos', () => {
    renderModal(root, {
      projects: [null, { id: 'P1', nome: 'Projeto 1' }],
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('option[value="P1"]')).toBeTruthy();
  });

  it('nao quebra quando inspections contem itens undefined', () => {
    renderModal(root, {
      formData: {
        id: 'ERS-1',
        projetoId: 'P1',
        locationCoordinates: {},
      },
      inspections: [undefined, { id: 'VS-1', projetoId: 'P1' }],
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('option[value="VS-1"]')).toBeTruthy();
  });

  it('usa torresCoordenadas do projeto para montar a selecao de torres', () => {
    renderModal(root, {
      projects: [{
        id: 'P1',
        torres: '',
        torresCoordenadas: [
          { numero: '0' },
          { numero: '10' },
          { numero: '2' },
          { numero: '163A' },
        ],
      }],
    });

    const options = [...container.querySelectorAll('#erosion-torre option')].map((option) => option.value);

    expect(options).toEqual(['', '0', '2', '10', '163A']);
  });

  it('navega entre as etapas do wizard (indicador + Avancar)', () => {
    const wrapperOf = (text) => {
      const heading = [...container.querySelectorAll('section h4')].find((h) => (h.textContent || '').includes(text));
      return heading ? heading.closest('section').parentElement : null;
    };
    renderModal(root);

    expect(wrapperOf('Cadastro').hasAttribute('hidden')).toBe(false);
    expect(wrapperOf('Grau erosivo').hasAttribute('hidden')).toBe(true);

    const avancar = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Avancar'));
    act(() => { avancar.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(wrapperOf('Cadastro').hasAttribute('hidden')).toBe(true);
    expect(wrapperOf('Grau erosivo').hasAttribute('hidden')).toBe(false);

    const localizacaoStep = [...container.querySelectorAll('ol button')].find((b) => (b.textContent || '').includes('Localizacao'));
    act(() => { localizacaoStep.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(wrapperOf('Localização geográfica').hasAttribute('hidden')).toBe(false);
  });

  it('bloqueia double-submit: Salvar dispara onSave uma vez e desabilita enquanto em voo', async () => {
    let resolveSave;
    const onSave = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderModal(root, { onSave });

    const salvar = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Salvar'));
    expect(salvar).toBeTruthy();

    // Primeiro clique: onSave fica pendente, botao deve travar.
    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(salvar.disabled).toBe(true);
    expect(salvar.textContent).toContain('Salvando');

    // Segundo clique enquanto a primeira chamada ainda esta em voo: ignorado.
    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    // Ao concluir, o botao volta a ficar habilitado.
    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
    const salvarFinal = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Salvar'));
    expect(salvarFinal.disabled).toBe(false);
  });
});
