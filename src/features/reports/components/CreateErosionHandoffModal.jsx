import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';
import { formatPhotoDistanceLabel } from '../utils/reportUtils';

function ContextRow({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AppIcon name={icon} className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" aria-hidden="true" />
      <span className="text-slate-500 min-w-[84px] shrink-0">{label}</span>
      <span className={`text-slate-800 font-semibold break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '-'}
      </span>
    </div>
  );
}

function formatPoint(point) {
  if (!Array.isArray(point) || point.length < 2) return '';
  const lat = Number(point[0]);
  const lon = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(6)} ${lon.toFixed(6)}`;
}

function isValidPoint(point) {
  return formatPoint(point) !== '';
}

// Fonte padrao do ponto inicial da erosao: a torre cadastrada (coordenada
// absoluta, que nao muda). O GPS da foto e uma fonte opcional, para quando a
// foto foi tirada em cima da erosao.
export function resolveDefaultPointSource({ towerPoint, photoPoint } = {}) {
  if (isValidPoint(towerPoint)) return 'tower';
  if (isValidPoint(photoPoint)) return 'photo';
  return 'tower';
}

/**
 * Modal de chamada (handoff) para criar uma erosao a partir de uma foto.
 *
 * Nao recria o formulario de erosao: apenas confirma o contexto (empreendimento,
 * torre, coordenadas, foto), deixa escolher a fonte do ponto inicial da erosao
 * (torre cadastrada ou GPS da foto) e, ao confirmar, dispara `onConfirm`, que
 * abre o ErosionFormModal existente ja pre-preenchido (metodologia V3 / C1-C4).
 *
 * Props:
 *   open           — controla visibilidade
 *   onClose        — cancelar/fechar
 *   onConfirm      — `({ pointSource: 'tower' | 'photo' })` abre o formulario pre-preenchido
 *   projectId      — empreendimento de origem
 *   towerRef       — torre de referencia (ex.: "606")
 *   towerPoint     — `[lat, lon]` da torre cadastrada ou null
 *   photoPoint     — `[lat, lon]` do GPS da foto ou null
 *   distanceMeters — distancia foto -> torre (opcional; calculada dos pontos se ausente)
 *   photoId        — id da foto vinculada como evidencia
 */
export default function CreateErosionHandoffModal({
  open,
  onClose,
  onConfirm,
  projectId = '',
  towerRef = '',
  towerPoint = null,
  photoPoint = null,
  distanceMeters = null,
  photoId = '',
}) {
  const hasTowerPoint = isValidPoint(towerPoint);
  const hasPhotoPoint = isValidPoint(photoPoint);
  const [pointSource, setPointSource] = useState(() => resolveDefaultPointSource({ towerPoint, photoPoint }));

  useEffect(() => {
    if (!open) return;
    setPointSource(resolveDefaultPointSource({ towerPoint, photoPoint }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photoId]);

  const distanceLabel = hasTowerPoint && hasPhotoPoint
    ? formatPhotoDistanceLabel(distanceMeters, towerPoint, photoPoint)
    : '';
  const photoPointLabel = hasPhotoPoint
    ? `${formatPoint(photoPoint)}${distanceLabel ? ` (${distanceLabel})` : ''}`
    : 'Foto sem GPS';
  const selectedLabel = pointSource === 'photo' ? 'GPS da foto' : 'Torre cadastrada';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon="alert"
      title="Criar erosão"
      subtitle={towerRef ? `Torre ${towerRef} · a partir desta foto` : 'A partir desta foto'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            <AppIcon name="close" /> Cancelar
          </Button>
          <Button variant="primary" onClick={() => onConfirm?.({ pointSource })}>
            <AppIcon name="alert" /> Abrir formulário de erosão
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-app-surfaceMuted px-3 py-3">
          <ContextRow icon="folder-open" label="Empreend." value={projectId} />
          <ContextRow icon="radio-tower" label="Torre" value={towerRef} />
          <ContextRow icon="map-pin" label="Coord. torre" value={hasTowerPoint ? formatPoint(towerPoint) : 'Sem coordenada'} mono />
          <ContextRow icon="camera" label="GPS da foto" value={photoPointLabel} mono />
          <ContextRow icon="image" label="Foto" value={photoId} mono />
        </div>

        <div className="flex flex-col gap-2" data-testid="erosion-handoff-point-source">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ponto inicial da erosão</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ponto inicial da erosão">
            <Button
              type="button"
              size="sm"
              variant={pointSource === 'tower' ? 'primary' : 'outline'}
              aria-pressed={pointSource === 'tower'}
              disabled={!hasTowerPoint}
              onClick={() => setPointSource('tower')}
            >
              <AppIcon name="radio-tower" /> Torre cadastrada
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pointSource === 'photo' ? 'primary' : 'outline'}
              aria-pressed={pointSource === 'photo'}
              disabled={!hasPhotoPoint}
              title={hasPhotoPoint ? 'Use quando a foto foi tirada em cima da erosão.' : 'Foto sem GPS'}
              onClick={() => setPointSource('photo')}
            >
              <AppIcon name="camera" /> GPS da foto
            </Button>
          </div>
          <span className="text-xs text-slate-500">
            {pointSource === 'photo'
              ? 'Use quando a foto foi tirada em cima da erosão. A torre continua como referência.'
              : 'A coordenada da torre é a referência padrão; troque para o GPS da foto se ela foi tirada em cima da erosão.'}
          </span>
        </div>

        <p className="m-0 flex items-start gap-2 rounded-lg border border-slate-200 bg-app-surfaceMuted px-3 py-2.5 text-xs text-slate-600">
          <AppIcon name="info" className="w-4 h-4 mt-0.5 text-brand-600 shrink-0" aria-hidden="true" />
          <span>
            O formulário abre com o ponto escolhido ({selectedLabel}) e esta foto como evidência;
            dá para trocar o ponto no mapa depois. A criticidade (V3 · C1–C4) é preenchida lá.
          </span>
        </p>
      </div>
    </Modal>
  );
}
