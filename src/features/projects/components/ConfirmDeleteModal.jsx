function ConfirmDeleteModal({ projectId, onCancel, onConfirm }) {
  if (!projectId) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <h3>Confirmar exclusão</h3>
        <p>Tem certeza que deseja excluir o empreendimento <strong>{projectId}</strong>?</p>
        <div className="row-actions">
          <button type="button" className="danger" onClick={onConfirm}>Excluir</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
