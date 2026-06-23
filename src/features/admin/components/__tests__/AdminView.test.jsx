import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', email: 'admin@test.local' } }),
}));
vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ show: vi.fn() }),
}));
vi.mock('../../../../services/userService', () => ({
  deleteUser: vi.fn(),
  saveUser: vi.fn(),
  sendUserResetEmail: vi.fn(),
}));
vi.mock('../../../../services/rulesService', () => ({
  saveRulesConfig: vi.fn(),
}));

// Isola as seções pesadas — aqui validamos o rail, o badge de pendências e a troca de seção.
vi.mock('../SignaturesSection', () => ({ default: () => null }));
vi.mock('../WorkspacesAccessSection', () => ({ default: () => null }));
vi.mock('../UsageStatsSection', () => ({ default: () => null }));
vi.mock('../SqlExecutorPanel', () => ({ default: () => null }));
vi.mock('../FeriadosSection', () => ({ default: () => null }));

const USERS = [
  { id: 'u1', nome: 'Ana', email: 'ana@test.local', cargo: 'Tecnica', perfil: 'Utilizador', status: 'Pendente' },
  { id: 'u2', nome: 'Bruno', email: 'bruno@test.local', cargo: 'Gestor', perfil: 'Gerente', status: 'Ativo' },
];

describe('AdminView', () => {
  let container;
  let root;
  let AdminView;

  beforeEach(async () => {
    ({ default: AdminView } = await import('../AdminView'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  function render() {
    act(() => {
      root.render(<AdminView users={USERS} rulesConfig={{}} searchTerm="" />);
    });
  }

  it('agrupa as seções num rail lateral', () => {
    render();
    const nav = container.querySelector('nav[aria-label="Secoes do gerenciamento"]');
    expect(nav).toBeTruthy();
    ['Pessoas e acesso', 'Regras do sistema', 'Sistema'].forEach((group) => {
      expect(nav.textContent).toContain(group);
    });
  });

  it('mostra o badge e o banner de aprovações pendentes', () => {
    render();
    const nav = container.querySelector('nav[aria-label="Secoes do gerenciamento"]');
    // Badge no item Utilizadores (1 pendente)
    expect(nav.textContent).toContain('1');
    // Banner na seção Utilizadores (default)
    expect(container.textContent).toContain('1 utilizador aguardando aprovacao.');
  });

  it('troca para Criticidade e renderiza o editor estruturado', () => {
    render();
    const critButton = [...container.querySelectorAll('nav button')]
      .find((button) => /Criticidade/.test(button.textContent || ''));
    expect(critButton).toBeTruthy();
    act(() => { critButton.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(container.textContent).toContain('Faixas de classificacao (C1-C4)');
    expect(container.textContent).toContain('Pontos por fator');
  });
});
