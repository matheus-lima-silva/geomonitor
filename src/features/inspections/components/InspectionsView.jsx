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
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800 m-0">Vistorias</h2>
          <p className="text-slate-500 m-0">Diario multi-dia com checklist por torre e fluxo integrado de erosoes.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNewInspection}>
          <AppIcon name="plus" />
          Nova Vistoria
        </Button>
      </div>

      {forcedProject ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mb-2 bg-brand-50 border border-brand-100 rounded-lg text-brand-800 text-sm">
          <span>
            Filtrado por empreendimento: <strong>{forcedProject.nome || forcedProject.id}</strong> ({forcedProject.id})
          </span>
          <Button variant="outline" size="sm" onClick={onClearForcedProjectFilter}>
            <AppIcon name="reset" />
            Limpar filtro
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((inspection) => {
          const project = projects.find((item) => item.id === inspection.projetoId);
          const pendingSummary = pendingSummaryByInspection.get(inspection.id) || { count: 0, towers: [] };
          const pendingCount = Number(pendingSummary.count || 0);
          const dayCount = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias.length : 0;
          return (
            <article key={inspection.id} className="flex flex-col justify-between bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex flex-col gap-3 p-5 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-slate-800 m-0">{inspection.id}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">{inspection.projetoId || '-'}</span>
                    {inspection.dataInicio ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">{inspection.dataInicio}</span> : null}
                    {dayCount > 0 ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">{dayCount} dia(s)</span> : null}
                    {pendingCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                        {pendingCount} pendente(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Sem pendencias</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-1">
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

              <div className="flex flex-col gap-1 p-5 text-sm text-slate-600">
                {inspection.responsavel ? <div><strong className="text-slate-800">Responsavel:</strong> {inspection.responsavel}</div> : null}
                {inspection.dataFim ? <div><strong className="text-slate-800">Data fim:</strong> {inspection.dataFim}</div> : null}
                {project ? (
                  <div><strong className="text-slate-800">Empreendimento:</strong> {project.nome || project.id}</div>
                ) : null}
                {pendingCount > 0 ? (
                  <div className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-100">
                    Erosoes sem data de visita: {pendingSummary.towers.length > 0 ? pendingSummary.towers.join(', ') : '-'}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="col-span-full py-12 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200 border-dashed">
          Nenhuma vistoria encontrada.
        </div>
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
        <p className="text-slate-500" style={{ margin: 0 }}>
          Tem certeza que deseja excluir a vistoria <strong>{confirmDelete}</strong>?
        </p>
      </Modal>
    </section>
  );
}

export default InspectionsView;
