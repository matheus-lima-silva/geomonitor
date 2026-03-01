import AppIcon from '../../../components/AppIcon';

function ConfirmDeleteModal({ projectId, onCancel, onConfirm }) {
  if (!projectId) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal projects-modal projects-modal-delete">
        <div className="projects-delete-head">
          <h3>
            <AppIcon name="alert" />
            Confirmar exclusao
          </h3>
        </div>

        <p className="projects-delete-message">
          Tem certeza que deseja excluir o empreendimento <strong>{projectId}</strong>?
        </p>

        <div className="projects-delete-actions">
          <button type="button" className="projects-delete-btn" onClick={onConfirm}>
            Excluir
          </button>
          <button type="button" className="projects-cancel-btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
