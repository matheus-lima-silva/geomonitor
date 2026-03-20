import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsView from '../ProjectsView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let hookState;

function createHookState() {
  return {
    isFormOpen: false,
    formData: {},
    setFormData: vi.fn(),
    isEditing: false,
    confirmDelete: null,
    setConfirmDelete: vi.fn(),
    kmlReviewOpen: false,
    kmlReviewMode: 'merge',
    kmlRows: [],
    setKmlRows: vi.fn(),
    kmlImportErrors: [],
    createFromKmlData: {
      id: '',
      nome: '',
      tipo: 'Linha de Transmissao',
      tensao: '',
      extensao: '',
      torres: '',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [],
      anoBaseBienal: '',
    },
    setCreateFromKmlData: vi.fn(),
    kmlMeta: {},
    kmlMergeSnapshot: {},
    applyKmlMetadataOnMerge: false,
    setApplyKmlMetadataOnMerge: vi.fn(),
    routeModalProject: null,
    setRouteModalProject: vi.fn(),
    routeSelection: [],
    setRouteSelection: vi.fn(),
    reviewedKml: { rows: [], hasErrors: false },
    openNew: vi.fn(),
    openEdit: vi.fn(),
    closeForm: vi.fn(),
    handleSave: vi.fn(),
    handleDelete: vi.fn(),
    parseKmlFile: vi.fn(),
    applyKmlToForm: vi.fn(),
    createProjectFromKml: vi.fn(),
    closeKmlReview: vi.fn(),
    kmlLinePickerOpen: false,
    kmlDetectedLines: [],
    selectKmlLine: vi.fn(),
    closeKmlLinePicker: vi.fn(),
    batchCreateFromKml: vi.fn(),
    batchCreating: false,
    kmlPendingMode: 'create',
  };
}

vi.mock('../../hooks/useProjectsFeatureState', () => ({
  useProjectsFeatureState: () => hookState,
}));

function renderView(root, overrides = {}) {
  const props = {
    projects: [],
    inspections: [],
    operatingLicenses: [],
    userEmail: 'tester@example.com',
    showToast: vi.fn(),
    reloadProjects: vi.fn(),
    onOpenProjectInspections: vi.fn(),
    searchTerm: '',
    ...overrides,
  };

  act(() => {
    root.render(<ProjectsView {...props} />);
  });

  return props;
}

describe('ProjectsView', () => {
  let container;
  let root;

  beforeEach(() => {
    hookState = createHookState();
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

  it('renders project metadata chips and biennial schedule row', () => {
    renderView(root, {
      projects: [
        {
          id: 'P1',
          nome: 'Linha Norte',
          tipo: 'Linha de Transmissao',
          tensao: '230',
          extensao: '12.3',
          dataCadastro: '2026-01-10',
          periodicidadeRelatorio: 'Bienal',
          mesesEntregaRelatorio: [3],
          anoBaseBienal: 2024,
          torresCoordenadas: [{ numero: '1', latitude: '-21.1', longitude: '-42.1' }],
          linhaCoordenadas: [],
        },
      ],
    });

    expect(container.textContent).toContain('Codigo: P1');
    expect(container.textContent).toContain('2026-01-10');
    expect(container.textContent).toContain('Linha de Transmissao');
    expect(container.textContent).toContain('230 kV');
    expect(container.textContent).toContain('12.3 km');
    expect(container.textContent).toContain('Ano base (bienal):');
    expect(container.textContent).toContain('2024');
  });

  it('shows route action and hides import action when project has KML towers', () => {
    renderView(root, {
      projects: [
        {
          id: 'P-KML',
          nome: 'Com KML',
          tipo: 'Linha de Transmissao',
          torresCoordenadas: [{ numero: '1', latitude: '-21.1', longitude: '-42.1' }],
          linhaCoordenadas: [],
        },
      ],
    });

    expect(container.textContent).toContain('Tracar rota');
    expect(container.textContent).not.toContain('Importar KML neste empreendimento');
  });

  it('shows import action and hides route action when project has no KML towers', () => {
    renderView(root, {
      projects: [
        {
          id: 'P-NOKML',
          nome: 'Sem KML',
          tipo: 'Linha de Transmissao',
          torresCoordenadas: [],
          linhaCoordenadas: [],
        },
      ],
    });

    expect(container.textContent).toContain('Importar KML neste empreendimento');
    expect(container.textContent).not.toContain('Tracar rota');
  });

  it('shows export button when project has exportable geometry', () => {
    renderView(root, {
      projects: [
        {
          id: 'P-EXP',
          nome: 'Exportavel',
          tipo: 'Linha de Transmissao',
          torresCoordenadas: [],
          linhaCoordenadas: [{ latitude: '-21', longitude: '-42' }, { latitude: '-22', longitude: '-43' }],
        },
      ],
    });

    expect(container.textContent).toContain('Exportar KML');
  });

  it('shows empty state when search does not match any project', () => {
    renderView(root, {
      projects: [
        {
          id: 'P1',
          nome: 'Linha Norte',
          tipo: 'Linha de Transmissao',
          torresCoordenadas: [],
          linhaCoordenadas: [],
        },
      ],
      searchTerm: 'nao-encontra',
    });

    expect(container.textContent).toContain('Nenhum empreendimento encontrado.');
  });
});
