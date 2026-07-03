import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PlantCard from '../PlantCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('PlantCard', () => {
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

  async function render(plant, onOpen = vi.fn()) {
    await act(async () => {
      root.render(<PlantCard plant={plant} onOpen={onOpen} />);
    });
    return onOpen;
  }

  it('mostra badge de pendencias e barra de completude proporcional', async () => {
    await render({
      id: 'PAEC-1',
      name: 'PCH Anta',
      plantType: 'PCH',
      completeness: { fieldsFilled: 60, fieldsTotal: 80 },
      templateRevisionLabel: 'REV 10',
    });
    expect(container.textContent).toContain('PCH Anta');
    expect(container.textContent).toContain('PCH');
    expect(container.textContent).toContain('20 pendências');
    expect(container.textContent).toContain('60 / 80 campos preenchidos');
    expect(container.textContent).toContain('Modelo: REV 10');
    const fill = container.querySelector('.bg-brand-600.rounded-full');
    expect(fill.style.width).toBe('75%');
  });

  it('mostra badge Completo quando fieldsFilled >= fieldsTotal', async () => {
    await render({ id: 'PAEC-2', name: 'UHE Marimbondo', completeness: { fieldsFilled: 83, fieldsTotal: 83 } });
    expect(container.textContent).toContain('Completo');
    expect(container.textContent).not.toContain('pendências');
  });

  it('mostra potencia instalada quando presente', async () => {
    await render({ id: 'PAEC-3', name: 'PCH Anta', installedCapacityMw: 12.5, completeness: { fieldsFilled: 0, fieldsTotal: 10 } });
    expect(container.textContent).toContain('12.5 MW instalados');
  });

  it('chama onOpen(plant.id) ao clicar em Abrir ficha', async () => {
    const onOpen = await render({ id: 'PAEC-1', name: 'PCH Anta', completeness: { fieldsFilled: 0, fieldsTotal: 10 } });
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Abrir ficha'));
    await click(button);
    expect(onOpen).toHaveBeenCalledWith('PAEC-1');
  });

  it('mostra badge de revisao nova quando templateOutdated', async () => {
    await render({
      id: 'PAEC-4', name: 'PCH Anta', templateRevisionLabel: 'REV 10',
      templateOutdated: true, completeness: { fieldsFilled: 0, fieldsTotal: 10 },
    });
    expect(container.textContent).toContain('revisão nova disponível');
  });

  it('sem templateOutdated nao mostra o badge de revisao', async () => {
    await render({
      id: 'PAEC-5', name: 'PCH Anta', templateRevisionLabel: 'REV 10',
      completeness: { fieldsFilled: 0, fieldsTotal: 10 },
    });
    expect(container.textContent).not.toContain('revisão nova disponível');
  });
});
