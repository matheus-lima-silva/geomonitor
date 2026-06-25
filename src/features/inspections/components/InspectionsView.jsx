import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, EmptyState, IconButton, ListItemSkeleton, Modal, Select } from '../../../components/ui';
import { deleteInspection } from '../../../services/inspectionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import InspectionFormWizardModal from './InspectionFormWizardModal';
import InspectionDetailsModal from './InspectionDetailsModal';
import {
  compareTowerNumbers,
  formatInspectionPeriod,
  getInspectionDayCount,
  getInspectionStatusKey,
  getInspectionStatusMeta,
  isErosionPendingForInspection,
} from '../utils/inspectionWorkflow';

const BASE_FORM = {
  id: '',
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  obs: '',
  detalhesDias: [],
};

const STATUS_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'andamento', label: 'Em andamento' },
  { key: 'planejada', label: 'Planejadas' },
  { key: 'concluida', label: 'Concluidas' },
];

function InspectionsView({
  inspections = [],
  projects = [],
  erosions = [],
  feriados = [],
  forcedProjectFilterId,
  onClearForcedProjectFilter,
  searchTerm,
  planningDraft,
  onPlanningDraftConsumed,
  onOpenErosionDraft,
  loading = false,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formSeedData, setFormSeedData] = useState(BASE_FORM);
  const [suggestedTowerInput, setSuggestedTowerInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [projectFilter, setProjectFilter] = useState(forcedProjectFilterId || '');
  const [statusFilter, setStatusFilter] = useState('todas');

  const actorName = String(user?.nome || user?.displayName || user?.email || user?.uid || '').trim();

  useEffect(() => {
    if (forcedProjectFilterId) setProjectFilter(forcedProjectFilterId);
  }, [forcedProjectFilterId]);

  function handleProjectFilterChange(value) {
    setProjectFilter(value);
    if (forcedProjectFilterId && value !== forcedProjectFilterId) onClearForcedProjectFilter?.();
  }

  const searched = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    return (inspections || [])
      .filter((inspection) => {
        if (projectFilter && String(inspection?.projetoId || '') !== projectFilter) return false;
        if (!t) return true;
        return String(inspection?.id || '').toLowerCase().includes(t)
          || String(inspection?.projetoId || '').toLowerCase().includes(t)
          || String(inspection?.responsavel || '').toLowerCase().includes(t);
      })
      .sort((a, b) => String(b?.dataInicio || '').localeCompare(String(a?.dataInicio || '')));
  }, [inspections, searchTerm, projectFilter]);

  const statusCounts = useMemo(() => {
    const counts = { todas: searched.length, planejada: 0, andamento: 0, concluida: 0 };
    searched.forEach((inspection) => { counts[getInspectionStatusKey(inspection)] += 1; });
    return counts;
  }, [searched]);

  const filtered = useMemo(
    () => (statusFilter === 'todas' ? searched : searched.filter((i) => getInspectionStatusKey(i) === statusFilter)),
    [searched, statusFilter],
  );

  const pendingSummaryByInspection = useMemo(() => {
    const summary = new Map();
    (inspections || []).forEach((inspection) => {
      const inspectionId = String(inspection?.id || '').trim();
      const projectId = String(inspection?.projetoId || '').trim();
      if (!inspectionId || !projectId) {
        if (inspectionId) summary.set(inspectionId, { count: 0, towers: [] });
        return;
      }

      const pending = (erosions || []).filter((erosion) =>
        isErosionPendingForInspection({ erosion, inspection, inspections }));

      const towers = [...new Set(pending.map((item) => String(item?.torreRef || '').trim()).filter(Boolean))]
        .sort(compareTowerNumbers);
      summary.set(inspectionId, { count: pending.length, towers });
    });
    return summary;
  }, [inspections, erosions]);

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
      projetoId: projectFilter || forcedProjectFilterId || '',
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

  const filtersActive = Boolean(projectFilter) || statusFilter !== 'todas';

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-screen-2xl w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-card border border-slate-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800 m-0">Vistorias</h2>
          <p className="text-slate-500 m-0">Diario multi-dia com checklist por torre e fluxo integrado de erosoes.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNewInspection}>
          <AppIcon name="plus" />
          Nova Vistoria
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-white p-4 md:px-6 md:py-5 rounded-xl shadow-card border border-slate-200">
        <div className="w-full lg:max-w-xs">
          <Select label="Empreendimento" value={projectFilter} onChange={(event) => handleProjectFilterChange(event.target.value)}>
            <option value="">Todos os empreendimentos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.id} · {project.nome || project.id}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((item) => {
            const active = statusFilter === item.key;
            const count = statusCounts[item.key] || 0;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(item.key)}
                className={[
                  'inline-flex items-center gap-2 px-3.5 min-h-btn-sm rounded-full border text-xs font-semibold transition-colors cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                  active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:text-slate-800',
                ].join(' ')}
              >
                {item.label}
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-2xs font-bold rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)
        ) : filtered.map((inspection) => {
          const project = projects.find((item) => item.id === inspection.projetoId);
          const pendingSummary = pendingSummaryByInspection.get(inspection.id) || { count: 0, towers: [] };
          const pendingCount = Number(pendingSummary.count || 0);
          const dayCount = getInspectionDayCount(inspection);
          const status = getInspectionStatusMeta(inspection);
          return (
            <article
              key={inspection.id}
              className="group flex flex-col bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden cursor-pointer transition-all hover:border-brand-400 hover:shadow-modal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              role="button"
              tabIndex={0}
              aria-label={`Abrir detalhes de ${inspection.id}`}
              onClick={() => setDetailsModal(inspection)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailsModal(inspection); } }}
            >
              <div className="flex flex-col gap-3 p-5 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 m-0 leading-tight group-hover:text-brand-700 transition-colors">{inspection.id}</h3>
                    <p className="text-xs font-medium text-slate-500 m-0 truncate">
                      {inspection.projetoId || '—'}{project?.nome ? ` · ${project.nome}` : ''}
                    </p>
                  </div>
                  <Badge tone={status.tone} size="sm" className="shrink-0 rounded-full">
                    <AppIcon name={status.icon} className="w-3 h-3" aria-hidden="true" />
                    {status.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
                  {inspection.dataInicio ? (
                    <span className="inline-flex items-center gap-1.5">
                      <AppIcon name="calendar" className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {formatInspectionPeriod(inspection.dataInicio, inspection.dataFim)}
                    </span>
                  ) : null}
                  {dayCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <AppIcon name="clock" className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {dayCount} {dayCount === 1 ? 'dia' : 'dias'}
                    </span>
                  ) : null}
                </div>

                {inspection.responsavel ? (
                  <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <AppIcon name="user" className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    {inspection.responsavel}
                  </div>
                ) : null}

                {pendingCount > 0 ? (
                  <div className="flex flex-col gap-1.5 mt-1 p-3 rounded-lg bg-warning-light border border-warning-border">
                    <span className="text-2xs font-bold uppercase tracking-wide text-yellow-900">Erosoes sem data de visita</span>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingSummary.towers.length > 0 ? pendingSummary.towers.map((tower) => (
                        <span key={tower} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-warning-border text-2xs font-semibold text-yellow-900">
                          Torre {tower}
                        </span>
                      )) : (
                        <span className="text-xs text-yellow-900">{pendingCount} {pendingCount === 1 ? 'erosao pendente' : 'erosoes pendentes'}</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50">
                {pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-900">
                    <AppIcon name="alert" className="w-3.5 h-3.5" aria-hidden="true" />
                    {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800">
                    <AppIcon name="check" className="w-3.5 h-3.5" aria-hidden="true" />
                    Sem pendencias
                  </span>
                )}
                <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                  <IconButton variant="ghost" size="sm" aria-label={`Detalhes de ${inspection.id}`} onClick={() => setDetailsModal(inspection)}>
                    <AppIcon name="details" />
                  </IconButton>
                  <IconButton variant="ghost" size="sm" aria-label={`Editar ${inspection.id}`} onClick={() => openEditInspection(inspection)}>
                    <AppIcon name="edit" />
                  </IconButton>
                  <IconButton variant="dangerGhost" size="sm" aria-label={`Excluir ${inspection.id}`} onClick={() => setConfirmDelete(inspection.id)}>
                    <AppIcon name="trash" />
                  </IconButton>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon="inspections-nav"
          title="Nenhuma vistoria encontrada."
          description={filtersActive ? 'Ajuste os filtros de empreendimento ou status.' : 'Crie a primeira vistoria para comecar o diario de campo.'}
          action={filtersActive ? (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('todas'); handleProjectFilterChange(''); }}>
              <AppIcon name="reset" />
              Limpar filtros
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={openNewInspection}>
              <AppIcon name="plus" />
              Nova Vistoria
            </Button>
          )}
        />
      ) : null}

      {isFormOpen ? (
        <InspectionFormWizardModal
          open={isFormOpen}
          isEditing={isEditing}
          initialData={formSeedData}
          projects={projects}
          inspections={inspections}
          erosions={erosions}
          feriados={feriados}
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
          inspection={inspections.find((i) => i?.id === detailsModal?.id) || detailsModal}
          project={projects.find((project) => project.id === detailsModal.projetoId)}
          erosions={erosions}
          inspections={filtered}
          feriados={feriados}
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
