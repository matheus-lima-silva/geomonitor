import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

// Isola a logica de montagem do KMZ e o download — aqui testamos so a fiacao
// da pagina (selecao -> habilita -> gera -> baixa). safeFileName e usado pelo
// hook, entao precisa existir no mock do modulo.
vi.mock('../utils/kmzBuilder', () => ({
  buildKmz: vi.fn(async () => ({
    blob: new Blob(['kmz'], { type: 'application/vnd.google-earth.kmz' }),
    markerCount: 2,
    skipped: ['semgps.jpg'],
  })),
  safeFileName: (name, fallback) => (String(name || '').replace(/[^\w.\-]+/g, '_') || fallback),
}));

vi.mock('@app/features/reports/utils/reportUtils', () => ({
  triggerBlobDownload: vi.fn(() => true),
}));

import GeoPhotosKmzPage from '../GeoPhotosKmzPage';
import { buildKmz } from '../utils/kmzBuilder';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('GeoPhotosKmzPage', () => {
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

  async function render(props = {}) {
    const onExit = vi.fn();
    await act(async () => {
      root.render(
        <ToastProvider>
          <GeoPhotosKmzPage onExit={onExit} {...props} />
        </ToastProvider>,
      );
    });
    return { onExit };
  }

  function generateButton() {
    return Array.from(container.querySelectorAll('button')).find((b) => /Gerar KMZ/.test(b.textContent));
  }

  async function selectFiles(files) {
    const input = container.querySelector('#geo-kmz-files');
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function flush() {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }

  it('inicia com o botao Gerar desabilitado', async () => {
    await render();
    expect(generateButton().disabled).toBe(true);
    expect(container.textContent).toContain('Nenhuma foto selecionada');
  });

  it('habilita o botao e mostra a contagem ao selecionar fotos', async () => {
    await render();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'torre-1.jpg', { type: 'image/jpeg' });
    await selectFiles([file]);

    expect(generateButton().disabled).toBe(false);
    expect(container.textContent).toContain('1 foto(s) selecionada(s)');
  });

  it('gera o KMZ e dispara o download', async () => {
    await render();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'torre-1.jpg', { type: 'image/jpeg' });
    await selectFiles([file]);

    await act(async () => {
      generateButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(buildKmz).toHaveBeenCalledTimes(1);
    expect(triggerBlobDownload).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Último KMZ gerado');
    expect(container.textContent).toContain('semgps.jpg');
  });

  it('voltar chama onExit', async () => {
    const { onExit } = await render();
    const back = container.querySelector('[aria-label="Voltar ao portal"]');
    await act(async () => {
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
