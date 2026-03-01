import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErosionDetailsModal from '../ErosionDetailsModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderModal(root, overrides = {}) {
  const props = {
    open: true,
    erosion: {
      id: 'ERS-1',
      projetoId: 'P1',
      torreRef: '12',
      status: 'Ativo',
      impacto: 'Medio',
      vistoriaId: 'VS-1',
      vistoriaIds: ['VS-1', 'VS-2'],
      presencaAguaFundo: 'sim',
      tiposFeicao: ['ravina', 'sulco'],
      caracteristicasFeicao: ['contato_materiais'],
      larguraMaximaClasse: '3-5',
      declividadeClassePdf: 'maior_25',
      usosSolo: ['pastagem', 'outro'],
      usoSoloOutro: 'acesso rural',
      saturacaoPorAgua: 'nao',
      medidaPreventiva: 'Instalar drenagem',
      acompanhamentosResumo: [],
      fotosLinks: ['https://example.com/foto-1.jpg'],
      locationCoordinates: {
        latitude: '-21.1',
        longitude: '-42.1',
      },
    },
    project: { id: 'P1', nome: 'Projeto 1' },
    relatedInspections: [{ id: 'VS-1', inspection: { dataInicio: '2026-01-10' } }],
    hasCoordinates: () => true,
    onClose: vi.fn(),
    onOpenMaps: vi.fn(),
    onSaveManualEvent: vi.fn(),
    onExportPdf: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(<ErosionDetailsModal {...props} />);
  });

  return props;
}

describe('ErosionDetailsModal', () => {
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

  it('renders consolidated classification/technical fields without deprecated entries', () => {
    renderModal(root);

    expect(container.textContent).toContain('Classificacao e caracterizacao consolidada');
    expect(container.textContent).toContain('Classe de declividade (graus):');
    expect(container.textContent).toContain('Classe de largura maxima (m):');
    expect(container.textContent).not.toContain('Altura maxima');
    expect(container.textContent).toContain('Presenca de agua no fundo:');
    expect(container.textContent).toContain('ravina, sulco');
    expect(container.textContent).toContain('contato_materiais');
    expect(container.textContent).toContain('pastagem, outro');
    expect(container.textContent).toContain('Uso do solo - outro:');
    expect(container.textContent).toContain('acesso rural');
  });

  it('shows empty history state when no followup data exists', () => {
    renderModal(root, {
      erosion: {
        id: 'ERS-2',
        projetoId: 'P1',
        acompanhamentosResumo: [],
        locationCoordinates: {},
      },
      hasCoordinates: () => false,
      relatedInspections: [],
    });

    expect(container.textContent).toContain('Sem historico de acompanhamento.');
  });
});
