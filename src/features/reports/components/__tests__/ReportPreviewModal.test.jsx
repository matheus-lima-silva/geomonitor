import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
}));

import ReportPreviewModal from '../ReportPreviewModal';
import { renderAsync } from 'docx-preview';
import { downloadMediaAsset } from '../../../../services/mediaService';

const flush = async () => {
  // A cadeia do efeito tem varios awaits sequenciais (download -> render -> fonts).
  for (let i = 0; i < 6; i += 1) {
    await act(async () => { await Promise.resolve(); });
  }
};

describe('ReportPreviewModal', () => {
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

  it('nao renderiza nada quando fechado', async () => {
    await act(async () => {
      root.render(<ReportPreviewModal open={false} mediaId="MED-1" onClose={vi.fn()} />);
    });
    expect(document.querySelector('[data-testid="report-preview-canvas"]')).toBeNull();
    expect(downloadMediaAsset).not.toHaveBeenCalled();
  });

  it('busca o blob e renderiza o DOCX ao abrir', async () => {
    const blob = new Blob(['docx']);
    downloadMediaAsset.mockResolvedValue({ blob });

    await act(async () => {
      root.render(<ReportPreviewModal open mediaId="MED-1" fileName="rel.docx" onClose={vi.fn()} showToast={vi.fn()} />);
    });
    await flush();

    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-1');
    expect(renderAsync).toHaveBeenCalledTimes(1);
    expect(renderAsync.mock.calls[0][0]).toBe(blob);
    // estado pronto: aviso de previa aparece
    expect(container.textContent).toContain('Prévia para revisão');
  });

  it('dispara onDownload com (mediaId, fileName) ao clicar em Baixar DOCX', async () => {
    downloadMediaAsset.mockResolvedValue({ blob: new Blob(['docx']) });
    const onDownload = vi.fn();

    await act(async () => {
      root.render(
        <ReportPreviewModal open mediaId="MED-9" fileName="rel.docx" onClose={vi.fn()} onDownload={onDownload} showToast={vi.fn()} />,
      );
    });
    await flush();

    act(() => document.querySelector('[data-testid="report-preview-download"]').click());
    expect(onDownload).toHaveBeenCalledWith('MED-9', 'rel.docx');
  });

  it('mostra erro e nao faz retry infinito quando o download falha', async () => {
    downloadMediaAsset.mockRejectedValue(new Error('falha de previa'));
    const showToast = vi.fn();

    await act(async () => {
      root.render(<ReportPreviewModal open mediaId="MED-ERR" onClose={vi.fn()} showToast={showToast} />);
    });
    await flush();

    expect(downloadMediaAsset).toHaveBeenCalledTimes(1);
    expect(renderAsync).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="report-preview-error"]')).not.toBeNull();
    expect(container.textContent).toContain('falha de previa');
    expect(showToast).toHaveBeenCalledWith('falha de previa', 'error');
  });
});
