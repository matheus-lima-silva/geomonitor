import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../DashboardView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const logoutMock = vi.fn();
const showMock = vi.fn();

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Bar: ({ children }) => <div>{children}</div>,
  Cell: () => null,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  LayersControl: Object.assign(
    ({ children }) => <div>{children}</div>,
    {
      BaseLayer: ({ children, name }) => <div data-layer-name={name}>{children}</div>,
    },
  ),
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      nome: 'Usuário Teste',
      email: 'teste@exemplo.com',
      role: 'user',
      perfil: 'Utilizador',
      status: 'Ativo',
      perfilAtualizadoPrimeiroLogin: true,
      cargo: 'Analista',
      departamento: 'Campo',
      telefone: '9999-9999',
    },
    logout: logoutMock,
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    show: showMock,
  }),
}));

vi.mock('../../services/projectService', () => ({
  subscribeProjects: (onData) => {
    onData([
      {
        id: 'P1',
        nome: 'Projeto 1',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [2],
      },
    ]);
    return () => { };
  },
}));

vi.mock('../../services/inspectionService', () => ({
  subscribeInspections: (onData) => {
    onData([{ id: 'V1' }]);
    return () => { };
  },
}));

vi.mock('../../services/erosionService', () => ({
  subscribeErosions: (onData) => {
    onData([
      {
        id: 'ER-1',
        projetoId: 'P1',
        impacto: 'Alto',
        torreRef: '1',
        ultimaAtualizacao: '2026-01-20T00:00:00.000Z',
        acompanhamentosResumo: [
          {
            tipoEvento: 'obra',
            obraEtapa: 'Em andamento',
            descricao: 'Execucao de drenagem',
            timestamp: '2026-01-22T10:00:00.000Z',
          },
        ],
      },
    ]);
    return () => { };
  },
}));

vi.mock('../../services/licenseService', () => ({
  subscribeOperatingLicenses: (onData) => {
    onData([]);
    return () => { };
  },
}));

vi.mock('../../services/reportDeliveryTrackingService', () => ({
  subscribeReportDeliveryTracking: (onData) => {
    onData([]);
    return () => { };
  },
}));

vi.mock('../../services/userService', () => ({
  subscribeUsers: () => () => { },
}));

vi.mock('../../services/rulesService', () => ({
  subscribeRulesConfig: () => () => { },
}));

vi.mock('../../features/projects/components/ProjectsView', () => ({
  default: () => <div>Projects View</div>,
}));

vi.mock('../../features/licenses/components/LicensesView', () => ({
  default: () => <div>Licenses View</div>,
}));

vi.mock('../../features/inspections/components/InspectionsView', () => ({
  default: () => <div>Inspections View</div>,
}));

vi.mock('../../features/erosions/components/ErosionsView', () => ({
  default: () => <div>Erosions View</div>,
}));

vi.mock('../../features/inspections/components/VisitPlanningView', () => ({
  default: () => <div>Visit Planning View</div>,
}));

vi.mock('../../features/admin/components/AdminView', () => ({
  default: () => <div>Admin View</div>,
}));

vi.mock('../../features/auth/components/MandatoryProfileUpdateView', () => ({
  default: () => <div>Mandatory Profile Update</div>,
}));

vi.mock('../../features/auth/components/ProfileModal', () => ({
  default: () => <div>Profile Modal</div>,
}));

describe('DashboardView monitoring top notice', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
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
    vi.useRealTimers();
  });

  it('shows the planning top notice in dashboard and hides it in non-dashboard tabs', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    expect(container.querySelector('.monitor-topbar-alert-trigger')).toBeTruthy();

    const projectTab = [...container.querySelectorAll('button')]
      .find((button) => {
        const label = button.getAttribute('aria-label') || '';
        const title = button.title || '';
        return label.includes('Empreendimentos') || button.textContent.includes('Empreendimentos') || title.includes('Empreendimentos');
      });
    expect(projectTab).toBeTruthy();

    await act(async () => {
      projectTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('.monitor-topbar-alert-trigger')).toBeNull();
  });

  it('shows due days, deadline status and operational status in the upcoming reports card', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Prazo');
    expect(container.textContent).toContain('Status prazo');
    expect(container.textContent).toContain('Status op.');
    expect(container.textContent).toContain('dia(s)');
    expect(container.textContent).toContain('Em acompanhamento');
    expect(container.textContent).toContain('iniciado');
  });

  it('shows active work tracking card with project and ongoing stage', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Acompanhamento de Obras');
    expect(container.textContent).toContain('ER-1');
    expect(container.textContent).toContain('P1 - Projeto 1');
    expect(container.textContent).toContain('Em andamento');
  });

  it('expands LO/project aggregated row in upcoming reports card', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    const expandButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Projetos ('));
    expect(expandButton).toBeTruthy();

    await act(async () => {
      expandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Origem');
    expect(container.textContent).toContain('Override');
  });

  it('expands and collapses monthly delivery details when clicking a month row', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    const monthButton = container.querySelector('button[aria-controls^="monitor-month-details"]');
    expect(monthButton).toBeTruthy();
    expect(monthButton.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      monthButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const expandedButton = container.querySelector('button[aria-controls^="monitor-month-details"]');
    expect(expandedButton.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('div[id^="monitor-month-details"]')).toBeTruthy();
    expect(container.textContent).toContain('P1 - Projeto 1');
    expect(container.textContent).toContain('Empreendimento vinculado');
    expect(container.textContent).toContain('Prazo:');
    expect(container.textContent).toContain('Status prazo:');
    expect(container.textContent).toContain('Status operacional:');
    expect(container.textContent).toContain('Em acompanhamento');

    await act(async () => {
      expandedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const collapsedButton = container.querySelector('button[aria-controls^="monitor-month-details"]');
    expect(collapsedButton.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('div[id^="monitor-month-details"]')).toBeNull();
  });

  it('shows default and relief base layers in the dashboard map', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-layer-name="Mapa padrão"]')).toBeTruthy();
    expect(container.querySelector('[data-layer-name="Relevo"]')).toBeTruthy();
  });
});
