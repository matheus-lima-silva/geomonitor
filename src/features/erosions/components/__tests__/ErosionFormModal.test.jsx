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
      localTipo: '',
      localDescricao: '',
      tipo: '',
      estagio: '',
      profundidade: '',
      declividade: '',
      largura: '',
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

  it('renders single consolidated technical section without duplicated topics', () => {
    renderModal(root);

    expect(container.textContent).toContain('Classificacao e caracterizacao da erosao');
    expect(container.textContent).toContain('Presenca de agua no fundo');
    expect(container.textContent).toContain('Classe tecnica de declividade (graus)');
    expect(container.textContent).toContain('Classe tecnica de largura maxima (m)');
    expect(container.textContent).not.toContain('PDF');
    expect(container.textContent).not.toContain('Uso do solo (legado)');
    expect(container.textContent).not.toContain('Caracteristicas fisicas');
    expect(container.textContent).toContain('Usos do solo');
  });

  it('starts coordinates collapsed when block is empty', () => {
    renderModal(root);

    expect(container.textContent).toContain('Nao preenchido');
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeNull();
  });

  it('starts coordinates expanded when block has values', () => {
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

  it('auto-expands coordinates when utm validation token changes', () => {
    renderModal(root, { utmErrorToken: 0 });
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeNull();

    renderModal(root, { utmErrorToken: 1 });
    expect(container.querySelector('input[placeholder="-22.951958"]')).toBeTruthy();
  });

  it('shows usoSoloOutro input when usosSolo contains outro', () => {
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

  it('does not crash when formData is null', () => {
    renderModal(root, { formData: null });
    expect(container.querySelector('.erosions-form-modal')).toBeTruthy();
    expect(container.textContent).toContain('Cadastro');
  });

  it('does not crash when projects contains null items', () => {
    renderModal(root, {
      projects: [null, { id: 'P1', nome: 'Projeto 1' }],
    });
    expect(container.querySelector('.erosions-form-modal')).toBeTruthy();
    expect(container.querySelector('option[value="P1"]')).toBeTruthy();
  });

  it('does not crash when inspections contains undefined items', () => {
    renderModal(root, {
      formData: {
        id: 'ERS-1',
        projetoId: 'P1',
        locationCoordinates: {},
      },
      inspections: [undefined, { id: 'VS-1', projetoId: 'P1' }],
    });
    expect(container.querySelector('.erosions-form-modal')).toBeTruthy();
    expect(container.querySelector('option[value="VS-1"]')).toBeTruthy();
  });
});
