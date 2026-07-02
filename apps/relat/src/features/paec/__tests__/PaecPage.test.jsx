import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

vi.mock('../services/paecService', () => ({
  fetchPlants: vi.fn(async () => [{ id: 'PAEC-1', name: 'PCH Anta', completeness: { fieldsFilled: 1, fieldsTotal: 2 } }]),
  createPlant: vi.fn(),
  fetchPlant: vi.fn(async () => ({ id: 'PAEC-1', name: 'PCH Anta', templateId: 'PAECT-1', version: 1, fields: {}, pendencies: [], stats: {} })),
  fetchTemplate: vi.fn(async () => ({ id: 'PAECT-1', manifest: { fields: [], blocks: [] } })),
}));

vi.mock('@app/services/projectService', () => ({ listProjects: vi.fn(async () => []) }));

import PaecPage from '../PaecPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('PaecPage', () => {
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
    vi.clearAllMocks();
  });

  it('comeca na lista de usinas e navega para a ficha ao abrir uma usina', async () => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <PaecPage onExit={vi.fn()} />
        </ToastProvider>,
      );
    });

    expect(container.textContent).toContain('PCH Anta');
    expect(container.querySelector('[aria-label="Voltar à lista de usinas"]')).toBeNull();

    const openBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Abrir ficha'));
    await click(openBtn);
    await act(async () => {}); // flush fetchPlant/fetchTemplate

    expect(container.querySelector('[aria-label="Voltar à lista de usinas"]')).not.toBeNull();
  });

  it('voltar da ficha retorna para a lista (nao para o hub)', async () => {
    const onExit = vi.fn();
    await act(async () => {
      root.render(
        <ToastProvider>
          <PaecPage onExit={onExit} />
        </ToastProvider>,
      );
    });
    const openBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Abrir ficha'));
    await click(openBtn);
    await act(async () => {});

    const backBtn = container.querySelector('[aria-label="Voltar à lista de usinas"]');
    await click(backBtn);

    expect(onExit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Nova usina');
  });
});
