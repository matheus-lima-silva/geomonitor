import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import ProjectFormModal from '../ProjectFormModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderModal(root, overrides = {}) {
  const props = {
    open: true,
    isEditing: false,
    formData: {
      nome: 'Projeto X',
      tipo: '',
      mesesEntregaRelatorio: [],
      torresCoordenadas: [],
      periodicidadeRelatorio: '',
    },
    setFormData: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onImportKml: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(<ProjectFormModal {...props} />);
  });

  return props;
}

describe('ProjectFormModal double-submit', () => {
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

    const salvar = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Salvar'));
    expect(salvar).toBeTruthy();

    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(salvar.disabled).toBe(true);
    expect(salvar.textContent).toContain('Salvando');

    await act(async () => {
      salvar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
    const salvarFinal = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Salvar'));
    expect(salvarFinal.disabled).toBe(false);
  });
});
