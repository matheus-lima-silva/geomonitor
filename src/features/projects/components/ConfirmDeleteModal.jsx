import AppIcon from '../../../components/AppIcon';

function ConfirmDeleteModal({ projectId, onCancel, onConfirm }) {
  if (!projectId) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <h3>Confirmar exclusÃ£o</h3>
        <p>Tem certeza que deseja excluir o empreendimento <strong>{projectId}</strong>?</p>
        <div className="row-actions">
          <button type="button" className="danger" onClick={onConfirm}>
            <AppIcon name="trash" />
            Excluir
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            <AppIcon name="close" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
