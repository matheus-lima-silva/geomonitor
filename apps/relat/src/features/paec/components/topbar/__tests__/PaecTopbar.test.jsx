import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PaecTopbar from '../PaecTopbar';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('PaecTopbar', () => {
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
    const onBack = vi.fn();
    const onGenerate = vi.fn();
    const onTogglePendencies = vi.fn();
    await act(async () => {
      root.render(
        <PaecTopbar
          plantName="PCH Anta"
          revisionLabel="REV 10"
          saveStatus="idle"
          onBack={onBack}
          pendencyCount={3}
          onTogglePendencies={onTogglePendencies}
          onGenerate={onGenerate}
          {...props}
        />,
      );
    });
    return { onBack, onGenerate, onTogglePendencies };
  }

  it('mostra nome, revisao e contador de pendencias', async () => {
    await render();
    expect(container.textContent).toContain('PCH Anta');
    expect(container.textContent).toContain('REV 10');
    expect(container.textContent).toContain('Pendências (3)');
  });

  it('voltar chama onBack', async () => {
    const { onBack } = await render();
    await click(document.querySelector('[aria-label="Voltar à lista de usinas"]'));
    expect(onBack).toHaveBeenCalled();
  });

  it('Gerar PAEC fica desabilitado durante geracao ou conflito', async () => {
    await render({ generating: true });
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Gerando'));
    expect(button.disabled).toBe(true);
  });

  it('mostra o estado "Salvo" do SaveStatus', async () => {
    await render({ saveStatus: 'saved' });
    const status = container.querySelector('[data-testid="save-status"]');
    expect(status.textContent).toBe('Salvo');
  });
});
