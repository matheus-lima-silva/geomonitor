import AppIcon from '../../../components/AppIcon';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui';
import MediaImage from '../../../components/MediaImage';

// Preview read-only de uma foto da erosao. Aceita navegacao prev/next
// quando ha multiplas fotos selecionadas.
export default function ErosionPhotoLightbox({
  open,
  photo,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}) {
  if (!open || !photo) return null;

  const hasPagination = typeof total === 'number' && total > 1;

  const footer = hasPagination ? (
    <div className="flex w-full items-center justify-between">
      <span className="text-sm text-slate-500">
        {typeof index === 'number' ? `Foto ${index + 1} de ${total}` : ''}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!onPrev}>
          <AppIcon name="chevron-left" className="w-4 h-4" />
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext}>
          Proxima
          <AppIcon name="chevron-right" className="w-4 h-4" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={photo.caption || `Foto ${photo.photoId}`}
      size="2xl"
      footer={footer}
    >
      <div className="flex min-h-[360px] w-full items-center justify-center rounded-xl bg-slate-950">
        <MediaImage
          mediaAssetId={photo.mediaAssetId}
          alt={photo.caption || photo.photoId}
          className="max-h-[70vh] w-full rounded-lg object-contain"
          fallbackClassName="h-[360px] w-full rounded-lg"
        />
      </div>
      {photo.caption ? (
        <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap m-0">{photo.caption}</p>
      ) : null}
      {photo.workspaceTitle ? (
        <p className="mt-1 text-xs text-slate-500 m-0">Origem: {photo.workspaceTitle}</p>
      ) : null}
    </Modal>
  );
}
