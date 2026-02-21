import { useEffect, useMemo, useState } from 'react';
import InspectionManager from '../../../components/InspectionManager';
import { deleteInspection, saveInspection } from '../../../services/inspectionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

function buildInspectionId(projetoId, dataInicio, inspections = []) {
  if (!projetoId || !dataInicio) return '';

  const [yyyy, mm, dd] = String(dataInicio).split('-');
  if (!yyyy || !mm || !dd) return '';
  const dateTag = `${dd}${mm}${yyyy}`;
  const projectTag = String(projetoId).trim().toUpperCase();
  const prefix = `VS-${projectTag}-${dateTag}-`;
  const pattern = new RegExp(`^${prefix}(\\d{4})$`);

  let maxSeq = 0;
  (inspections || []).forEach((ins) => {
    const match = String(ins.id || '').match(pattern);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

const baseForm = {
  id: '',
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  obs: '',
  detalhesDias: [],
};

function InspectionsView({
  inspections,
  projects,
  forcedProjectFilterId,
  onClearForcedProjectFilter,
  searchTerm,
  planningDraft,
  onPlanningDraftConsumed,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(baseForm);
  const [detailsModal, setDetailsModal] = useState(null);

  const filtered = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    return inspections.filter((i) => {
      if (forcedProjectFilterId && i.projetoId !== forcedProjectFilterId) return false;
      if (!t) return true;
      return String(i.id || '').toLowerCase().includes(t)
        || String(i.projetoId || '').toLowerCase().includes(t)
        || String(i.responsavel || '').toLowerCase().includes(t);
    });
  }, [inspections, forcedProjectFilterId, searchTerm]);

  const forcedProject = projects.find((p) => p.id === forcedProjectFilterId);

  useEffect(() => {
    if (!isFormOpen || isEditing) return;
    const generatedId = buildInspectionId(formData.projetoId, formData.dataInicio, inspections);
    if (!generatedId || generatedId === formData.id) return;
    setFormData((prev) => ({ ...prev, id: generatedId }));
  }, [isFormOpen, isEditing, formData.projetoId, formData.dataInicio, inspections, formData.id]);

  function openNew() {
    setFormData({ ...baseForm, projetoId: forcedProjectFilterId || '' });
    setIsEditing(false);
    setIsFormOpen(true);
  }

  function openEdit(i) {
    setFormData({
      ...baseForm,
      ...i,
      detalhesDias: Array.isArray(i.detalhesDias) ? i.detalhesDias : [],
    });
    setIsEditing(true);
    setIsFormOpen(true);
  }

  async function handleSave() {
    try {
      if (!formData.id || !formData.projetoId || !formData.dataInicio) {
        show('Preencha ID, empreendimento e data de início.', 'error');
        return;
      }
      if (formData.dataFim && formData.dataFim < formData.dataInicio) {
        show('Data fim não pode ser anterior à data início.', 'error');
        return;
      }

      await saveInspection({
        ...formData,
        dataFim: formData.dataFim || formData.dataInicio,
        status: formData.status || 'aberta',
        detalhesDias: Array.isArray(formData.detalhesDias) ? formData.detalhesDias : [],
      }, { merge: true, updatedBy: user?.email });

      setIsFormOpen(false);
      show('Vistoria salva com sucesso.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao salvar vistoria.', 'error');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Excluir vistoria ${id}?`)) return;
    await deleteInspection(id);
    show('Vistoria excluída.', 'success');
  }

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Vistorias</h2>
          <p className="muted">Diário multi-dia e checklist por torre.</p>
        </div>
        <button type="button" onClick={openNew}>Nova Vistoria</button>
      </div>

      {forcedProject && (
        <div className="notice">
          Filtrado por empreendimento: <strong>{forcedProject.nome || forcedProject.id}</strong>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={onClearForcedProjectFilter}>Limpar filtro</button>
          </div>
        </div>
      )}

      <InspectionManager
        projects={projects}
        planningDraft={planningDraft}
        onPlanningDraftConsumed={onPlanningDraftConsumed}
      />

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Projeto</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Responsável</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>{i.projetoId}</td>
                <td>{i.dataInicio || '-'}</td>
                <td>{i.dataFim || '-'}</td>
                <td>{i.responsavel || '-'}</td>
                <td>
                  <div className="inline-row">
                    <button type="button" className="secondary" onClick={() => setDetailsModal(i)}>Detalhes</button>
                    <button type="button" className="secondary" onClick={() => openEdit(i)}>Editar</button>
                    <button type="button" className="danger" onClick={() => handleDelete(i.id)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="muted">Nenhuma vistoria encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>{isEditing ? 'Editar' : 'Nova'} Vistoria</h3>
            <div className="grid-form">
              <input value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} disabled={!isEditing} placeholder="ID" />
              <select value={formData.projetoId} onChange={(e) => setFormData({ ...formData, projetoId: e.target.value })}>
                <option value="">Empreendimento...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.nome}</option>)}
              </select>
              <input type="date" value={formData.dataInicio} onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })} />
              <input type="date" value={formData.dataFim || ''} onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })} />
              <input value={formData.responsavel || ''} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} placeholder="Responsável" />
              <input value={formData.obs || ''} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} placeholder="Observações" />
            </div>
            <div className="row-actions">
              <button type="button" onClick={handleSave}>Salvar</button>
              <button type="button" className="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>Detalhes da Vistoria</h3>
            <div className="muted">
              <div><strong>ID:</strong> {detailsModal.id}</div>
              <div><strong>Empreendimento:</strong> {detailsModal.projetoId}</div>
              <div><strong>Início:</strong> {detailsModal.dataInicio || '-'}</div>
              <div><strong>Fim:</strong> {detailsModal.dataFim || '-'}</div>
              <div><strong>Responsável:</strong> {detailsModal.responsavel || '-'}</div>
              <div><strong>Observações:</strong> {detailsModal.obs || '-'}</div>
              <div><strong>Dias registados:</strong> {Array.isArray(detailsModal.detalhesDias) ? detailsModal.detalhesDias.length : 0}</div>
            </div>
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setDetailsModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default InspectionsView;
