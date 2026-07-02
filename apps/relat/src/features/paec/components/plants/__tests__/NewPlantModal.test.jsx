import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

vi.mock('@app/services/projectService', () => ({
  listProjects: vi.fn(async () => [{ id: 'P-1', nome: 'LT 500kV Marimbondo', tipo: 'Linha de Transmissão' }]),
}));

import { listProjects } from '@app/services/projectService';
import NewPlantModal from '../NewPlantModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }
  (valueSetter || ((v) => { element.value = v; })).call(element, value);
}

function typeInto(el, value) {
  setNativeValue(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('NewPlantModal', () => {
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
    vi.restoreAllMocks();
  });

  async function render(props = {}) {
    const onCreate = vi.fn(async () => {});
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <ToastProvider>
          <NewPlantModal open onClose={onClose} onCreate={onCreate} existingPlants={[]} {...props} />
        </ToastProvider>,
      );
    });
    // flush da promise de listProjects (popular as opcoes) — dois ticks de
    // microtask (async fn + .then) nao bastam com uma unica act() vazia.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    return { onCreate, onClose };
  }

  it('busca empreendimentos ao abrir', async () => {
    await render();
    expect(listProjects).toHaveBeenCalled();
  });

  it('botao Criar ficha comeca desabilitado sem nome', async () => {
    await render();
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Criar ficha'));
    expect(submitBtn.disabled).toBe(true);
  });

  it('preenche nome/tipo/potencia e cria com o payload esperado', async () => {
    const { onCreate } = await render();
    const dialog = document.querySelector('[role="dialog"]');

    typeInto(dialog.querySelector('#paec-plant-name'), 'PCH Anta');
    typeInto(dialog.querySelector('#paec-plant-type'), 'PCH');
    typeInto(dialog.querySelector('#paec-plant-capacity'), '12.5');

    const submitBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent.includes('Criar ficha'));
    expect(submitBtn.disabled).toBe(false);
    await click(submitBtn);

    expect(onCreate).toHaveBeenCalledWith({
      name: 'PCH Anta',
      plantType: 'PCH',
      installedCapacityMw: 12.5,
      projectId: null,
      copyFromId: undefined,
    });
  });

  it('lista usinas existentes no select de copiar-de', async () => {
    await render({ existingPlants: [{ id: 'PAEC-1', name: 'UHE Marimbondo' }] });
    const dialog = document.querySelector('[role="dialog"]');
    const select = dialog.querySelector('#paec-plant-copy-from');
    expect(Array.from(select.options).map((o) => o.textContent)).toContain('UHE Marimbondo');
  });
});
