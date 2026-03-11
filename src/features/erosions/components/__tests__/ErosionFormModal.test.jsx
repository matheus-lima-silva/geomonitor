import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(container.textContent).toContain('Classificação e caracterização da erosão');
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
});
