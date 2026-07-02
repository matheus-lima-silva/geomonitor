import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

vi.mock('../../../services/paecService', () => ({
  fetchPlants: vi.fn(),
  createPlant: vi.fn(),
}));

vi.mock('@app/services/projectService', () => ({
  listProjects: vi.fn(async () => []),
}));

import { fetchPlants, createPlant } from '../../../services/paecService';
import PlantListView from '../PlantListView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('PlantListView', () => {
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

  async function render(onOpenPlant = vi.fn(), onExit) {
    await act(async () => {
      root.render(
        <ToastProvider>
          <PlantListView onOpenPlant={onOpenPlant} onExit={onExit} />
        </ToastProvider>,
      );
    });
    return onOpenPlant;
  }

  it('nao mostra o breadcrumb quando onExit nao e passado', async () => {
    fetchPlants.mockResolvedValueOnce([]);
    await render();
    expect(container.textContent).not.toContain('portal relat');
  });

  it('breadcrumb "portal relat" chama onExit', async () => {
    fetchPlants.mockResolvedValueOnce([]);
    const onExit = vi.fn();
    await render(vi.fn(), onExit);
    const back = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('portal relat'));
    await click(back);
    expect(onExit).toHaveBeenCalled();
  });

  it('mostra estado vazio quando nao ha usinas', async () => {
    fetchPlants.mockResolvedValueOnce([]);
    await render();
    expect(container.textContent).toContain('Nenhuma usina cadastrada ainda');
  });

  it('lista as usinas retornadas com o modelo institucional no subtitulo', async () => {
    fetchPlants.mockResolvedValueOnce([
      { id: 'PAEC-1', name: 'UHE Marimbondo', templateRevisionLabel: 'REV 10', completeness: { fieldsFilled: 83, fieldsTotal: 83 } },
      { id: 'PAEC-2', name: 'PCH Anta', templateRevisionLabel: 'REV 10', completeness: { fieldsFilled: 5, fieldsTotal: 83 } },
    ]);
    await render();
    expect(container.textContent).toContain('UHE Marimbondo');
    expect(container.textContent).toContain('PCH Anta');
    expect(container.textContent).toContain('Modelo institucional: REV 10');
  });

  it('abrir o modal e criar navega direto para a ficha criada', async () => {
    fetchPlants.mockResolvedValueOnce([]);
    const onOpenPlant = await render();

    const newBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Nova usina'));
    await click(newBtn);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); // flush listProjects

    const dialog = document.querySelector('[role="dialog"]');
    const nameInput = dialog.querySelector('#paec-plant-name');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(nameInput), 'value').set;
    setter.call(nameInput, 'PCH Anta');
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    createPlant.mockResolvedValueOnce({ id: 'PAEC-9', name: 'PCH Anta' });
    const submitBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent.includes('Criar ficha'));
    await click(submitBtn);

    expect(createPlant).toHaveBeenCalled();
    expect(onOpenPlant).toHaveBeenCalledWith('PAEC-9');
  });
});
