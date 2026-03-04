import AppIcon from '../../../components/AppIcon';
import { Button, Modal } from '../../../components/ui';

function ErosionConfirmDeleteModal({
  open,
  erosionId,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>
        <AppIcon name="close" />
        Cancelar
      </Button>
      <Button variant="danger" size="md" onClick={onConfirm}>
        <AppIcon name="trash" />
        Excluir
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
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
        Tem certeza que deseja excluir a erosão <strong>{erosionId}</strong>?
      </p>
    </Modal>
  );
}

export default ErosionConfirmDeleteModal;
