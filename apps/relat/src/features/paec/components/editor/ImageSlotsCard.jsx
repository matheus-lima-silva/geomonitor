import { useRef } from 'react';
import AppIcon from '@app/components/AppIcon';
import MediaImage from '@app/components/MediaImage';
import { Button, IconButton } from '@app/components/ui';
import { useOptionalToast } from '@app/context/ToastContext';
import { useMediaUpload, IMAGE_MIME_TYPES } from '../../hooks/useMediaUpload';

/**
 * Anexo com imagem por usina (Fase 4 — rota de fuga, unifilar): upload
 * multiplo dirigido por manifest.imageSlots[] (assetKey/label/maxImages,
 * nada hardcoded). As imagens sobem pelo fluxo generico de midia
 * (purpose paec_attachment) e a ficha guarda so os mediaAssetIds na ordem —
 * mesmo replace-on-save dos blocos tabulares. A ordem e a de upload; o
 * documento gerado insere na mesma ordem.
 */
export default function ImageSlotsCard({ slot, mediaIds, plantId, onChange }) {
  const toast = useOptionalToast();
  const inputRef = useRef(null);
  const { uploadFile, uploading } = useMediaUpload({
    purpose: 'paec_attachment',
    linkedResourceType: 'paec_plant',
  });

  const images = mediaIds || [];
  const maxImages = slot.maxImages || 1;
  const remaining = maxImages - images.length;

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []).slice(0, Math.max(remaining, 0));
    event.target.value = '';
    if (files.length === 0) return;

    const uploaded = [];
    for (const file of files) {
      try {
        uploaded.push(await uploadFile(file, { linkedResourceId: plantId }));
      } catch (err) {
        toast.show(err?.message || `Erro ao enviar ${file.name}.`, 'error');
      }
    }
    if (uploaded.length > 0) {
      onChange(slot.assetKey, [...images, ...uploaded]);
    }
  }

  function removeImage(index) {
    onChange(slot.assetKey, images.filter((_, i) => i !== index));
  }

  return (
    <div id={`paec-block-${slot.assetKey}`} className="rounded-[10px] border border-slate-200 bg-app-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <AppIcon name="image" className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="m-0 text-sm font-semibold text-slate-700 truncate">{slot.label}</p>
          <span className="text-2xs text-slate-400 shrink-0">{images.length}/{maxImages}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={uploading || remaining <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
          {uploading ? 'Enviando…' : 'Adicionar imagem'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_MIME_TYPES.join(',')}
          multiple
          className="hidden"
          aria-label={`Adicionar imagens em ${slot.label}`}
          onChange={handleFiles}
        />
      </div>

      {images.length === 0 ? (
        <p className="m-0 text-2xs text-slate-400 italic">
          Nenhuma imagem ainda — o documento gerado sai com marcação de pendência neste anexo.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {images.map((mediaId, index) => (
            <div key={mediaId} className="relative group rounded-md overflow-hidden border border-slate-200 aspect-video bg-slate-50">
              <MediaImage
                mediaAssetId={mediaId}
                alt={`${slot.label} — imagem ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <IconButton
                variant="dangerGhost"
                size="sm"
                aria-label={`Remover imagem ${index + 1} de ${slot.label}`}
                className="absolute top-1 right-1 bg-white/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <AppIcon name="trash" className="w-4 h-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
