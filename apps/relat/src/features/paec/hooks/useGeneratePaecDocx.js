// Fluxo "Gerar PAEC": flush do autosave -> POST /generate -> polling do
// report_job ate completed/failed. Diferente do monthly-report, o download
// NAO e automatico: o job concluido guarda pendencias/mediaId em `result`
// para o modal de resultado decidir quando baixar (ver GenerateResultModal).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@app/context/ToastContext';
import { downloadMediaAsset } from '@app/services/mediaService';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';
import { generatePaec, getJobStatus } from '../services/paecService';

export const POLL_INTERVAL_MS = 4000;
export const MAX_POLL_ATTEMPTS = 30; // ~2 minutos

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildDownloadFileName(plant) {
  const slug = String(plant?.name || 'usina').trim().replace(/\s+/g, '-');
  return `PAEC_${slug}.docx`;
}

export function useGeneratePaecDocx({ plant, flush }) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null); // { mediaId, pendencies, stats } | null
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  const generate = useCallback(async () => {
    if (!plant || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      await flush(); // garante que o worker rendere o estado mais recente

      const job = await generatePaec(plant.id);
      const jobId = job?.id;
      if (!jobId) throw new Error('A geração não retornou um job válido.');

      let finalStatus = null;
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;
        const status = await getJobStatus(jobId);
        const exec = String(status?.statusExecucao || '').toLowerCase();
        if (exec === 'completed' || exec === 'complete') {
          finalStatus = status;
          break;
        }
        if (exec === 'failed' || exec === 'error') {
          throw new Error(status?.errorLog || 'Erro na geração do documento.');
        }
      }
      if (!finalStatus) throw new Error('A geração demorou demais. Tente novamente em instantes.');

      if (cancelledRef.current) return;
      setResult({
        mediaId: finalStatus.outputDocxMediaId,
        pendencies: finalStatus?.resultMeta?.pendencies || [],
        stats: finalStatus?.resultMeta?.stats || null,
      });
    } catch (err) {
      if (!cancelledRef.current) {
        toast.show(err?.message || 'Erro ao gerar o documento.', 'error');
      }
    } finally {
      if (!cancelledRef.current) setGenerating(false);
    }
  }, [plant, generating, flush, toast]);

  const download = useCallback(async () => {
    if (!result?.mediaId) return;
    const { blob } = await downloadMediaAsset(result.mediaId);
    triggerBlobDownload(buildDownloadFileName(plant), blob);
  }, [result, plant]);

  const clearResult = useCallback(() => setResult(null), []);

  return { generating, generate, result, download, clearResult };
}
