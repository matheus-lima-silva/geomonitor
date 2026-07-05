globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/authService', () => ({
  loadProfile: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock('../../hooks/useLocalStorageDraft', () => ({ clearAllDrafts: vi.fn() }));
vi.mock('../../utils/serviceFactory', () => ({ clearAllServiceCaches: vi.fn() }));
vi.mock('../../utils/tokenStorage', () => ({
  hasStoredSession: vi.fn(() => false),
  refreshAccessToken: vi.fn(),
  clearTokens: vi.fn(),
}));

import {
  loadProfile, login as doLogin, logout as doLogout, resetPassword as doResetPassword,
} from '../../services/authService';
import { clearAllDrafts } from '../../hooks/useLocalStorageDraft';
import { clearAllServiceCaches } from '../../utils/serviceFactory';
import { hasStoredSession, refreshAccessToken } from '../../utils/tokenStorage';
import { AuthProvider, useAuth, useOptionalAuth } from '../AuthContext';

let container = null;
let root = null;
let auth = null;

function Capture() {
  auth = useAuth();
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  auth = null;
  hasStoredSession.mockReturnValue(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('sem sessao armazenada, encerra o loading sem usuario', async () => {
    await act(async () => {
      root.render(<AuthProvider><Capture /></AuthProvider>);
    });
    await flush();
    expect(hasStoredSession).toHaveBeenCalled();
    expect(auth.loading).toBe(false);
    expect(auth.user).toBeNull();
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('restaura a sessao quando ha token e perfil validos', async () => {
    hasStoredSession.mockReturnValue(true);
    refreshAccessToken.mockResolvedValue('tok-1');
    loadProfile.mockResolvedValue({ email: 'a@b.com', perfil: 'Admin' });

    await act(async () => {
      root.render(<AuthProvider><Capture /></AuthProvider>);
    });
    await flush();

    expect(auth.user).toEqual({ email: 'a@b.com', perfil: 'Admin' });
    expect(auth.loading).toBe(false);
  });

  it('login popula o usuario a partir do authService', async () => {
    doLogin.mockResolvedValue({ email: 'user@ex.com', perfil: 'Editor' });
    await act(async () => {
      root.render(<AuthProvider><Capture /></AuthProvider>);
    });
    await flush();

    await act(async () => { await auth.login('user@ex.com', 'senha'); });
    expect(doLogin).toHaveBeenCalledWith('user@ex.com', 'senha');
    expect(auth.user).toEqual({ email: 'user@ex.com', perfil: 'Editor' });
  });

  it('logout limpa usuario, drafts e caches de servico', async () => {
    hasStoredSession.mockReturnValue(true);
    refreshAccessToken.mockResolvedValue('tok-1');
    loadProfile.mockResolvedValue({ email: 'a@b.com' });
    doLogout.mockResolvedValue(undefined);

    await act(async () => {
      root.render(<AuthProvider><Capture /></AuthProvider>);
    });
    await flush();
    expect(auth.user).not.toBeNull();

    await act(async () => { await auth.logout(); });
    expect(doLogout).toHaveBeenCalled();
    expect(clearAllDrafts).toHaveBeenCalled();
    expect(clearAllServiceCaches).toHaveBeenCalled();
    expect(auth.user).toBeNull();
  });

  it('resetPassword delega ao authService', async () => {
    doResetPassword.mockResolvedValue(undefined);
    await act(async () => {
      root.render(<AuthProvider><Capture /></AuthProvider>);
    });
    await flush();
    await act(async () => { await auth.resetPassword('a@b.com'); });
    expect(doResetPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('useAuth lanca fora do AuthProvider e useOptionalAuth retorna null', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let caught = null;
    try {
      act(() => root.render(<Capture />));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toContain('AuthProvider');
    consoleErrorSpy.mockRestore();

    let optional = 'sentinel';
    function OptProbe() {
      optional = useOptionalAuth();
      return null;
    }
    act(() => root.render(<OptProbe />));
    expect(optional).toBeNull();
  });
});
