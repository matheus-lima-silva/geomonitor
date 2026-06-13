// Fluxo "Gerar .docx": flush do autosave -> POST /generate -> polling do
// report_job ate completed/failed -> download do DOCX via media access URL.
// Mesmo padrao do geo (ErosionsView + mediaService + triggerBlobDownload).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@app/context/ToastContext';
import { downloadMediaAsset } from '@app/services/mediaService';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';
import { generateDocx, getJobStatus } from '../services/monthlyReportService';
import { MONTHS } from '../utils/constants';

export const POLL_INTERVAL_MS = 4000;
export const MAX_POLL_ATTEMPTS = 30; // ~2 minutos

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildDownloadFileName(report) {
  return `Relatório Mensal de Acompanhamento dos Serviços - ${MONTHS[report.refMonth].toUpperCase()} ${report.refYear}.docx`;
}

export function useGenerateDocx({ report, flush }) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  const generate = useCallback(async () => {
    if (!report || generating) return;
    setGenerating(true);
    try {
      await flush(); // garante que o worker rendere o estado mais recente

      const job = await generateDocx(report.id);
      const jobId = job?.id;
      if (!jobId) throw new Error('A geração não retornou um job válido.');

      let mediaId = null;
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;
        const status = await getJobStatus(jobId);
        const exec = String(status?.statusExecucao || '').toLowerCase();
        if (exec === 'completed' || exec === 'complete') {
          mediaId = status?.outputDocxMediaId;
          break;
        }
        if (exec === 'failed' || exec === 'error') {
          throw new Error(status?.errorLog || 'Erro na geração do documento.');
        }
      }
      if (!mediaId) throw new Error('A geração demorou demais. Tente novamente em instantes.');

      const { blob } = await downloadMediaAsset(mediaId);
      if (cancelledRef.current) return;
      triggerBlobDownload(buildDownloadFileName(report), blob);
      toast.show('Documento gerado com sucesso!', 'success');
    } catch (err) {
      if (!cancelledRef.current) {
        toast.show(err?.message || 'Erro ao gerar o documento.', 'error');
      }
    } finally {
      if (!cancelledRef.current) setGenerating(false);
    }
  }, [report, generating, flush, toast]);

  return { generating, generate };
}
