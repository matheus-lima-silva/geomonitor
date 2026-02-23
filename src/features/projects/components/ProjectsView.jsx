import { useMemo, useRef } from 'react';
import AppIcon from '../../../components/AppIcon';
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
    <section className="panel">
      <input
        ref={mergeInputRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        className="hidden-input"
        onChange={handleMergeInputChange}
      />
      <input
        ref={createInputRef}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        className="hidden-input"
        onChange={handleCreateInputChange}
      />

      <div className="topbar">
        <div>
          <h2>Empreendimentos</h2>
          <p className="muted">Cadastre e mantenha os dados base das linhas de transmissÃ£o.</p>
        </div>
        <button type="button" onClick={state.openNew}>
          <AppIcon name="plus" />
          Novo
        </button>
      </div>

      <div className="project-cards">
        {filtered.map((p) => {
          const stats = getProjectInspectionStats(p.id, inspections);
          const reportConfig = getProjectReportConfig(p);
          const gpsCount = validateTowerCoordinatesAsString(p.torresCoordenadas || []).rows.filter((r) => !r.error).length;
          const lineCount = Array.isArray(p.linhaCoordenadas) ? p.linhaCoordenadas.length : 0;
          const hasKmlData = gpsCount > 0;
          const hasExportGeometry = gpsCount > 0 || lineCount >= 2;

          return (
            <article key={p.id} className="project-card">
              <header className="project-card-header">
                <div>
                  <h3>{p.nome || p.id}</h3>
                  <small>CÃ³digo: {p.id}</small>
                </div>
                <div className="inline-row">
                  <button type="button" onClick={() => state.openEdit(p)}>
                    <AppIcon name="edit" />
                    Editar
                  </button>
                  <button type="button" className="danger" onClick={() => state.setConfirmDelete(p.id)}>
                    <AppIcon name="trash" />
                    Excluir
                  </button>
                </div>
              </header>

              <div className="muted">
                <div>Vistorias: {stats.count}</div>
                <div>Tempo de vistoria: {stats.spanDays ? `${stats.spanDays} dia(s)` : 'S/D'}</div>
                <div>Dias efetivamente vistoriados: {stats.visitedDays}</div>
                <div>Torres com GPS: {gpsCount}</div>
                <div>Periodicidade: {reportConfig.periodicidadeRelatorio}</div>
                <div>Meses de entrega: {formatReportMonths(reportConfig.mesesEntregaRelatorio)}</div>
              </div>

              <div className={hasKmlData ? 'row-actions two' : 'row-actions one'}>
                <button type="button" className="secondary" onClick={() => onOpenProjectInspections?.(p.id)}>
                  <AppIcon name="clipboard" />
                  Vistorias
                </button>
                {hasKmlData && (
                  <button
                    type="button"
                    onClick={() => {
                      state.setRouteModalProject(p);
                      state.setRouteSelection([]);
                    }}
                  >
                    <AppIcon name="route" />
                    TraÃ§ar rota
                  </button>
                )}
              </div>

              {hasExportGeometry && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => safeRun(() => downloadProjectKml(p))}
                >
                  <AppIcon name="map" />
                  Exportar KML
                </button>
              )}

              {!hasKmlData && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    mergeTargetProjectRef.current = p;
                    mergeInputRef.current?.click();
                  }}
                >
                  <AppIcon name="upload" />
                  Importar KML neste empreendimento
                </button>
              )}
            </article>
          );
        })}
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
