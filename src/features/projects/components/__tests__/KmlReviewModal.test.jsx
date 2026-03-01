import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import KmlReviewModal from '../KmlReviewModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderModal(root, overrides = {}) {
  const props = {
    open: true,
    mode: 'merge',
    reviewedKml: { rows: [], hasErrors: false },
    importErrors: [],
    createFromKmlData: {
      id: 'P1',
      nome: 'Projeto 1',
      tipo: 'Linha de Transmissao',
      tensao: '',
      extensao: '',
      torres: '',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [],
      anoBaseBienal: '',
    },
    setCreateFromKmlData: vi.fn(),
    kmlMeta: {
      sigla: 'SIG',
      nome: 'Nome KML',
      linhaNome: 'Linha KML',
      extensao: '10.2',
      torres: 2,
    },
    kmlMergeSnapshot: {
      id: 'P1',
      nome: 'Projeto Atual',
      extensao: '8.7',
      torres: '30',
    },
    applyKmlMetadataOnMerge: false,
    setApplyKmlMetadataOnMerge: vi.fn(),
    setKmlRows: vi.fn(),
    onCancel: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(<KmlReviewModal {...props} />);
  });

  return props;
}

describe('KmlReviewModal', () => {
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

  it('shows merge metadata comparison panel', () => {
    renderModal(root, { mode: 'merge' });

    expect(container.textContent).toContain('Comparacao de metadados do KML');
    expect(container.textContent).toContain('ID atual:');
    expect(container.textContent).toContain('Sigla KML (sugerida):');
    expect(container.textContent).toContain('Aplicar metadados do KML (nome, extensao e torres)');
  });

  it('shows create mode fields and biennial controls', () => {
    renderModal(root, {
      mode: 'create',
      createFromKmlData: {
        id: 'P2',
        nome: 'Projeto 2',
        tipo: 'Linha de Transmissao',
        tensao: '230',
        extensao: '15',
        torres: '20',
        periodicidadeRelatorio: 'Bienal',
        mesesEntregaRelatorio: [2],
        anoBaseBienal: '2026',
      },
      reviewedKml: {
        rows: [
          { key: '1', numero: '1', latitude: '-21.1', longitude: '-42.1', sourceName: 'T1', error: '' },
          { key: '2', numero: '2', latitude: 'abc', longitude: '-42.2', sourceName: 'T2', error: 'Latitude invalida' },
        ],
        hasErrors: true,
      },
    });

    expect(container.textContent).toContain('ID *');
    expect(container.textContent).toContain('Nome *');
    expect(container.textContent).toContain('Periodicidade');
    expect(container.textContent).toContain('Meses de entrega');
    expect(container.textContent).toContain('Ano base (bienal)');
  });

  it('shows empty-row message when there are no KML rows', () => {
    renderModal(root, {
      mode: 'create',
      reviewedKml: { rows: [], hasErrors: false },
    });

    expect(container.textContent).toContain('Nenhum ponto no KML.');
  });

  it('shows summary with valid and invalid counts', () => {
    renderModal(root, {
      mode: 'create',
      reviewedKml: {
        rows: [
          { key: '1', numero: '1', latitude: '-21.1', longitude: '-42.1', sourceName: 'T1', error: '' },
          { key: '2', numero: '2', latitude: '-21.2', longitude: '-42.2', sourceName: 'T2', error: 'Duplicada' },
          { key: '3', numero: '3', latitude: '-21.3', longitude: '-42.3', sourceName: 'T3', error: '' },
        ],
        hasErrors: true,
      },
    });

    expect(container.textContent).toContain('Validas:');
    expect(container.textContent).toContain('Com erro:');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('1');
  });
});
