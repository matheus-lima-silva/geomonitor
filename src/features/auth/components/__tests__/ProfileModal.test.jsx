import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

// ProfileModal consome useAuth/useToast (contexto) + userService. Em vez de
// montar os Providers, mockamos os hooks e os servicos — ver
// memory/feedback_react_hooks_testing.md.
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'u1',
      email: 'ana@example.com',
      nome: 'Ana',
      perfil: 'Utilizador',
      status: 'Ativo',
    },
    refreshProfile: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../../../../services/userService', () => ({
  saveUser: vi.fn(() => Promise.resolve()),
  listProfissoes: vi.fn(() => Promise.resolve([])),
  listSignatarios: vi.fn(() => Promise.resolve([])),
  createSignatario: vi.fn(() => Promise.resolve()),
  updateSignatario: vi.fn(() => Promise.resolve()),
  deleteSignatario: vi.fn(() => Promise.resolve()),
}));

import ProfileModal from '../ProfileModal';
import { saveUser } from '../../../../services/userService';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findSalvar(container) {
  return [...container.querySelectorAll('button')].find((b) => /Salv/.test(b.textContent || ''));
}

describe('ProfileModal double-submit', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveUser.mockReset();
    saveUser.mockResolvedValue(undefined);
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

  it('Salvar dispara saveUser uma vez e desabilita botoes enquanto em voo', async () => {
    let resolveSave;
    saveUser.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));

    await act(async () => {
      root.render(<ProfileModal onClose={vi.fn()} />);
    });

    const salvar = findSalvar(container);
    expect(salvar).toBeTruthy();
    expect(salvar.textContent).toContain('Salvar Alteracoes');
    expect(salvar.disabled).toBe(false);

    // Primeiro clique: saveUser fica pendente, botoes devem travar.
    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(saveUser).toHaveBeenCalledTimes(1);

    const salvarPendente = findSalvar(container);
    expect(salvarPendente.disabled).toBe(true);
    expect(salvarPendente.textContent).toContain('Salvando');
    const cancelar = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Cancelar'));
    expect(cancelar.disabled).toBe(true);

    // Segundo clique em voo: ignorado.
    await act(async () => {
      salvarPendente.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(saveUser).toHaveBeenCalledTimes(1);

    // Conclusao reabilita os botoes.
    await act(async () => {
      resolveSave();
      await Promise.resolve();
      await Promise.resolve();
    });
    const salvarFinal = findSalvar(container);
    expect(salvarFinal.disabled).toBe(false);
  });

  it('salva e fecha em sucesso, chamando saveUser e onClose uma vez', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(<ProfileModal onClose={onClose} />);
    });

    await act(async () => {
      findSalvar(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveUser).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
