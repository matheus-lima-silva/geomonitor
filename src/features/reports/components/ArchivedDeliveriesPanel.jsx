import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import { listArchives } from '../../../services/reportArchiveService';
import { downloadMediaAsset } from '../../../services/mediaService';
import { sanitizeDownloadName, triggerBlobDownload } from '../utils/reportUtils';

function formatDeliveredAt(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
}

function shortSha(sha) {
  const value = String(sha || '').trim();
  return value ? value.slice(0, 12) : '';
}

export default function ArchivedDeliveriesPanel({
  compoundId,
  compoundName,
  refreshToken,
  showToast = () => {},
}) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    if (!compoundId) { setArchives([]); return; }
    let cancelled = false;
    setLoading(true);
    listArchives(compoundId)
      .then((items) => { if (!cancelled) setArchives(items); })
      .catch((error) => {
        if (!cancelled) showToast(error?.message || 'Erro ao carregar entregas.', 'error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [compoundId, refreshToken, showToast]);

  async function handleDownload(archive, variant) {
    const mediaId = variant === 'delivered' ? archive.deliveredMediaId : archive.generatedMediaId;
    if (!mediaId) {
      showToast('Arquivo indisponivel para esta variante.', 'error');
      return;
    }
    const key = `${archive.id}:${variant}`;
    try {
      setDownloading(key);
      const { blob } = await downloadMediaAsset(mediaId);
      const ext = variant === 'delivered' ? '' : '.docx';
      const baseName = compoundName || archive.compoundId || 'relatorio';
      const fileName = sanitizeDownloadName(
        `${baseName}-v${archive.version}-${variant}${ext}`,
        `entrega-${archive.id}${ext}`,
      );
      triggerBlobDownload(fileName, blob);
    } catch (error) {
      showToast(error?.message || 'Erro ao baixar arquivo.', 'error');
    } finally {
      setDownloading('');
    }
  }

  if (!compoundId) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="archived-deliveries-panel">
      <div className="flex items-center justify-between mb-2">
        <h3 className="m-0 text-sm font-bold text-slate-800">Entregas arquivadas</h3>
        <span className="text-xs text-slate-500">{archives.length} versao(oes)</span>
      </div>

      {loading ? (
        <p className="m-0 text-xs text-slate-500">Carregando...</p>
      ) : archives.length === 0 ? (
        <p className="m-0 text-xs text-slate-500">
          Nenhuma entrega registrada. Gere o relatorio e clique em "Marcar como entregue".
        </p>
      ) : (
        <ul className="m-0 flex flex-col gap-2 p-0 list-none">
          {archives.map((archive) => (
            <li
              key={archive.id}
              data-testid={`archive-row-${archive.id}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-semibold text-slate-800">
                  v{archive.version}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {formatDeliveredAt(archive.deliveredAt)}
                  </span>
                  {archive.deliveredBy ? (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      · {archive.deliveredBy}
                    </span>
                  ) : null}
                </p>
                <p className="m-0 text-2xs text-slate-500 font-mono">
                  gerado: {shortSha(archive.generatedSha256) || '—'}
                  {archive.deliveredSha256
                    ? ` · entregue: ${shortSha(archive.deliveredSha256)}`
                    : ' · entregue: pendente'}
                </p>
                {archive.notes ? (
                  <p className="m-0 mt-1 text-xs text-slate-600">{archive.notes}</p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(archive, 'generated')}
                  disabled={downloading === `${archive.id}:generated`}
                >
                  <AppIcon name="download" size={12} />
                  Gerado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(archive, 'delivered')}
                  disabled={!archive.deliveredMediaId || downloading === `${archive.id}:delivered`}
                  data-testid={`archive-download-delivered-${archive.id}`}
                >
                  <AppIcon name="download" size={12} />
                  Entregue
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
