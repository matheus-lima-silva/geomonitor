import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/reportArchiveService', () => ({
  listArchives: vi.fn(),
}));

import DeliveryCallout from '../DeliveryCallout';
import { listArchives } from '../../../../services/reportArchiveService';

describe('DeliveryCallout', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('nao renderiza se outputDocxMediaId estiver vazio', async () => {
    listArchives.mockResolvedValue([]);
    await act(async () => {
      root.render(<DeliveryCallout compound={{ id: 'RC-1' }} />);
    });
    expect(container.querySelector('[data-testid="delivery-callout"]')).toBeNull();
  });

  it('renderiza com DOCX pronto e sem entrega arquivada', async () => {
    listArchives.mockResolvedValue([]);
    await act(async () => {
      root.render(
        <DeliveryCallout
          compound={{ id: 'RC-2', outputDocxMediaId: 'MED-1' }}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
        />,
      );
    });
    const callout = container.querySelector('[data-testid="delivery-callout"]');
    expect(callout).not.toBeNull();
    expect(callout.textContent).toContain('Seu relatório foi gerado');
    expect(container.querySelector('[data-testid="delivery-callout-upload"]').textContent)
      .toContain('Enviar versão final');
  });

  it('muda o texto para "Enviar nova versão" se ja ha archive entregue', async () => {
    listArchives.mockResolvedValue([
      { id: 'RA-1', version: 1, deliveredMediaId: 'MED-X', deliveredAt: '2026-04-01' },
    ]);
    await act(async () => {
      root.render(
        <DeliveryCallout
          compound={{ id: 'RC-3', outputDocxMediaId: 'MED-DOCX' }}
          onDownloadDocx={vi.fn()}
          onUploadDelivery={vi.fn()}
        />,
      );
    });
    // aguardar o then do listArchives completar
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[data-testid="delivery-callout-upload"]').textContent)
      .toContain('Enviar nova versão');
  });

  it('aciona onDownloadDocx ao clicar em Baixar', async () => {
    listArchives.mockResolvedValue([]);
    const onDownloadDocx = vi.fn();
    await act(async () => {
      root.render(
        <DeliveryCallout
          compound={{ id: 'RC-4', outputDocxMediaId: 'MED-D' }}
          compoundDownloadFileName="rel.docx"
          onDownloadDocx={onDownloadDocx}
          onUploadDelivery={vi.fn()}
        />,
      );
    });
    act(() => container.querySelector('[data-testid="delivery-callout-download"]').click());
    expect(onDownloadDocx).toHaveBeenCalledWith('MED-D', 'rel.docx');
  });
});
