import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';
import GenerateResultModal from '../GenerateResultModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('GenerateResultModal', () => {
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

  async function render(result, extraProps = {}) {
    const onClose = vi.fn();
    const onDownload = vi.fn(async () => {});
    await act(async () => {
      root.render(
        <ToastProvider>
          <GenerateResultModal result={result} onClose={onClose} onDownload={onDownload} {...extraProps} />
        </ToastProvider>,
      );
    });
    return { onClose, onDownload };
  }

  it('nao renderiza nada quando result e null', async () => {
    await render(null);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('mensagem de sucesso sem pendencias', async () => {
    await render({ mediaId: 'M-1', pendencies: [], stats: null });
    expect(container.textContent).toContain('sem pendências');
    expect(container.textContent).not.toContain('destacado');
  });

  it('lista as pendencias quando houver', async () => {
    await render({ mediaId: 'M-1', pendencies: [{ key: 'cnpj_1', label: 'CNPJ' }, { key: 'brigadistas', label: 'Relação de brigadistas' }] });
    expect(container.textContent).toContain('2 itens ficaram');
    expect(container.textContent).toContain('CNPJ');
    expect(container.textContent).toContain('Relação de brigadistas');
  });

  it('Baixar .docx chama onDownload', async () => {
    const { onDownload } = await render({ mediaId: 'M-1', pendencies: [] });
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Baixar .docx'));
    await click(button);
    expect(onDownload).toHaveBeenCalled();
  });

  it('Fechar chama onClose', async () => {
    const { onClose } = await render({ mediaId: 'M-1', pendencies: [] });
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Fechar');
    await click(button);
    expect(onClose).toHaveBeenCalled();
  });
});
