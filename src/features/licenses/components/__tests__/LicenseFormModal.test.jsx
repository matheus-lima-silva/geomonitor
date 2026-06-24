import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import { LicenseFormModal } from '../LicensesView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderModal(root, overrides = {}) {
  const props = {
    open: true,
    isEditing: false,
    formData: { esfera: 'Federal', cobertura: [] },
    setFormData: vi.fn(),
    projects: [],
    agencyOptions: [],
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onConditionsChange: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(<LicenseFormModal {...props} />);
  });

  return props;
}

function findSalvar(container) {
  return [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Salvar'));
}

describe('LicenseFormModal double-submit', () => {
  let container;
  let root;

  beforeEach(() => {
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

  it('Salvar dispara onSave uma vez e desabilita enquanto em voo', async () => {
    let resolveSave;
    const onSave = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderModal(root, { onSave });

    const salvar = findSalvar(container);
    expect(salvar).toBeTruthy();
    expect(salvar.disabled).toBe(false);

    // Primeiro clique: onSave fica pendente, botao deve travar.
    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(salvar.disabled).toBe(true);
    expect(salvar.textContent).toContain('Salvando');

    // Segundo clique enquanto a primeira chamada ainda esta em voo: ignorado.
    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    // Ao concluir, o botao volta a ficar habilitado.
    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
    const salvarFinal = findSalvar(container);
    expect(salvarFinal.disabled).toBe(false);
    expect(salvarFinal.textContent).toContain('Salvar');
  });

  it('desabilita Cancelar enquanto salva', async () => {
    let resolveSave;
    const onSave = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderModal(root, { onSave });

    const cancelar = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Cancelar'));
    expect(cancelar.disabled).toBe(false);

    await act(async () => {
      findSalvar(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(cancelar.disabled).toBe(true);

    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
    expect(cancelar.disabled).toBe(false);
  });
});
