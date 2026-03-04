import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Modal } from '../../../components/ui';
import { deleteInspection } from '../../../services/inspectionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import InspectionFormWizardModal from './InspectionFormWizardModal';
import InspectionDetailsModal from './InspectionDetailsModal';
import { compareTowerNumbers, getInspectionPendency } from '../utils/inspectionWorkflow';

const BASE_FORM = {
  id: '',
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  obs: '',
  detalhesDias: [],
};

function InspectionsView({
  inspections = [],
  projects = [],
  erosions = [],
  forcedProjectFilterId,
  onClearForcedProjectFilter,
  searchTerm,
  planningDraft,
  onPlanningDraftConsumed,
  onOpenErosionDraft,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formSeedData, setFormSeedData] = useState(BASE_FORM);
  const [suggestedTowerInput, setSuggestedTowerInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);

  const actorName = String(user?.displayName || user?.email || user?.uid || '').trim();

  const filtered = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    return (inspections || []).filter((inspection) => {
      if (forcedProjectFilterId && inspection.projetoId !== forcedProjectFilterId) return false;
      if (!t) return true;
      return String(inspection?.id || '').toLowerCase().includes(t)
        || String(inspection?.projetoId || '').toLowerCase().includes(t)
        || String(inspection?.responsavel || '').toLowerCase().includes(t);
    });
  }, [inspections, forcedProjectFilterId, searchTerm]);

  const pendingSummaryByInspection = useMemo(() => {
    const summary = new Map();
    (inspections || []).forEach((inspection) => {
      const inspectionId = String(inspection?.id || '').trim();
      const projectId = String(inspection?.projetoId || '').trim();
      if (!inspectionId || !projectId) {
        if (inspectionId) summary.set(inspectionId, { count: 0, towers: [] });
        return;
      }

      const pending = (erosions || []).filter((erosion) => {
        if (String(erosion?.projetoId || '').trim() !== projectId) return false;
        const pendency = getInspectionPendency(erosion, inspectionId);
        const hasVisitDate = pendency?.status === 'visitada' && String(pendency?.dia || '').trim();
        return !hasVisitDate;
      });

      const towers = [...new Set(pending.map((item) => String(item?.torreRef || '').trim()).filter(Boolean))]
        .sort(compareTowerNumbers);
      summary.set(inspectionId, { count: pending.length, towers });
    });
    return summary;
  }, [inspections, erosions]);

  const forcedProject = (projects || []).find((project) => project.id === forcedProjectFilterId) || null;

  useEffect(() => {
    if (!planningDraft) return;
    setIsEditing(false);
    setIsFormOpen(true);
    setFormSeedData({
      ...BASE_FORM,
      projetoId: planningDraft.projectId || forcedProjectFilterId || '',
    });
    setSuggestedTowerInput(String(planningDraft.towerInput || '').trim());
    onPlanningDraftConsumed?.();
  }, [planningDraft, forcedProjectFilterId, onPlanningDraftConsumed]);

  function openNewInspection() {
    setIsEditing(false);
    setIsFormOpen(true);
    setSuggestedTowerInput('');
    setFormSeedData({
      ...BASE_FORM,
      projetoId: forcedProjectFilterId || '',
    });
  }

  function openEditInspection(inspection) {
    setIsEditing(true);
    setIsFormOpen(true);
    setSuggestedTowerInput('');
    setFormSeedData({
      ...BASE_FORM,
      ...inspection,
      detalhesDias: Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : [],
    });
  }

  async function handleConfirmDelete() {
    const id = String(confirmDelete || '').trim();
    if (!id) return;
    try {
      await deleteInspection(id);
      setConfirmDelete('');
      show('Vistoria excluida.', 'success');
      if (detailsModal?.id === id) setDetailsModal(null);
    } catch (err) {
      show(err.message || 'Erro ao excluir vistoria.', 'error');
    }
  }

  return (
    <section className="panel inspections-panel">
      <div className="topbar">
        <div>
          <h2>Vistorias</h2>
          <p className="muted">Diario multi-dia com checklist por torre e fluxo integrado de erosoes.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNewInspection}>
          <AppIcon name="plus" />
          Nova Vistoria
        </Button>
      </div>

      {forcedProject ? (
        <div className="notice inspections-filter-notice">
          <span>
            Filtrado por empreendimento: <strong>{forcedProject.nome || forcedProject.id}</strong> ({forcedProject.id})
          </span>
          <Button variant="outline" size="sm" onClick={onClearForcedProjectFilter}>
            <AppIcon name="reset" />
            Limpar filtro
          </Button>
        </div>
      ) : null}

      <div className="inspections-card-list">
        {filtered.map((inspection) => {
          const project = projects.find((item) => item.id === inspection.projetoId);
          const pendingSummary = pendingSummaryByInspection.get(inspection.id) || { count: 0, towers: [] };
          const pendingCount = Number(pendingSummary.count || 0);
          const dayCount = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias.length : 0;
          return (
            <article key={inspection.id} className="inspections-card">
              <div className="inspections-card-head">
                <div className="inspections-card-title-group">
                  <h3>{inspection.id}</h3>
                  <div className="inspections-card-chips">
                    <span className="status-chip">{inspection.projetoId || '-'}</span>
                    {inspection.dataInicio ? <span className="status-chip">{inspection.dataInicio}</span> : null}
                    {dayCount > 0 ? <span className="status-chip status-ok">{dayCount} dia(s)</span> : null}
                    {pendingCount > 0 ? (
                      <span className="status-chip status-warn">
                        {pendingCount} pendente(s)
                      </span>
                    ) : (
                      <span className="status-chip status-ok">Sem pendencias</span>
                    )}
                  </div>
                </div>
                <div className="inspections-card-actions">
                  <Button variant="outline" size="sm" onClick={() => setDetailsModal(inspection)}>
                    <AppIcon name="details" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditInspection(inspection)}>
                    <AppIcon name="edit" />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(inspection.id)}>
                    <AppIcon name="trash" />
                  </Button>
                </div>
              </div>

              <div className="inspections-card-body muted">
                {inspection.responsavel ? <div><strong>Responsavel:</strong> {inspection.responsavel}</div> : null}
                {inspection.dataFim ? <div><strong>Data fim:</strong> {inspection.dataFim}</div> : null}
                {project ? (
                  <div><strong>Empreendimento:</strong> {project.nome || project.id}</div>
                ) : null}
                {pendingCount > 0 ? (
                  <div className="inspections-pending-hint">
                    Erosoes sem data de visita: {pendingSummary.towers.length > 0 ? pendingSummary.towers.join(', ') : '-'}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <article className="project-card">
          <p className="muted">Nenhuma vistoria encontrada.</p>
        </article>
      ) : null}

      {isFormOpen ? (
        <InspectionFormWizardModal
          open={isFormOpen}
          isEditing={isEditing}
          initialData={formSeedData}
          projects={projects}
          inspections={inspections}
          erosions={erosions}
          actorName={actorName}
          suggestedTowerInput={suggestedTowerInput}
          onOpenErosionDraft={onOpenErosionDraft}
          onCancel={() => {
            setIsFormOpen(false);
            setSuggestedTowerInput('');
          }}
          onSaved={() => {
            setIsFormOpen(false);
            setSuggestedTowerInput('');
          }}
        />
      ) : null}

      {detailsModal ? (
        <InspectionDetailsModal
          inspection={detailsModal}
          project={projects.find((project) => project.id === detailsModal.projetoId)}
          erosions={erosions}
          inspections={filtered}
          onClose={() => setDetailsModal(null)}
          onNavigate={(nextInspection) => setDetailsModal(nextInspection)}
        />
      ) : null}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete('')}
        title={
          <span className="flex items-center gap-2">
            <AppIcon name="alert" /> Confirmar exclusão
          </span>
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setConfirmDelete('')}>
              <AppIcon name="close" />
              Cancelar
            </Button>
            <Button variant="danger" size="md" onClick={handleConfirmDelete}>
              <AppIcon name="trash" />
              Excluir
            </Button>
          </>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          Tem certeza que deseja excluir a vistoria <strong>{confirmDelete}</strong>?
        </p>
      </Modal>
    </section>
  );
}

export default InspectionsView;
