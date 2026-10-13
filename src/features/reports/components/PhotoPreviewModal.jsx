import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Input, RangeSlider, Textarea } from '../../../components/ui';
import IconButton from '../../../components/ui/IconButton';
import Modal from '../../../components/ui/Modal';
import { formatTowerLabel } from '../../projects/utils/kmlUtils';
import { PHOTO_SUBJECTS, PHOTO_SUBJECT_LABELS, formatImportSourceLabel, formatTowerSourceLabel, normalizePhotoSubject } from '../utils/reportUtils';
import PhotoLocationMiniMap from './PhotoLocationMiniMap';
import CreateErosionHandoffModal from './CreateErosionHandoffModal';

// Calibracao do Timestamp Camera: a ultima linha da marca d'agua ocupa 45 px
// em fotos 1920x1080. Para outras alturas, a mesma proporcao.
const CROP_REFERENCE_HEIGHT = 1080;
const CROP_LINE_PX = 45;
const CROP_MAX_PX = 400;
const CROP_SLIDER_MAX = 200;

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

function defaultCropPixels(naturalHeight) {
  if (!Number.isFinite(naturalHeight) || naturalHeight <= 0) return CROP_LINE_PX;
  return Math.max(1, Math.round((naturalHeight * CROP_LINE_PX) / CROP_REFERENCE_HEIGHT));
}

function clampPixels(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return CROP_LINE_PX;
  return Math.min(CROP_MAX_PX, Math.max(1, n));
}

/**
 * Lightbox "Preview da foto" da curadoria de Relatorios (redesenho hi-fi).
 *
 * Substitui os botoes de texto por icones, remove o "Salvar" (a legenda salva
 * sozinha) e adiciona, no proprio modal: baixar, mover para lixeira, incluir no
 * .docx, mini-mapa torre+foto, o handoff "criar erosao a partir da foto" e o
 * painel "Cortar rodape da marca d'agua" (retraido por padrao, atalho C) com
 * pre-visualizacao da faixa sobre a foto.
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
  onChangeSubject,
  onCropFooter,
  onUndoCrop,
  cropBackupRetentionDays = 30,
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
  // Painel de corte do rodape (retraido por padrao).
  const [cropOpen, setCropOpen] = useState(false);
  const [cropPixels, setCropPixels] = useState(CROP_LINE_PX);
  const [imageBox, setImageBox] = useState(null); // { naturalWidth, naturalHeight, renderedHeight, bottomOffset }
  const imgRef = useRef(null);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const wasSavingRef = useRef(false);

  const photoId = photo?.id || '';
  const included = Boolean(draft?.includeInReport);
  const captionDirty = String(draft?.caption || '').trim() !== String(photo?.caption || '').trim();
  const cropHistory = Array.isArray(photo?.cropHistory) ? photo.cropHistory : [];
  const lastCrop = cropHistory.length ? cropHistory[cropHistory.length - 1] : null;
  const cropBusy = busy === `photo-crop:${photoId}`;
  const canCrop = typeof onCropFooter === 'function';

  // Mede a area realmente ocupada pela imagem (object-contain centraliza) para
  // posicionar a faixa de pre-visualizacao na escala certa.
  const measureImage = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      setImageBox(null);
      return;
    }
    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const renderedHeight = Math.min(clientHeight, (clientWidth * naturalHeight) / naturalWidth) || clientHeight;
    const bottomOffset = Math.max(0, (clientHeight - renderedHeight) / 2);
    setImageBox({ naturalWidth, naturalHeight, renderedHeight, bottomOffset });
  }, []);

  // Fecha confirmacoes/handoff/painel e zera o indicador ao trocar de foto.
  useEffect(() => {
    setConfirmTrash(false);
    setErosionHandoffOpen(false);
    setAutosaveState('idle');
    setCropOpen(false);
    setImageBox(null);
  }, [photoId]);

  // Default de pixels acompanha a altura real da foto quando ela carrega.
  useEffect(() => {
    if (imageBox?.naturalHeight) setCropPixels(defaultCropPixels(imageBox.naturalHeight));
  }, [imageBox?.naturalHeight]);

  useEffect(() => {
    if (!cropOpen || typeof window === 'undefined') return undefined;
    measureImage();
    window.addEventListener('resize', measureImage);
    return () => window.removeEventListener('resize', measureImage);
  }, [cropOpen, measureImage]);

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

  // Atalhos de teclado: setas navegam; E inclui; C abre o corte; Del/Backspace
  // lixeira. Ignora quando o foco esta num campo de texto (edicao da legenda).
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
      } else if ((event.key === 'c' || event.key === 'C') && canCrop) {
        event.preventDefault();
        setCropOpen((prev) => !prev);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && onTrash) {
        event.preventDefault();
        setConfirmTrash(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onPrev, onNext, onToggleInclude, onTrash, included, canCrop]);

  if (!photo) return null;

  const hasPagination = typeof total === 'number' && total > 1;
  const positionLabel = typeof index === 'number' && index >= 0 && hasPagination
    ? `${index + 1} / ${total}`
    : '';
  const coordsPoint = towerPoint || photoPoint;

  const linePx = defaultCropPixels(imageBox?.naturalHeight);
  const bandHeightPx = imageBox?.naturalHeight
    ? (cropPixels * imageBox.renderedHeight) / imageBox.naturalHeight
    : 0;
  const showBand = cropOpen && canCrop && imageBox && bandHeightPx > 0;

  const headerActions = (
    <>
      {onDownload && (
        <IconButton variant="ghost" size="md" aria-label="Baixar foto" onClick={() => onDownload(photo)}>
          <AppIcon name="download" />
        </IconButton>
      )}
      {canCrop && (
        <IconButton
          variant={cropOpen ? 'outline' : 'ghost'}
          size="md"
          aria-label="Cortar rodapé da marca d'água"
          aria-pressed={cropOpen}
          className={cropOpen ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}
          onClick={() => setCropOpen((prev) => !prev)}
        >
          <AppIcon name="crop" />
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
    <div className="flex w-full items-center gap-3 text-2xs text-slate-400">
      <div className="flex items-center gap-4">
        <ShortcutHint keys={['←', '→']} label="Navegar" />
        <ShortcutHint keys={['E']} label="Incluir" />
        {canCrop && <ShortcutHint keys={['C']} label="Cortar rodapé" />}
      </div>
      <span className="flex-1" />
      {hasPagination && (
        <div className="flex items-center gap-2.5">
          <IconButton variant="outline" size="sm" aria-label="Foto anterior" onClick={onPrev} disabled={!onPrev}>
            <AppIcon name="chevron-left" className="w-4 h-4" aria-hidden="true" />
          </IconButton>
          <span className="font-mono text-2xs text-slate-600">{positionLabel}</span>
          <IconButton variant="outline" size="sm" aria-label="Próxima foto" onClick={onNext} disabled={!onNext}>
            <AppIcon name="chevron-right" className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        </div>
      )}
      <span className="flex-1" />
      <div className="flex items-center gap-4">
        <ShortcutHint keys={['Del']} label="Lixeira" />
        <ShortcutHint keys={['Esc']} label="Fechar" />
      </div>
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
          {/* Palco da imagem (escuro). Navegacao e contador ficam no rodape. */}
          <div className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-950 lg:min-h-[520px]">
            {previewUrl ? (
              <div className="relative w-full">
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt={draft?.caption || photo.id}
                  className="max-h-[calc(100vh-220px)] w-full rounded-lg object-contain"
                  onLoad={measureImage}
                />
                {showBand && (
                  <>
                    <div
                      data-testid="photo-crop-band"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-danger-border bg-danger/40"
                      style={{ bottom: `${imageBox.bottomOffset}px`, height: `${bandHeightPx}px` }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 inline-flex items-center gap-1.5 rounded-full border border-danger-border/60 bg-slate-900/85 px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ bottom: `${imageBox.bottomOffset + bandHeightPx + 8}px` }}
                    >
                      <AppIcon name="crop" className="w-3 h-3 text-danger-border" />
                      Remove {cropPixels} px{cropPixels === linePx ? ' · última linha da marca d\'água' : ''}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-400">
                Preview indisponivel para esta foto.
              </div>
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
                value={draft?.towerId || photo.towerId
                  ? `${formatTowerLabel(draft?.towerId || photo.towerId)}${photo.towerSource && photo.towerSource !== 'manual' && photo.towerSource !== 'pending' ? ` · ${formatTowerSourceLabel(photo.towerSource)}` : ''}`
                  : 'Pendente'}
              />
              {/* Assunto da foto: torre em si, via de acesso ou contexto. Salva na hora. */}
              <div className="flex items-center gap-2 text-sm" data-testid="photo-subject-control">
                <AppIcon name="image" className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-slate-500 min-w-[84px] shrink-0">Assunto</span>
                <div className="inline-flex gap-1" role="group" aria-label="Assunto da foto">
                  {PHOTO_SUBJECTS.map((option) => {
                    const current = normalizePhotoSubject(draft?.subject || photo.subject);
                    return (
                      <Button
                        key={option}
                        size="sm"
                        variant={current === option ? 'primary' : 'outline'}
                        aria-pressed={current === option}
                        disabled={!onChangeSubject || Boolean(busy)}
                        onClick={() => { if (current !== option) onChangeSubject?.(option); }}
                      >
                        {PHOTO_SUBJECT_LABELS[option]}
                      </Button>
                    );
                  })}
                </div>
              </div>
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
              <label htmlFor={`modal-caption-${photo.id}`} className="text-xs font-semibold text-slate-600">
                Legenda da foto
              </label>
              <Textarea
                id={`modal-caption-${photo.id}`}
                variant="filled"
                rows={4}
                className="min-h-[108px]"
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

            {/* Cortar rodape da marca d'agua (retraido por padrao) */}
            {canCrop && (
              <section
                aria-label="Cortar rodapé da marca d'água"
                className={`rounded-lg border bg-white shadow-card overflow-hidden ${cropOpen ? 'border-brand-200' : 'border-slate-200'}`}
                data-testid="photo-crop-panel"
              >
                <button
                  type="button"
                  aria-expanded={cropOpen}
                  aria-controls={`photo-crop-body-${photo.id}`}
                  onClick={() => setCropOpen((prev) => !prev)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${cropOpen ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <AppIcon name="crop" className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">Cortar rodapé da marca d'água</span>
                  {lastCrop ? (
                    <Badge tone="neutral">Cortada · {lastCrop.pixels ? `${lastCrop.pixels} px` : `${Math.round((lastCrop.percent || 0) * 100)}%`}</Badge>
                  ) : (
                    <Badge tone="neutral">{linePx} px · 1 linha</Badge>
                  )}
                  <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-slate-300 bg-white px-1 text-[10px] font-semibold text-slate-500">C</kbd>
                  <AppIcon name={cropOpen ? 'chevron-up' : 'chevron-down'} className="w-4 h-4 text-slate-400" aria-hidden="true" />
                </button>
                {cropOpen && (
                  <div id={`photo-crop-body-${photo.id}`} className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant={cropPixels === linePx ? 'primary' : 'outline'} aria-pressed={cropPixels === linePx} onClick={() => setCropPixels(linePx)}>
                        1 linha · {linePx} px
                      </Button>
                      <Button size="sm" variant={cropPixels === linePx * 2 ? 'primary' : 'outline'} aria-pressed={cropPixels === linePx * 2} onClick={() => setCropPixels(clampPixels(linePx * 2))}>
                        2 linhas · {linePx * 2} px
                      </Button>
                      <span className="flex-1" />
                      <label htmlFor={`photo-crop-pixels-${photo.id}`} className="text-2xs font-bold uppercase tracking-wide text-slate-500">Altura</label>
                      <Input
                        id={`photo-crop-pixels-${photo.id}`}
                        type="number"
                        min={1}
                        max={CROP_MAX_PX}
                        fullWidth={false}
                        className="w-20 text-right"
                        value={cropPixels}
                        onChange={(event) => setCropPixels(clampPixels(event.target.value))}
                      />
                      <span className="font-mono text-xs text-slate-500">px</span>
                    </div>
                    <RangeSlider
                      single
                      id={`photo-crop-range-${photo.id}`}
                      min={0}
                      max={CROP_SLIDER_MAX}
                      value={Math.min(cropPixels, CROP_SLIDER_MAX)}
                      onChange={(next) => setCropPixels(clampPixels(next || 1))}
                      formatLabel={(n) => `${n} px`}
                      ariaLabel="Faixa a remover em pixels"
                    />
                    <p className="m-0 text-xs text-slate-500">
                      A faixa vermelha no palco mostra o que será removido. O original fica guardado por {cropBackupRetentionDays} dias
                      (Admin › Retenção); depois disso o corte não pode mais ser desfeito.
                      {imageBox?.naturalHeight ? ` Foto com ${imageBox.naturalHeight} px de altura.` : ''}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      {lastCrop && onUndoCrop && (
                        <Button size="sm" variant="ghost" className="mr-auto" onClick={() => onUndoCrop(photo)} disabled={cropBusy}>
                          <AppIcon name="undo" className="w-4 h-4" aria-hidden="true" />
                          Desfazer corte
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setCropOpen(false)} disabled={cropBusy}>Cancelar</Button>
                      <Button size="sm" variant="primary" onClick={() => onCropFooter(photo, { pixels: cropPixels })} disabled={cropBusy || cropPixels < 1}>
                        <AppIcon name={cropBusy ? 'loader' : 'crop'} className={`w-4 h-4 ${cropBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {cropBusy ? 'Cortando…' : `Cortar ${cropPixels} px`}
                      </Button>
                    </div>
                  </div>
                )}
                {!cropOpen && lastCrop && onUndoCrop && (
                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                    <span className="flex-1">Último corte {lastCrop.at ? `em ${new Date(lastCrop.at).toLocaleString('pt-BR')}` : ''}</span>
                    <Button size="sm" variant="ghost" onClick={() => onUndoCrop(photo)} disabled={cropBusy}>
                      <AppIcon name="undo" className="w-4 h-4" aria-hidden="true" />
                      Desfazer corte
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Mini-mapa de localizacao */}
            {coordsPoint && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600">
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
        onConfirm={(choice) => { setErosionHandoffOpen(false); onCreateErosion?.(photo, choice || {}); }}
        projectId={projectId}
        towerRef={draft?.towerId || photo.towerId || ''}
        towerPoint={towerPoint}
        photoPoint={photoPoint}
        distanceMeters={distanceMeters}
        photoId={photo.id}
      />
    </>
  );
}
