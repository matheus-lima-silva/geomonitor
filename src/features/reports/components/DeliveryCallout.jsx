import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import { listArchives } from '../../../services/reportArchiveService';
import { fmt } from '../utils/reportUtils';

// Mostrado quando o DOCX gerado esta pronto. Ponto de entrada principal para:
//   1. baixar o DOCX gerado pelo sistema
//   2. enviar a versao final (assinada/revisada) para arquivamento imutavel
// Substitui a antiga barra de 5 botoes outline no rodape do card.
export default function DeliveryCallout({
  compound,
  compoundDownloadFileName,
  onDownloadDocx,
  onUploadDelivery,
  onRegenerate,
  busy = null,
  refreshToken = 0,
  showToast = () => {},
}) {
  const [latestArchive, setLatestArchive] = useState(null);
  const [totalArchives, setTotalArchives] = useState(0);

  useEffect(() => {
    if (!compound?.id || !compound?.outputDocxMediaId) {
      setLatestArchive(null);
      setTotalArchives(0);
      return undefined;
    }
    let cancelled = false;
    listArchives(compound.id)
      .then((items) => {
        if (cancelled) return;
        const list = Array.isArray(items) ? items : [];
        setTotalArchives(list.length);
        const sorted = [...list].sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0));
        setLatestArchive(sorted[0] || null);
      })
      .catch((error) => {
        if (!cancelled) showToast(error?.message || 'Erro ao carregar entregas.', 'error');
      });
    return () => { cancelled = true; };
  }, [compound?.id, compound?.outputDocxMediaId, refreshToken, showToast]);

  if (!compound?.outputDocxMediaId) return null;

  const hasDelivered = Boolean(latestArchive?.deliveredMediaId);
  const mediaId = compound.outputDocxMediaId;
  const downloadBusy = busy === `download:${mediaId}`;
  const regenBusy = busy === `compound-generate:${compound.id}`;

  return (
    <div
      className="rounded-xl border border-success-border bg-success-light p-4"
      data-testid="delivery-callout"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <AppIcon name="check" size={18} className="text-success mt-0.5" />
          <div>
            <p className="m-0 text-sm font-semibold text-success">
              Seu relatório foi gerado com sucesso!
            </p>
            <p className="m-0 mt-0.5 text-xs text-slate-600">
              {hasDelivered
                ? `Versão entregue atual: v${latestArchive.version} de ${fmt(latestArchive.deliveredAt || latestArchive.createdAt)}`
                : 'Baixe o DOCX gerado para revisão e assinatura.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onDownloadDocx?.(mediaId, compoundDownloadFileName)}
            disabled={downloadBusy}
            data-testid="delivery-callout-download"
          >
            <AppIcon name={downloadBusy ? 'loader' : 'download'} className={downloadBusy ? 'animate-spin' : ''} />
            {downloadBusy ? 'Baixando...' : 'Baixar DOCX gerado'}
          </Button>

          <Button
            variant="outline"
            onClick={() => onUploadDelivery?.(compound)}
            data-testid="delivery-callout-upload"
          >
            <AppIcon name="upload" />
            {hasDelivered ? 'Enviar nova versão' : 'Enviar versão final (PDF ou DOCX)'}
          </Button>

          {onRegenerate ? (
            <button
              type="button"
              className="ml-auto text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
              onClick={() => onRegenerate(compound)}
              disabled={regenBusy}
              data-testid="delivery-callout-regenerate"
            >
              {regenBusy ? 'Regerando...' : 'Gerar novamente'}
            </button>
          ) : null}
        </div>

        {totalArchives > 1 ? (
          <p className="m-0 text-xs text-slate-500">
            {totalArchives} versões arquivadas no histórico desta entrega.
          </p>
        ) : null}
      </div>
    </div>
  );
}
