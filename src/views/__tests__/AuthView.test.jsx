import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthView from '../AuthView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

function clickButtonByText(container, text) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (el) => el.textContent.trim() === text,
  );
  if (!button) throw new Error(`Botão "${text}" não encontrado`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('AuthView accents', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<AuthView />);
    });
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

  it('renders the accented brand tagline on login', () => {
    expect(container.textContent).toContain('Acesso seguro e rápido');
  });

  it('renders accented strength-meter labels in register mode', () => {
    clickButtonByText(container, 'Criar conta');
    expect(container.textContent).toContain('A conta será criada como pendente até aprovação do administrador.');
    expect(container.textContent).toContain('Força');
    expect(container.textContent).toContain('Maiúscula');
    expect(container.textContent).toContain('Minúscula');
    expect(container.textContent).toContain('Número');
  });

  it('renders the accented reset-mode hint', () => {
    clickButtonByText(container, 'Recuperar');
    expect(container.textContent).toContain('Informe o email para receber o link de redefinição.');
  });
});
