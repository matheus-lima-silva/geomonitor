import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import Modal from '../../../components/ui/Modal';

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

/**
 * Modal de chamada (handoff) para criar uma erosao a partir de uma foto.
 *
 * Nao recria o formulario de erosao: apenas confirma o contexto (empreendimento,
 * torre, coordenadas, foto) e, ao confirmar, dispara `onConfirm`, que abre o
 * ErosionFormModal existente ja pre-preenchido (metodologia V3 / C1-C4).
 *
 * Props:
 *   open       — controla visibilidade
 *   onClose    — cancelar/fechar
 *   onConfirm  — abre o formulario de erosao pre-preenchido
 *   projectId  — empreendimento de origem
 *   towerRef   — torre de referencia (ex.: "606")
 *   coordsLabel— coordenadas formatadas (ex.: "-23.87901 -46.53111") ou ''
 *   photoId    — id da foto vinculada como evidencia
 */
export default function CreateErosionHandoffModal({
  open,
  onClose,
  onConfirm,
  projectId = '',
  towerRef = '',
  coordsLabel = '',
  photoId = '',
}) {
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
          <Button variant="primary" onClick={onConfirm}>
            <AppIcon name="alert" /> Abrir formulário de erosão
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-app-surfaceMuted px-3 py-3">
          <ContextRow icon="folder-open" label="Empreend." value={projectId} />
          <ContextRow icon="radio-tower" label="Torre" value={towerRef} />
          <ContextRow icon="map-pin" label="Coord." value={coordsLabel} mono />
          <ContextRow icon="image" label="Foto" value={photoId} mono />
        </div>
        <p className="m-0 flex items-start gap-2 rounded-lg border border-slate-200 bg-app-surfaceMuted px-3 py-2.5 text-xs text-slate-600">
          <AppIcon name="info" className="w-4 h-4 mt-0.5 text-brand-600 shrink-0" aria-hidden="true" />
          <span>
            A criticidade (V3 · C1–C4) é preenchida no formulário de erosão, que abre já com
            estes dados e a foto como evidência.
          </span>
        </p>
      </div>
    </Modal>
  );
}
