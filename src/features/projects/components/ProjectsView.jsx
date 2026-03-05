import { useMemo, useRef } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button } from '../../../components/ui';
import { useProjectsFeatureState } from '../hooks/useProjectsFeatureState';
import { formatReportMonths, getProjectReportConfig } from '../utils/reportSchedule';
import { validateTowerCoordinatesAsString } from '../utils/kmlUtils';
import { getProjectInspectionStats } from '../utils/projectStats';
import { downloadProjectKml } from '../utils/projectKmlExport';
import ProjectFormModal from './ProjectFormModal';
import KmlReviewModal from './KmlReviewModal';
import RoutePlannerModal from './RoutePlannerModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

function ProjectsView({ projects, inspections, userEmail, showToast, reloadProjects, onOpenProjectInspections, searchTerm }) {
  const mergeInputRef = useRef(null);
  const createInputRef = useRef(null);
  const mergeTargetProjectRef = useRef(null);

  const state = useProjectsFeatureState({
    projects,
    onSaved: reloadProjects,
    showToast,
    currentUserEmail: userEmail,
  });

  const filtered = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    if (!t) return projects;
    return projects.filter(
      (p) => String(p.id || '').toLowerCase().includes(t) || String(p.nome || '').toLowerCase().includes(t),
    );
  }, [projects, searchTerm]);

  async function handleMergeInputChange(e) {
    const file = e.target.files?.[0];
    await state.parseKmlFile(file, 'merge', mergeTargetProjectRef.current);
    mergeTargetProjectRef.current = null;
    e.target.value = '';
  }

  async function handleCreateInputChange(e) {
    const file = e.target.files?.[0];
    await state.parseKmlFile(file, 'create', null);
    e.target.value = '';
  }

  async function safeRun(fn) {
    try {
      await fn();
    } catch (e) {
      showToast?.(e.message || 'Erro inesperado', 'error');
    }
  }

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <input
        ref={mergeInputRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        className="hidden"
        onChange={handleMergeInputChange}
      />
      <input
        ref={createInputRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        className="hidden"
        onChange={handleCreateInputChange}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800 m-0">Empreendimentos</h2>
          <p className="text-slate-500 m-0">Cadastre e mantenha os dados base das linhas de transmissao.</p>
        </div>
        <Button variant="primary" size="sm" onClick={state.openNew}>
          <AppIcon name="plus" />
          Novo
        </Button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const stats = getProjectInspectionStats(p.id, inspections);
          const reportConfig = getProjectReportConfig(p);
          const gpsCount = validateTowerCoordinatesAsString(p.torresCoordenadas || []).rows.filter((r) => !r.error).length;
          const lineCount = Array.isArray(p.linhaCoordenadas) ? p.linhaCoordenadas.length : 0;
          const hasKmlData = gpsCount > 0;
          const hasExportGeometry = gpsCount > 0 || lineCount >= 2;

          return (
            <article key={p.id} className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <header className="flex justify-between items-start p-5 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold text-slate-800 m-0">{p.nome || p.id}</h3>
                  <p className="text-xs font-mono text-slate-500 m-0">Codigo: {p.id}</p>
                  <p className="text-xs text-slate-400 m-0">{p.dataCadastro || 'S/D'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-brand-600 transition-colors bg-transparent border-0 p-1 cursor-pointer focus:outline-none"
                    aria-label={`Editar empreendimento ${p.id}`}
                    onClick={() => state.openEdit(p)}
                  >
                    <AppIcon name="edit" size={20} />
                  </button>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600 transition-colors bg-transparent border-0 p-1 cursor-pointer focus:outline-none"
                    aria-label={`Excluir empreendimento ${p.id}`}
                    onClick={() => state.setConfirmDelete(p.id)}
                  >
                    <AppIcon name="trash" size={20} />
                  </button>
                </div>
              </header>

              <div className="flex flex-wrap gap-2 px-5 py-4 border-b border-slate-100">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{p.tipo || 'Sem tipo'}</span>
                {p.tensao && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">{p.tensao} kV</span>}
                {p.extensao && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{p.extensao} km</span>}
              </div>

              <div className="flex flex-col gap-2 p-5 text-sm text-slate-600">
                <div><strong className="text-slate-800">Vistorias:</strong> {stats.count}</div>
                <div><strong className="text-slate-800">Tempo de vistoria:</strong> {stats.spanDays ? `${stats.spanDays} dia(s)` : 'S/D'}</div>
                <div><strong className="text-slate-800">Dias efetivamente vistoriados:</strong> {stats.visitedDays}</div>
                <div><strong className="text-slate-800">Torres com GPS:</strong> {gpsCount}</div>
                <div><strong className="text-slate-800">Periodicidade:</strong> {reportConfig.periodicidadeRelatorio}</div>
                <div><strong className="text-slate-800">Meses de entrega:</strong> {formatReportMonths(reportConfig.mesesEntregaRelatorio)}</div>
                {reportConfig.periodicidadeRelatorio === 'Bienal' && (
                  <div><strong className="text-slate-800">Ano base (bienal):</strong> {reportConfig.anoBaseBienal || 'Nao definido'}</div>
                )}
              </div>

              <div className="flex gap-3 px-5 py-4 bg-slate-50 border-t border-slate-100 mt-auto">
                <button
                  type="button"
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  onClick={() => onOpenProjectInspections?.(p.id)}
                >
                  <AppIcon name="clipboard" size={18} />
                  Vistorias
                </button>
                {hasKmlData && (
                  <button
                    type="button"
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    onClick={() => {
                      state.setRouteModalProject(p);
                      state.setRouteSelection([]);
                    }}
                  >
                    <AppIcon name="route" size={18} />
                    Tracar rota
                  </button>
                )}
              </div>

              {!hasKmlData && (
                <div className="px-5 pb-5 bg-slate-50">
                  <button
                    type="button"
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                    onClick={() => {
                      mergeTargetProjectRef.current = p;
                      mergeInputRef.current?.click();
                    }}
                  >
                    <AppIcon name="upload" size={18} />
                    Importar KML neste empreendimento
                  </button>
                </div>
              )}

              {hasExportGeometry && (
                <div className="px-5 pb-5 bg-slate-50">
                  <button
                    type="button"
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                    onClick={() => safeRun(() => downloadProjectKml(p))}
                  >
                    <AppIcon name="map" size={18} />
                    Exportar KML
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200 border-dashed">Nenhum empreendimento encontrado.</div>
        )}
      </div>

      <ProjectFormModal
        open={state.isFormOpen}
        isEditing={state.isEditing}
        formData={state.formData}
        setFormData={state.setFormData}
        onSave={() => safeRun(state.handleSave)}
        onCancel={state.closeForm}
        onImportKml={() => {
          mergeTargetProjectRef.current = null;
          if (state.isEditing) {
            mergeInputRef.current?.click();
          } else {
            createInputRef.current?.click();
          }
        }}
      />

      <KmlReviewModal
        open={state.kmlReviewOpen}
        mode={state.kmlReviewMode}
        kmlRows={state.kmlRows}
        reviewedKml={state.reviewedKml}
        importErrors={state.kmlImportErrors}
        createFromKmlData={state.createFromKmlData}
        setCreateFromKmlData={state.setCreateFromKmlData}
        kmlMeta={state.kmlMeta}
        kmlMergeSnapshot={state.kmlMergeSnapshot}
        applyKmlMetadataOnMerge={state.applyKmlMetadataOnMerge}
        setApplyKmlMetadataOnMerge={state.setApplyKmlMetadataOnMerge}
        setKmlRows={state.setKmlRows}
        onCancel={state.closeKmlReview}
        onApply={() => safeRun(state.kmlReviewMode === 'create' ? state.createProjectFromKml : state.applyKmlToForm)}
      />

      <RoutePlannerModal
        project={state.routeModalProject}
        routeSelection={state.routeSelection}
        setRouteSelection={state.setRouteSelection}
        onClose={() => state.setRouteModalProject(null)}
      />

      <ConfirmDeleteModal
        projectId={state.confirmDelete}
        onCancel={() => state.setConfirmDelete(null)}
        onConfirm={() => safeRun(() => state.handleDelete(state.confirmDelete))}
      />
    </section>
  );
}

export default ProjectsView;
