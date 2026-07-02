import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@app/context/ToastContext';

vi.mock('../../services/paecService', () => ({
  generatePaec: vi.fn(),
  getJobStatus: vi.fn(),
}));

vi.mock('@app/services/mediaService', () => ({
  downloadMediaAsset: vi.fn(),
}));

vi.mock('@app/features/reports/utils/reportUtils', () => ({
  triggerBlobDownload: vi.fn(),
}));

import { generatePaec, getJobStatus } from '../../services/paecService';
import { downloadMediaAsset } from '@app/services/mediaService';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';
import { useGeneratePaecDocx, buildDownloadFileName, POLL_INTERVAL_MS } from '../useGeneratePaecDocx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PLANT = { id: 'PAEC-1', name: 'PCH Anta', version: 1 };

function Probe({ api, plant = PLANT, flush }) {
  const hook = useGeneratePaecDocx({ plant, flush });
  api.current = hook;
  return <span data-generating={String(hook.generating)} />;
}

describe('buildDownloadFileName', () => {
  it('usa o nome da usina sem espacos', () => {
    expect(buildDownloadFileName(PLANT)).toBe('PAEC_PCH-Anta.docx');
  });
});

describe('useGeneratePaecDocx', () => {
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

  it('fluxo completo: flush -> generate -> poll -> guarda resultado sem baixar automaticamente', async () => {
    generatePaec.mockResolvedValueOnce({ id: 'JOB-1', statusExecucao: 'queued' });
    getJobStatus
      .mockResolvedValueOnce({ statusExecucao: 'processing' })
      .mockResolvedValueOnce({
        statusExecucao: 'completed',
        outputDocxMediaId: 'MEDIA-9',
        resultMeta: { pendencies: [{ kind: 'field', key: 'cnpj_1', label: 'CNPJ' }], stats: { fieldsFilled: 1, fieldsTotal: 2 } },
      });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {});
    expect(flush).toHaveBeenCalled();
    expect(generatePaec).toHaveBeenCalledWith('PAEC-1');
    expect(api.current.generating).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    expect(getJobStatus).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(downloadMediaAsset).not.toHaveBeenCalled();
    expect(api.current.generating).toBe(false);
    expect(api.current.result).toEqual({
      mediaId: 'MEDIA-9',
      pendencies: [{ kind: 'field', key: 'cnpj_1', label: 'CNPJ' }],
      stats: { fieldsFilled: 1, fieldsTotal: 2 },
    });
  });

  it('download() baixa o mediaId do resultado guardado', async () => {
    generatePaec.mockResolvedValueOnce({ id: 'JOB-1' });
    getJobStatus.mockResolvedValueOnce({ statusExecucao: 'completed', outputDocxMediaId: 'MEDIA-9', resultMeta: { pendencies: [], stats: null } });
    const blob = new Blob(['docx']);
    downloadMediaAsset.mockResolvedValueOnce({ blob });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    await act(async () => { await api.current.download(); });
    expect(downloadMediaAsset).toHaveBeenCalledWith('MEDIA-9');
    expect(triggerBlobDownload).toHaveBeenCalledWith('PAEC_PCH-Anta.docx', blob);
  });

  it('clearResult limpa o resultado (fecha o modal)', async () => {
    generatePaec.mockResolvedValueOnce({ id: 'JOB-1' });
    getJobStatus.mockResolvedValueOnce({ statusExecucao: 'completed', outputDocxMediaId: 'MEDIA-9', resultMeta: {} });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(api.current.result).not.toBeNull();
    act(() => { api.current.clearResult(); });
    expect(api.current.result).toBeNull();
  });

  it('job failed mostra o erro e libera o botao sem guardar resultado', async () => {
    generatePaec.mockResolvedValueOnce({ id: 'JOB-1' });
    getJobStatus.mockResolvedValueOnce({ statusExecucao: 'failed', errorLog: 'Renderer quebrou.' });

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10); });
    await act(async () => { await promise; });

    expect(api.current.result).toBeNull();
    expect(api.current.generating).toBe(false);
    expect(document.body.textContent).toContain('Renderer quebrou.');
  });

  it('erro no generate nao inicia polling', async () => {
    generatePaec.mockRejectedValueOnce(new Error('Sem permissão.'));

    await renderProbe();
    let promise;
    act(() => { promise = api.current.generate(); });
    await act(async () => { await promise; });

    expect(getJobStatus).not.toHaveBeenCalled();
    expect(api.current.generating).toBe(false);
    expect(document.body.textContent).toContain('Sem permissão.');
  });
});
