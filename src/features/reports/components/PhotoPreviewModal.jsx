import { useEffect } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Textarea } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import { buildWorkspacePhotoDraft, isWorkspacePhotoDirty } from '../utils/reportUtils';

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
}) {
  // Navegacao por setas do teclado enquanto o modal esta aberto. Ignora quando o
  // foco esta num campo de texto (edicao da legenda) para nao mover o cursor/foto.
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
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onPrev, onNext]);

  if (!photo) return null;

  const isDirty = isWorkspacePhotoDirty(photo, draft || buildWorkspacePhotoDraft(photo));
  const hasPagination = typeof total === 'number' && total > 1;

  const footer = hasPagination ? (
    <div className="flex w-full items-center justify-between">
      <span className="text-sm text-slate-500">
        {typeof index === 'number' && index >= 0 ? `Foto ${index + 1} de ${total}` : ''}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!onPrev}>
          <AppIcon name="chevron-left" className="w-4 h-4" aria-hidden="true" />
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext}>
          Proxima
          <AppIcon name="chevron-right" className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      open={Boolean(photo)}
      onClose={onClose}
      title={`Preview da Foto — ${photo.id}`}
      size="2xl"
      footer={footer}
    >
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        {/* Imagem */}
        <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-xl bg-slate-950 lg:min-h-[520px]">
          {previewUrl ? (
            onNext ? (
              <button
                type="button"
                className="block w-full cursor-pointer"
                onClick={onNext}
                title="Clique para a proxima foto"
                aria-label="Proxima foto"
              >
                <img
                  src={previewUrl}
                  alt={draft?.caption || photo.id}
                  className="max-h-[80vh] w-full rounded-lg object-contain"
                />
              </button>
            ) : (
              <img
                src={previewUrl}
                alt={draft?.caption || photo.id}
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />
            )
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-400">
              Preview indisponivel para esta foto.
            </div>
          )}
        </div>

        {/* Info lateral */}
        <div className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            <p className="m-0"><strong className="text-slate-700">ID:</strong> {photo.id}</p>
            <p className="mt-1.5 m-0"><strong className="text-slate-700">Origem:</strong> {photo.importSource || '-'}</p>
            <p className="mt-1.5 m-0">
              <strong className="text-slate-700">Torre:</strong>{' '}
              {draft?.towerId || photo.towerId || 'Pendente'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Textarea
              id={`modal-caption-${photo.id}`}
              label="Editar Legenda"
              rows={4}
              value={draft?.caption || ''}
              onChange={(event) => onChangeCaption(event.target.value)}
              placeholder="Detalhe os achados operacionais desta foto..."
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">A legenda sera salva automaticamente.</span>
              <Button
                variant={isDirty ? 'primary' : 'outline'}
                onClick={onSave}
                disabled={busy === `photo:${photo.id}` || !isDirty}
              >
                <AppIcon name="save" />
                {busy === `photo:${photo.id}` ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
