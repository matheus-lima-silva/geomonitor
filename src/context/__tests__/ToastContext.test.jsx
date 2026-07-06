globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, useOptionalToast } from '../ToastContext';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

function Trigger({ message = 'Salvo!', type = 'success' }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, type)}>
      disparar
    </button>
  );
}

describe('ToastContext', () => {
  it('show exibe o toast e o botao Fechar o remove', () => {
    act(() => root.render(
      <ToastProvider>
        <Trigger message="Registro salvo" type="success" />
      </ToastProvider>,
    ));

    expect(container.textContent).not.toContain('Registro salvo');

    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'disparar');
    act(() => btn.click());
    expect(container.textContent).toContain('Registro salvo');

    const closeBtn = container.querySelector('[aria-label="Fechar"]');
    act(() => closeBtn.click());
    expect(container.textContent).not.toContain('Registro salvo');
  });

  it('o toast some sozinho apos a duracao padrao', () => {
    vi.useFakeTimers();
    act(() => root.render(
      <ToastProvider>
        <Trigger message="Efemero" type="info" />
      </ToastProvider>,
    ));
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'disparar');
    act(() => btn.click());
    expect(container.textContent).toContain('Efemero');

    act(() => vi.advanceTimersByTime(3000));
    expect(container.textContent).not.toContain('Efemero');
  });

  it('useToast lanca erro fora do ToastProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let caught = null;
    try {
      act(() => root.render(<Trigger />));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toContain('ToastProvider');
    consoleErrorSpy.mockRestore();
  });

  it('useOptionalToast retorna stub no-op sem provider', () => {
    let received = null;
    function Probe() {
      received = useOptionalToast();
      return null;
    }
    act(() => root.render(<Probe />));
    expect(typeof received.show).toBe('function');
    expect(() => received.show('x', 'info')).not.toThrow();
  });
});
