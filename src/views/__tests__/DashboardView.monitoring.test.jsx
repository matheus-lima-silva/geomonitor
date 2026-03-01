import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../DashboardView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const logoutMock = vi.fn();
const showMock = vi.fn();

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
    return () => {};
  },
}));

vi.mock('../../services/inspectionService', () => ({
  subscribeInspections: (onData) => {
    onData([{ id: 'V1' }]);
    return () => {};
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
      },
    ]);
    return () => {};
  },
}));

vi.mock('../../services/licenseService', () => ({
  subscribeOperatingLicenses: (onData) => {
    onData([]);
    return () => {};
  },
}));

vi.mock('../../services/userService', () => ({
  subscribeUsers: () => () => {},
}));

vi.mock('../../services/rulesService', () => ({
  subscribeRulesConfig: () => () => {},
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

    const projectTab = [...container.querySelectorAll('.side-nav-link')]
      .find((button) => button.textContent.includes('Empreendimentos'));
    expect(projectTab).toBeTruthy();

    await act(async () => {
      projectTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('.monitor-topbar-alert-trigger')).toBeNull();
  });

  it('expands and collapses monthly delivery details when clicking a month row', async () => {
    await act(async () => {
      root.render(<DashboardView />);
      await Promise.resolve();
    });

    const monthButton = container.querySelector('.monitor-month-button');
    expect(monthButton).toBeTruthy();
    expect(monthButton.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      monthButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const expandedButton = container.querySelector('.monitor-month-button');
    expect(expandedButton.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.monitor-month-details')).toBeTruthy();
    expect(container.textContent).toContain('P1 - Projeto 1');
    expect(container.textContent).toContain('Empreendimento vinculado');

    await act(async () => {
      expandedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const collapsedButton = container.querySelector('.monitor-month-button');
    expect(collapsedButton.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.monitor-month-details')).toBeNull();
  });
});
