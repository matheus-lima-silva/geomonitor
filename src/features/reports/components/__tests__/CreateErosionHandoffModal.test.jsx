import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreateErosionHandoffModal from '../CreateErosionHandoffModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

function mount(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(ui); });
}

afterEach(() => {
  act(() => { root?.unmount(); });
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

function findButtonByText(text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

function baseProps(overrides = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    projectId: 'LT-FINCO',
    towerRef: '606',
    coordsLabel: '-23.879014 -46.531110',
    photoId: 'RPH-2',
    ...overrides,
  };
}

describe('CreateErosionHandoffModal', () => {
  it('mostra o contexto read-only da foto/torre', () => {
    mount(<CreateErosionHandoffModal {...baseProps()} />);
    expect(container.textContent).toContain('Criar erosão');
    expect(container.textContent).toContain('LT-FINCO');
    expect(container.textContent).toContain('606');
    expect(container.textContent).toContain('RPH-2');
  });

  it('confirma e cancela', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    mount(<CreateErosionHandoffModal {...baseProps({ onConfirm, onClose })} />);
    act(() => findButtonByText('Abrir formulário de erosão').click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => findButtonByText('Cancelar').click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nao renderiza quando fechado', () => {
    mount(<CreateErosionHandoffModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe('');
  });
});
