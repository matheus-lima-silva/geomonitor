globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showMock = vi.fn();
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ show: showMock }),
}));
vi.mock('../../services/authService', () => ({
  confirmResetPassword: vi.fn(),
}));

import { confirmResetPassword } from '../../services/authService';
import ResetPasswordConfirmView from '../ResetPasswordConfirmView';

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
});

function setInput(placeholder, value) {
  const input = [...container.querySelectorAll('input')]
    .find((el) => el.placeholder === placeholder);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submit() {
  const form = container.querySelector('form');
  act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

async function submitAsync() {
  const form = container.querySelector('form');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function render(props = {}) {
  act(() => root.render(<ResetPasswordConfirmView token="tok-123" onDone={vi.fn()} {...props} />));
}

describe('ResetPasswordConfirmView', () => {
  it('rejeita senha curta sem chamar o servico', () => {
    render();
    setInput('Digite a nova senha', 'Ab1');
    setInput('Confirme a nova senha', 'Ab1');
    submit();
    expect(container.textContent).toContain('pelo menos 8 caracteres');
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it('rejeita senha sem maiuscula/minuscula/numero', () => {
    render();
    setInput('Digite a nova senha', 'abcdefgh');
    setInput('Confirme a nova senha', 'abcdefgh');
    submit();
    expect(container.textContent).toContain('maiuscula, minuscula e numero');
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it('rejeita quando as senhas nao coincidem', () => {
    render();
    setInput('Digite a nova senha', 'Abcdef12');
    setInput('Confirme a nova senha', 'Abcdef99');
    submit();
    expect(container.textContent).toContain('nao coincidem');
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it('redefine a senha e notifica sucesso', async () => {
    confirmResetPassword.mockResolvedValue(undefined);
    render();
    setInput('Digite a nova senha', 'Abcdef12');
    setInput('Confirme a nova senha', 'Abcdef12');
    await submitAsync();

    expect(confirmResetPassword).toHaveBeenCalledWith('tok-123', 'Abcdef12');
    expect(container.textContent).toContain('Senha redefinida com sucesso');
    expect(showMock).toHaveBeenCalledWith('Senha redefinida com sucesso!', 'success');
  });

  it('mostra o erro do servico e notifica falha', async () => {
    confirmResetPassword.mockRejectedValue(new Error('Link expirado'));
    render();
    setInput('Digite a nova senha', 'Abcdef12');
    setInput('Confirme a nova senha', 'Abcdef12');
    await submitAsync();

    expect(container.textContent).toContain('Link expirado');
    expect(showMock).toHaveBeenCalledWith('Link expirado', 'error');
  });

  it('chama onDone ao voltar para login', () => {
    const onDone = vi.fn();
    render({ onDone });
    const backBtn = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Voltar para login'));
    act(() => backBtn.click());
    expect(onDone).toHaveBeenCalled();
  });
});
