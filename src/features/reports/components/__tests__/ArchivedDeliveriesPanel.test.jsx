import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/reportArchiveService', () => ({
  listArchives: vi.fn(),
}));

vi.mock('../../../../services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
}));

import ArchivedDeliveriesPanel from '../ArchivedDeliveriesPanel';
import { listArchives } from '../../../../services/reportArchiveService';
import { downloadMediaAsset } from '../../../../services/mediaService';

describe('ArchivedDeliveriesPanel', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    window.HTMLAnchorElement.prototype.click = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('lista entregas do compound e mostra botao entregue habilitado quando ha deliveredMediaId', async () => {
    listArchives.mockResolvedValue([
      {
        id: 'RA-1',
        version: 1,
        compoundId: 'RC-1',
        deliveredAt: '2026-04-17T10:00:00Z',
        deliveredBy: 'user@t',
        generatedMediaId: 'MED-G-1',
        generatedSha256: 'abc1234567890000',
        deliveredMediaId: 'MED-D-1',
        deliveredSha256: 'def9876543210000',
      },
      {
        id: 'RA-2',
        version: 2,
        compoundId: 'RC-1',
        deliveredAt: '2026-04-18T10:00:00Z',
        generatedMediaId: 'MED-G-2',
        generatedSha256: 'ccc',
        deliveredMediaId: null,
      },
    ]);

    await act(async () => {
      root.render(<ArchivedDeliveriesPanel compoundId="RC-1" compoundName="X" showToast={vi.fn()} />);
    });
    // Aguarda o efeito resolver a Promise.
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const rows = container.querySelectorAll('[data-testid^="archive-row-"]');
    expect(rows.length).toBe(2);

    const row1 = container.querySelector('[data-testid="archive-row-RA-1"]');
    expect(row1.textContent).toContain('v1');
    const deliveredBtn1 = container.querySelector('[data-testid="archive-download-delivered-RA-1"]');
    expect(deliveredBtn1.disabled).toBe(false);

    const deliveredBtn2 = container.querySelector('[data-testid="archive-download-delivered-RA-2"]');
    expect(deliveredBtn2.disabled).toBe(true);
  });

  it('dispara download ao clicar em "Entregue"', async () => {
    listArchives.mockResolvedValue([
      {
        id: 'RA-1',
        version: 1,
        compoundId: 'RC-1',
        deliveredAt: '2026-04-17T10:00:00Z',
        generatedMediaId: 'MED-G-1',
        deliveredMediaId: 'MED-D-1',
      },
    ]);
    downloadMediaAsset.mockResolvedValue({ blob: new Blob(['pdf']) });

    await act(async () => {
      root.render(<ArchivedDeliveriesPanel compoundId="RC-1" compoundName="X" showToast={vi.fn()} />);
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const btn = container.querySelector('[data-testid="archive-download-delivered-RA-1"]');
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-D-1');
  });

  it('mostra estado vazio quando nao ha entregas', async () => {
    listArchives.mockResolvedValue([]);
    await act(async () => {
      root.render(<ArchivedDeliveriesPanel compoundId="RC-1" compoundName="X" showToast={vi.fn()} />);
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('Nenhuma entrega registrada');
  });
});
