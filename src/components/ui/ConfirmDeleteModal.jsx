import AppIcon from '../AppIcon';
import Modal from './Modal';
import Button from './Button';

function ConfirmDeleteModal({
  open,
  itemName = 'o item',
  itemId,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>
        <AppIcon name="close" /> Cancelar
      </Button>
      <Button variant="danger" size="md" onClick={onConfirm}>
        <AppIcon name="trash" /> Excluir
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
        Tem certeza que deseja excluir {itemName} <strong>{itemId}</strong>?
      </p>
    </Modal>
  );
}

export default ConfirmDeleteModal;
