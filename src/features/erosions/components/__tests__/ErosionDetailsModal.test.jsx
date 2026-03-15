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
      usosSolo: ['pastagem', 'outro'],
      usoSoloOutro: 'acesso rural',
      saturacaoPorAgua: 'nao',
      profundidadeMetros: 1.2,
      declividadeGraus: 18,
      distanciaEstruturaMetros: 7,
      medidaPreventiva: 'Instalar drenagem',
      criticalidadeV2: {
        criticidade_classe: 'Baixo',
        codigo: 'C1',
        criticidade_score: 0,
        pontos: { T: 0, P: 0, D: 0, S: 0, E: 0 },
        tipo_erosao_classe: 'sulco',
        profundidade_classe: '<0.5',
        declividade_classe: '<15',
        solo_classe: 'argiloso',
        exposicao_classe: 'faixa_servidao',
        tipo_medida_recomendada: 'Monitoramento',
        lista_solucoes_sugeridas: ['Cobertura vegetal'],
      },
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
    expect(container.textContent).toContain('Declividade real (graus):');
    expect(container.textContent).toContain('Distancia da estrutura (m):');
    expect(container.textContent).not.toContain('Altura maxima');
    expect(container.textContent).toContain('Presenca de agua no fundo:');
    expect(container.textContent).toContain('ravina, sulco');
    expect(container.textContent).toContain('contato_materiais');
    expect(container.textContent).toContain('pastagem, outro');
    expect(container.textContent).toContain('Uso do solo - outro:');
    expect(container.textContent).toContain('acesso rural');
    expect(container.textContent).toContain('Resumo de criticidade calculada:');
    expect(container.textContent).toContain('Criticidade: Baixo (C1)');
    expect(container.textContent).toContain('Solucoes sugeridas: Cobertura vegetal');
    expect(container.textContent).not.toContain('Intervencao:');
    expect(container.textContent).not.toContain('Criticidade V2');
    expect(container.textContent).not.toContain('Score V2');
  });

  it('uses nested breakdown when criticalidadeV2 was saved in compact format', () => {
    renderModal(root, {
      erosion: {
        id: 'ERS-1',
        projetoId: 'P1',
        torreRef: '12',
        status: 'Ativo',
        impacto: 'Medio',
        vistoriaId: 'VS-1',
        vistoriaIds: ['VS-1'],
        tiposFeicao: ['ravina'],
        caracteristicasFeicao: [],
        usosSolo: [],
        localContexto: {
          localTipo: 'base_torre',
          exposicao: 'faixa_servidao',
          estruturaProxima: 'torre',
          localDescricao: '',
        },
        criticalidadeV2: {
          criticidade_classe: 'Medio',
          codigo: 'C2',
          criticidade_score: 8,
          breakdown: {
            criticidade_classe: 'Medio',
            codigo: 'C2',
            criticidade_score: 8,
            pontos: { T: 2, P: 1, D: 2, S: 1, E: 2 },
            tipo_erosao_classe: 'T2',
            profundidade_classe: 'P1',
            declividade_classe: 'D2',
            solo_classe: 'S2',
            exposicao_classe: 'E2',
            tipo_medida_recomendada: 'Monitoramento',
            lista_solucoes_sugeridas: ['Monitoramento visual'],
          },
        },
        acompanhamentosResumo: [],
        fotosLinks: [],
        locationCoordinates: {},
      },
      hasCoordinates: () => false,
      relatedInspections: [],
    });

    expect(container.textContent).toContain('Criticidade: Medio (C2)');
    expect(container.textContent).toContain('2/1/2/1/2');
    expect(container.textContent).toContain('Classe tipo erosao:');
    expect(container.textContent).toContain('T2');
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

  it('resolves current user email to nome and keeps other persisted users unchanged', () => {
    renderModal(root, {
      erosion: {
        id: 'ERS-3',
        projetoId: 'P1',
        acompanhamentosResumo: [
          {
            timestamp: '2026-03-10T10:00:00.000Z',
            origem: 'manual',
            usuario: 'tester@example.com',
            statusNovo: 'Ativo',
            resumo: 'Evento do utilizador atual',
          },
          {
            timestamp: '2026-03-09T10:00:00.000Z',
            origem: 'manual',
            usuario: 'outra.pessoa@example.com',
            statusNovo: 'Monitoramento',
            resumo: 'Evento de outra pessoa',
          },
        ],
        locationCoordinates: {},
      },
      currentUser: {
        email: 'tester@example.com',
        nome: 'Tester Nome',
      },
      hasCoordinates: () => false,
      relatedInspections: [],
    });

    expect(container.textContent).toContain('Usuario: Tester Nome');
    expect(container.textContent).toContain('Usuario: outra.pessoa@example.com');
    expect(container.textContent).not.toContain('Usuario: tester@example.com');
  });
});
