import AppIcon from '../../../components/AppIcon';
import { Button, Modal } from '../../../components/ui';

function ConfirmDeleteModal({ projectId, onCancel, onConfirm }) {
  if (!projectId) return null;

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>Cancelar</Button>
      <Button variant="danger" size="md" onClick={onConfirm}>Excluir</Button>
    </>
  );

  return (
    <Modal
      open={!!projectId}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          <AppIcon name="alert" /> Confirmar exclusão
        </span>
      }
      size="sm"
      footer={footer}
    >
      <p style={{ margin: 0 }}>
        Tem certeza que deseja excluir o empreendimento <strong>{projectId}</strong>?
      </p>
    </Modal>
  );
}

export default ConfirmDeleteModal;
