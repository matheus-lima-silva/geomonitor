import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

vi.mock('../../services/monthlyReportService', () => ({
  generateDocx: vi.fn(),
  getJobStatus: vi.fn(),
}));

vi.mock('@app/services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
}));

vi.mock('@app/features/reports/utils/reportUtils', () => ({
  triggerBlobDownload: vi.fn(),
}));

import { generateDocx, getJobStatus } from '../../services/monthlyReportService';
import { downloadMediaAsset } from '@app/services/mediaService';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';
import { useGenerateDocx, buildDownloadFileName, POLL_INTERVAL_MS } from '../useGenerateDocx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REPORT = { id: 'MR-1', refYear: 2026, refMonth: 4, version: 3 };

function Probe({ api, report = REPORT, flush }) {
  const hook = useGenerateDocx({ report, flush });
  api.current = hook;
  return <span data-generating={String(hook.generating)} />;
}

describe('buildDownloadFileName', () => {
  it('usa o nome institucional com mes/ano', () => {
    expect(buildDownloadFileName(REPORT)).toBe('Relatório Mensal de Acompanhamento dos Serviços - MAIO 2026.docx');
  });
});

describe('useGenerateDocx', () => {
  let container;
  let root;
  let api;
  let flush;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = { current: null };
    flush = vi.fn(async () => {});
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderProbe() {
    await act(async () => {
      root.render(
        <ToastProvider>
          <Probe api={api} flush={flush} />
        </ToastProvider>,
      );
    });
  }

  it('fluxo completo: flush -> generate -> poll -> download', async () => {
    generateDocx.mockResolvedValueOnce({ id: 'JOB-1', statusExecucao: 'queued' });
    getJobStatus
      .mockResolvedValueOnce({ statusExecucao: 'processing' })
      .mockResolvedValueOnce({ statusExecucao: 'completed', outputDocxMediaId: 'MEDIA-9' });
    const blob = new Blob(['docx']);
    downloadMediaAsset.mockResolvedValueOnce({ blob });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {}); // flush + generate
    expect(flush).toHaveBeenCalled();
    expect(generateDocx).toHaveBeenCalledWith('MR-1');
    expect(api.current.generating).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    expect(getJobStatus).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(downloadMediaAsset).toHaveBeenCalledWith('MEDIA-9');
    expect(triggerBlobDownload).toHaveBeenCalledWith(
      'Relatório Mensal de Acompanhamento dos Serviços - MAIO 2026.docx',
      blob,
    );
    expect(api.current.generating).toBe(false);
    expect(document.body.textContent).toContain('Documento gerado com sucesso!');
  });

  it('job failed mostra o erro e libera o botao', async () => {
    generateDocx.mockResolvedValueOnce({ id: 'JOB-1' });
    getJobStatus.mockResolvedValueOnce({ statusExecucao: 'failed', errorLog: 'Renderer quebrou.' });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(triggerBlobDownload).not.toHaveBeenCalled();
    expect(api.current.generating).toBe(false);
    expect(document.body.textContent).toContain('Renderer quebrou.');
  });

  it('erro no generate nao inicia polling', async () => {
    generateDocx.mockRejectedValueOnce(new Error('Sem permissão.'));

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => { await promise; });

    expect(getJobStatus).not.toHaveBeenCalled();
    expect(api.current.generating).toBe(false);
    expect(document.body.textContent).toContain('Sem permissão.');
  });
});
