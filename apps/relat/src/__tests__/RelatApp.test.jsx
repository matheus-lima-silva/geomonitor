import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@app/context/AuthContext';
import { ToastProvider } from '@app/context/ToastContext';
import RelatApp from '../RelatApp';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RelatApp', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    localStorage.clear();
  });

  it('renderiza a tela de login quando nao ha sessao armazenada', async () => {
    await act(async () => {
      root.render(
        <AuthProvider>
          <ToastProvider>
            <RelatApp />
          </ToastProvider>
        </AuthProvider>,
      );
    });

    expect(container.querySelector('#relat-login-email')).toBeTruthy();
    expect(container.querySelector('#relat-login-password')).toBeTruthy();
    expect(container.textContent).toContain('Entrar');
    expect(container.textContent).toContain('Portal de Relatorios');
  });
});
