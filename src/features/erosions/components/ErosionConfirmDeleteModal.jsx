import AppIcon from '../../../components/AppIcon';

function ErosionConfirmDeleteModal({
  open,
  erosionId,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop erosions-delete-backdrop">
      <div className="modal erosions-delete-modal">
        <div className="erosions-delete-head">
          <h3>
            <AppIcon name="alert" />
            Confirmar exclusao
          </h3>
        </div>
        <p className="erosions-delete-message">
          Tem a certeza que deseja excluir a erosao <strong>{erosionId}</strong>?
        </p>
        <div className="erosions-delete-actions">
          <button type="button" className="erosions-delete-btn" onClick={onConfirm}>
            <AppIcon name="trash" />
            Excluir
          </button>
          <button type="button" className="projects-cancel-btn" onClick={onCancel}>
            <AppIcon name="close" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErosionConfirmDeleteModal;
