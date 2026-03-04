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
    <section className="panel projects-panel">
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

      <div className="topbar projects-topbar">
        <div className="projects-topbar-copy">
          <h2>Empreendimentos</h2>
          <p className="muted">Cadastre e mantenha os dados base das linhas de transmissao.</p>
        </div>
        <Button variant="primary" size="sm" onClick={state.openNew}>
          <AppIcon name="plus" />
          Novo
        </Button>
      </div>

      <div className="projects-grid">
        {filtered.map((p) => {
          const stats = getProjectInspectionStats(p.id, inspections);
          const reportConfig = getProjectReportConfig(p);
          const gpsCount = validateTowerCoordinatesAsString(p.torresCoordenadas || []).rows.filter((r) => !r.error).length;
          const lineCount = Array.isArray(p.linhaCoordenadas) ? p.linhaCoordenadas.length : 0;
          const hasKmlData = gpsCount > 0;
          const hasExportGeometry = gpsCount > 0 || lineCount >= 2;

          return (
            <article key={p.id} className="projects-card">
              <header className="projects-card-head">
                <div className="projects-card-identity">
                  <h3 className="projects-card-title">{p.nome || p.id}</h3>
                  <p className="projects-card-code">Codigo: {p.id}</p>
                  <p className="projects-card-date">{p.dataCadastro || 'S/D'}</p>
                </div>
                <div className="projects-card-icon-actions">
                  <button
                    type="button"
                    className="projects-icon-btn is-edit"
                    aria-label={`Editar empreendimento ${p.id}`}
                    onClick={() => state.openEdit(p)}
                  >
                    <AppIcon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="projects-icon-btn is-delete"
                    aria-label={`Excluir empreendimento ${p.id}`}
                    onClick={() => state.setConfirmDelete(p.id)}
                  >
                    <AppIcon name="trash" />
                  </button>
                </div>
              </header>

              <div className="projects-chip-row">
                <span className="projects-chip">{p.tipo || 'Sem tipo'}</span>
                {p.tensao && <span className="projects-chip is-tension">{p.tensao} kV</span>}
                {p.extensao && <span className="projects-chip is-distance">{p.extensao} km</span>}
              </div>

              <div className="projects-stats">
                <div><strong>Vistorias:</strong> {stats.count}</div>
                <div><strong>Tempo de vistoria:</strong> {stats.spanDays ? `${stats.spanDays} dia(s)` : 'S/D'}</div>
                <div><strong>Dias efetivamente vistoriados:</strong> {stats.visitedDays}</div>
                <div><strong>Torres com GPS:</strong> {gpsCount}</div>
                <div><strong>Periodicidade:</strong> {reportConfig.periodicidadeRelatorio}</div>
                <div><strong>Meses de entrega:</strong> {formatReportMonths(reportConfig.mesesEntregaRelatorio)}</div>
                {reportConfig.periodicidadeRelatorio === 'Bienal' && (
                  <div><strong>Ano base (bienal):</strong> {reportConfig.anoBaseBienal || 'Nao definido'}</div>
                )}
              </div>

              <div className={`projects-main-actions ${hasKmlData ? 'is-two' : 'is-one'}`}>
                <button
                  type="button"
                  className="projects-main-btn is-neutral"
                  onClick={() => onOpenProjectInspections?.(p.id)}
                >
                  <AppIcon name="clipboard" />
                  Vistorias
                </button>
                {hasKmlData && (
                  <button
                    type="button"
                    className="projects-main-btn is-route"
                    onClick={() => {
                      state.setRouteModalProject(p);
                      state.setRouteSelection([]);
                    }}
                  >
                    <AppIcon name="route" />
                    Tracar rota
                  </button>
                )}
              </div>

              {!hasKmlData && (
                <button
                  type="button"
                  className="projects-secondary-btn is-import"
                  onClick={() => {
                    mergeTargetProjectRef.current = p;
                    mergeInputRef.current?.click();
                  }}
                >
                  <AppIcon name="upload" />
                  Importar KML neste empreendimento
                </button>
              )}

              {hasExportGeometry && (
                <button
                  type="button"
                  className="projects-secondary-btn is-export"
                  onClick={() => safeRun(() => downloadProjectKml(p))}
                >
                  <AppIcon name="map" />
                  Exportar KML
                </button>
              )}
            </article>
          );
        })}

        {filtered.length === 0 && (
          <p className="projects-empty-state">Nenhum empreendimento encontrado.</p>
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
