import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import { downloadMediaAsset } from '../../../services/mediaService';

// Previa do relatorio final (DOCX) renderizada no navegador antes do download.
// Renderiza o proprio .docx ja gerado (fidelidade alta, mostra o artefato real)
// reaproveitando o blob via downloadMediaAsset. A fonte DM Sans e auto-hospedada
// (ver @font-face em src/styles.css) para o texto bater com o template AXIA.
//
// Props:
//   open      — controla visibilidade
//   onClose   — fecha o modal
//   mediaId   — id do media_asset do DOCX gerado (compound.outputDocxMediaId)
//   fileName  — nome amigavel para o download
//   onDownload — callback (mediaId, fileName) que dispara o download real
//   showToast — feedback de erro

// Opcoes do docx-preview: quebra de pagina + cabecalho/rodapo + fontes embutidas.
const RENDER_OPTIONS = {
  inWrapper: true,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  experimental: true,
  ignoreLastRenderedPageBreak: true,
};

// Aguarda as variantes de DM Sans usadas pelo DOCX, para o navegador repintar a
// previa sem FOUT (texto piscando em fallback antes da fonte carregar).
async function ensureDmSansLoaded() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load("400 1em 'DM Sans'"),
      document.fonts.load("700 1em 'DM Sans'"),
      document.fonts.load("italic 400 1em 'DM Sans'"),
      document.fonts.load("italic 700 1em 'DM Sans'"),
    ]);
  } catch {
    // best-effort: se o carregamento falhar, o fallback do navegador assume.
  }
}

export default function ReportPreviewModal({
  open,
  onClose,
  mediaId,
  fileName,
  onDownload,
  showToast = () => {},
}) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  // Token para forcar re-render (botao "Tentar novamente") sem reabrir o modal.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!open || !mediaId) return undefined;

    let cancelled = false;
    const container = containerRef.current;

    async function renderPreview() {
      setStatus('loading');
      setErrorMessage('');
      if (container) container.innerHTML = '';
      try {
        const { blob } = await downloadMediaAsset(mediaId);
        if (cancelled || !containerRef.current) return;
        await renderAsync(blob, containerRef.current, undefined, RENDER_OPTIONS);
        if (cancelled) return;
        setStatus('ready');
        // Carrega DM Sans em background; com font-display:swap a previa repinta
        // sozinha quando a fonte chega (nao bloqueia a exibicao).
        ensureDmSansLoaded();
      } catch (error) {
        if (cancelled) return;
        const message = error?.message || 'Erro ao gerar a previa do relatorio.';
        setErrorMessage(message);
        setStatus('error');
        showToast(message, 'error');
      }
    }

    renderPreview();
    return () => {
      cancelled = true;
      if (container) container.innerHTML = '';
    };
  }, [open, mediaId, reloadToken, showToast]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pré-visualizar relatório"
      subtitle={fileName || ''}
      icon="eye"
      size="2xl"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>
            <AppIcon name="close" /> Fechar
          </Button>
          <Button
            onClick={() => onDownload?.(mediaId, fileName)}
            disabled={!mediaId}
            data-testid="report-preview-download"
          >
            <AppIcon name="download" /> Baixar DOCX
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        {status === 'loading' ? (
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-16 text-sm text-slate-500"
            data-testid="report-preview-loading"
          >
            <AppIcon name="loader" className="animate-spin" /> Gerando prévia do relatório...
          </div>
        ) : null}

        {status === 'error' ? (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 py-16 text-center text-sm text-rose-700"
            data-testid="report-preview-error"
          >
            <AppIcon name="alert" className="w-6 h-6" />
            <span>{errorMessage}</span>
            <Button variant="outline" size="sm" onClick={() => setReloadToken((t) => t + 1)}>
              <AppIcon name="loader" /> Tentar novamente
            </Button>
          </div>
        ) : null}

        {/* O container do docx-preview fica sempre montado (o ref precisa existir
            antes do render). Escondido enquanto carrega/da erro. */}
        <div
          ref={containerRef}
          data-testid="report-preview-canvas"
          className={[
            'overflow-auto rounded-xl border border-slate-200 bg-slate-100',
            'max-h-[70vh]',
            status === 'ready' ? '' : 'hidden',
          ].join(' ')}
        />

        {status === 'ready' ? (
          <p className="m-0 text-xs text-slate-500">
            Prévia para revisão — a paginação e alguns recursos avançados podem diferir do Word. O
            arquivo baixado preserva fontes e a formatação AXIA.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
