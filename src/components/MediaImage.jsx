import { useMediaAccessUrl } from '../hooks/useMediaAccessUrl';
import AppIcon from './AppIcon';
import Skeleton from './ui/Skeleton';

// Renderiza <img> resolvendo URL assinada de um media asset (backend local
// ou Tigris) sob demanda. Mostra Skeleton enquanto carrega e um icone
// neutro quando falha.
export default function MediaImage({
  mediaAssetId,
  alt = '',
  className = '',
  fallbackClassName = '',
  onClick,
}) {
  const { url, loading, error } = useMediaAccessUrl(mediaAssetId);

  if (loading) {
    return <Skeleton className={className || 'h-full w-full'} />;
  }

  if (error || !url) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${fallbackClassName || className}`}
        aria-label="Foto indisponivel"
        role="img"
      >
        <AppIcon name="image-off" className="w-6 h-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  );
}
