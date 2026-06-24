import { useEffect, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Textarea } from '../../../components/ui';
import IconButton from '../../../components/ui/IconButton';
import Modal from '../../../components/ui/Modal';
import { formatTowerLabel } from '../../projects/utils/kmlUtils';
import { formatImportSourceLabel } from '../utils/reportUtils';
import PhotoLocationMiniMap from './PhotoLocationMiniMap';
import CreateErosionHandoffModal from './CreateErosionHandoffModal';

function MetaRow({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <AppIcon name={icon} className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      <span className="text-slate-500 min-w-[56px] shrink-0">{label}</span>
      <span className={`text-slate-800 font-semibold break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '-'}
      </span>
    </div>
  );
}

function ShortcutHint({ keys, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex min-w-[18px] items-center justify-center rounded border border-slate-300 bg-white px-1 text-[10px] font-semibold text-slate-500"
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}

/**
 * Lightbox "Preview da foto" da curadoria de Relatorios (redesenho hi-fi).
 *
 * Substitui os botoes de texto por icones, remove o "Salvar" (a legenda salva
 * sozinha) e adiciona, no proprio modal: baixar, mover para lixeira, incluir no
 * .docx, mini-mapa torre+foto e o handoff "criar erosao a partir da foto".
 */
export default function PhotoPreviewModal({
  photo,
  previewUrl,
  draft,
  busy,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onChangeCaption,
  onSave,
  onToggleInclude,
  onDownload,
  onTrash,
  onCreateErosion,
  towerPoint = null,
  photoPoint = null,
  towerLabel = '',
  distanceMeters = null,
  projectId = '',
}) {
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [erosionHandoffOpen, setErosionHandoffOpen] = useState(false);
  // idle | saving | saved — indicador que substitui o antigo botao Salvar.
  const [autosaveState, setAutosaveState] = useState('idle');

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const wasSavingRef = useRef(false);

  const photoId = photo?.id || '';
  const included = Boolean(draft?.includeInReport);
  const captionDirty = String(draft?.caption || '').trim() !== String(photo?.caption || '').trim();

  // Fecha confirmacoes/handoff e zera o indicador ao trocar de foto.
  useEffect(() => {
    setConfirmTrash(false);
    setErosionHandoffOpen(false);
    setAutosaveState('idle');
  }, [photoId]);

  // Autosave da legenda: 650ms apos parar de digitar. Usa onSaveRef para sempre
  // chamar o handler mais recente (que le o rascunho atual do parent).
  useEffect(() => {
    if (!photoId || !captionDirty) return undefined;
    const timer = setTimeout(() => { onSaveRef.current?.(); }, 650);
    return () => clearTimeout(timer);
  }, [photoId, captionDirty, draft?.caption]);

  // Deriva o indicador (Salvando.../Salvo) das transicoes de `busy`.
  useEffect(() => {
    const saving = busy === `photo:${photoId}`;
    if (saving) {
      wasSavingRef.current = true;
      setAutosaveState('saving');
      return undefined;
    }
    if (wasSavingRef.current) {
      wasSavingRef.current = false;
      setAutosaveState('saved');
      const timer = setTimeout(() => setAutosaveState('idle'), 1600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [busy, photoId]);

  // Atalhos de teclado: setas navegam; E inclui; Del/Backspace lixeira. Ignora
  // quando o foco esta num campo de texto (edicao da legenda).
  useEffect(() => {
    if (!photo) return undefined;
    function handleKeyDown(event) {
      const tag = event.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft' && onPrev) {
        event.preventDefault();
        onPrev();
      } else if ((event.key === 'e' || event.key === 'E') && onToggleInclude) {
        event.preventDefault();
        onToggleInclude(!included);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && onTrash) {
        event.preventDefault();
        setConfirmTrash(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onPrev, onNext, onToggleInclude, onTrash, included]);

  if (!photo) return null;

  const hasPagination = typeof total === 'number' && total > 1;
  const positionLabel = typeof index === 'number' && index >= 0 && hasPagination
    ? `${index + 1} / ${total}`
    : '';
  const coordsPoint = towerPoint || photoPoint;
  const coordsLabel = coordsPoint ? `${coordsPoint[0].toFixed(6)} ${coordsPoint[1].toFixed(6)}` : '';

  const headerActions = (
    <>
      {positionLabel && (
        <span className="mr-1 rounded-full border border-slate-200 bg-app-surfaceMuted px-2.5 py-1 font-mono text-2xs text-slate-500">
          {positionLabel}
        </span>
      )}
      {onDownload && (
        <IconButton variant="ghost" size="md" aria-label="Baixar foto" onClick={() => onDownload(photo)}>
          <AppIcon name="download" />
        </IconButton>
      )}
      {onTrash && !confirmTrash && (
        <IconButton
          variant="dangerGhost"
          size="md"
          aria-label="Mover para lixeira"
          onClick={() => setConfirmTrash(true)}
          disabled={busy === `photo-trash:${photoId}`}
        >
          <AppIcon name="trash-2" />
        </IconButton>
      )}
      {onTrash && confirmTrash && (
        <span className="flex items-center gap-1.5 rounded-lg border border-danger-border bg-danger-light px-2 py-1 text-xs text-danger-dark">
          <span className="font-semibold">Excluir esta foto?</span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { setConfirmTrash(false); onTrash(photo); }}
            disabled={busy === `photo-trash:${photoId}`}
          >
            Mover p/ lixeira
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmTrash(false)}>
            Cancelar
          </Button>
        </span>
      )}
      <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
    </>
  );

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-400">
      <ShortcutHint keys={['←', '→']} label="Navegar" />
      <ShortcutHint keys={['E']} label="Incluir" />
      <ShortcutHint keys={['Del']} label="Lixeira" />
      <ShortcutHint keys={['Esc']} label="Fechar" />
    </div>
  );

  return (
    <>
      <Modal
        open={Boolean(photo)}
        onClose={onClose}
        title="Preview da foto"
        subtitle={<span className="font-mono text-2xs text-slate-500">{photo.id}</span>}
        icon="image"
        size="2xl"
        headerActions={headerActions}
        footer={footer}
      >
        <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
          {/* Palco da imagem (escuro) */}
          <div className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-950 lg:min-h-[520px]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={draft?.caption || photo.id}
                className="max-h-[calc(100vh-220px)] w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-400">
                Preview indisponivel para esta foto.
              </div>
            )}

            {/* Setas flutuantes sobre a foto */}
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={onPrev}
              disabled={!onPrev}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-900/55 text-white backdrop-blur-sm transition-opacity hover:bg-slate-900/75 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <AppIcon name="chevron-left" className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={onNext}
              disabled={!onNext}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-900/55 text-white backdrop-blur-sm transition-opacity hover:bg-slate-900/75 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <AppIcon name="chevron-right" className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Pilula contadora no rodape da imagem */}
            {positionLabel && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/60 px-2.5 py-0.5 font-mono text-2xs text-white">
                {positionLabel}
              </span>
            )}
          </div>

          {/* Painel de informacoes */}
          <div className="flex w-full flex-col gap-4 overflow-y-auto lg:w-[340px] lg:shrink-0">
            {/* Metadados */}
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-app-surfaceMuted px-3 py-3">
              <MetaRow icon="hash" label="ID" value={photo.id} mono />
              <MetaRow icon="folder-input" label="Origem" value={formatImportSourceLabel(photo.importSource)} />
              <MetaRow
                icon="radio-tower"
                label="Torre"
                value={draft?.towerId || photo.towerId ? formatTowerLabel(draft?.towerId || photo.towerId) : 'Pendente'}
              />
            </div>

            {/* Acao .docx */}
            {included ? (
              <div className="flex items-start gap-3 rounded-lg border border-success-border bg-success-light px-3 py-3">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-success text-white shrink-0">
                  <AppIcon name="check" className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-bold text-green-800">No relatório</p>
                  <p className="m-0 text-xs text-slate-600">Esta foto entra no .docx gerado.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleInclude?.(false)}
                  className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                >
                  remover
                </button>
              </div>
            ) : (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => onToggleInclude?.(true)}
                disabled={!onToggleInclude}
              >
                <AppIcon name="file-plus-2" /> Adicionar ao relatório (.docx)
              </Button>
            )}

            {/* Legenda + autosave */}
            <div className="flex flex-col gap-2">
              <Textarea
                id={`modal-caption-${photo.id}`}
                label="Legenda"
                rows={4}
                value={draft?.caption || ''}
                onChange={(event) => onChangeCaption(event.target.value)}
                placeholder="Detalhe os achados operacionais desta foto..."
              />
              <div className="flex min-h-[18px] items-center text-xs">
                {autosaveState === 'saving' && (
                  <span className="inline-flex items-center gap-1.5 text-brand-600">
                    <AppIcon name="loader" className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Salvando…
                  </span>
                )}
                {autosaveState === 'saved' && (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <AppIcon name="cloud-check" className="w-3.5 h-3.5" aria-hidden="true" />
                    Salvo automaticamente
                  </span>
                )}
                {autosaveState === 'idle' && (
                  <span className="text-slate-400">A legenda salva automaticamente.</span>
                )}
              </div>
            </div>

            {/* Mini-mapa de localizacao */}
            {coordsPoint && (
              <div className="flex flex-col gap-1.5">
                <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">
                  Localização da foto
                </span>
                <PhotoLocationMiniMap
                  towerPoint={towerPoint}
                  photoPoint={photoPoint}
                  towerLabel={towerLabel || draft?.towerId || photo.towerId}
                  distanceMeters={distanceMeters}
                />
              </div>
            )}

            {/* Acao criar erosao */}
            {onCreateErosion && (
              <Button variant="outline" className="w-full" onClick={() => setErosionHandoffOpen(true)}>
                <AppIcon name="alert" /> Criar erosão nesta torre
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <CreateErosionHandoffModal
        open={erosionHandoffOpen}
        onClose={() => setErosionHandoffOpen(false)}
        onConfirm={() => { setErosionHandoffOpen(false); onCreateErosion?.(photo); }}
        projectId={projectId}
        towerRef={draft?.towerId || photo.towerId || ''}
        coordsLabel={coordsLabel}
        photoId={photo.id}
      />
    </>
  );
}
