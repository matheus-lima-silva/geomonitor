import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, IconButton, Input, Select } from '../../../components/ui';
import { useProjectsFeatureState } from '../hooks/useProjectsFeatureState';
import { formatReportMonths, getProjectReportConfig } from '../utils/reportSchedule';
import { validateTowerCoordinatesAsString } from '../utils/kmlUtils';
import { getProjectInspectionStats } from '../utils/projectStats';
import { downloadProjectKml } from '../utils/projectKmlExport';
import ProjectFormModal from './ProjectFormModal';
import KmlReviewModal from './KmlReviewModal';
import KmlLinePickerModal from './KmlLinePickerModal';
import RoutePlannerModal from './RoutePlannerModal';
import { ConfirmDeleteModal } from '../../../components/ui';

function ProjectsView({ projects, inspections, operatingLicenses, userEmail, showToast, reloadProjects, onOpenProjectInspections, searchTerm, editProjectId, onEditProjectHandled }) {
  const mergeInputRef = useRef(null);
  const createInputRef = useRef(null);
  const mergeTargetProjectRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const projectsWithLO = useMemo(() => {
    const coveredIds = new Set();
    (operatingLicenses || []).forEach((lo) => {
      (lo.cobertura || []).forEach((c) => {
        if (c.projetoId) coveredIds.add(String(c.projetoId).toUpperCase());
      });
    });
    return coveredIds;
  }, [operatingLicenses]);

  const state = useProjectsFeatureState({
    projects,
    onSaved: reloadProjects,
    showToast,
    currentUserEmail: userEmail,
  });

  const filtered = useMemo(() => {
    let result = projects || [];
    const global = String(searchTerm || '').toLowerCase();
    if (global) {
      result = result.filter(
        (p) => String(p.id || '').toLowerCase().includes(global) || String(p.nome || '').toLowerCase().includes(global),
      );
    }
    const local = String(localSearch || '').toLowerCase();
    if (local) {
      result = result.filter(
        (p) => String(p.id || '').toLowerCase().includes(local) || String(p.nome || '').toLowerCase().includes(local),
      );
    }
    if (filterTipo) {
      result = result.filter((p) => String(p.tipo || '').toLowerCase() === filterTipo.toLowerCase());
    }
    return result;
  }, [projects, searchTerm, localSearch, filterTipo]);

  useEffect(() => {
    if (!editProjectId) return;
    const project = projects.find((p) => p.id === editProjectId);
    if (project) {
      state.openEdit(project);
      onEditProjectHandled?.();
    }
  }, [editProjectId, projects]);

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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-slate-800 m-0">Empreendimentos</h2>
            <p className="text-slate-500 m-0">Cadastre e mantenha os dados base das linhas de transmissao.</p>
          </div>
          <Button variant="primary" size="sm" onClick={state.openNew}>
            <AppIcon name="plus" />
            Novo
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <Input
              id="projects-search"
              label="Buscar"
              placeholder="Buscar por codigo ou nome..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              id="projects-filter-tipo"
              label="Tipo"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="Linha de Transmissão">Linha de Transmissao</option>
              <option value="Reservatório">Reservatorio</option>
            </Select>
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap pb-2 tabular-nums">
            {filtered.length === (projects || []).length
              ? `${filtered.length} empreendimentos`
              : `${filtered.length} de ${(projects || []).length}`}
          </span>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const stats = getProjectInspectionStats(p.id, inspections);
          const reportConfig = getProjectReportConfig(p);
          const gpsCount = validateTowerCoordinatesAsString(p.torresCoordenadas || []).rows.filter((r) => !r.error).length;
          const lineCount = Array.isArray(p.linhaCoordenadas) ? p.linhaCoordenadas.length : 0;
          const hasKmlData = gpsCount > 0;
          const hasExportGeometry = gpsCount > 0 || lineCount >= 2;
          const missingSchedule = reportConfig.mesesEntregaRelatorio.length === 0;
          const missingLO = !projectsWithLO.has(String(p.id).toUpperCase());
          const hasPendencies = missingSchedule || missingLO;

          return (
            <article key={p.id} className={`flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden ${hasPendencies ? 'border-amber-300' : 'border-slate-200'}`}>
              <header className="flex justify-between items-start p-5 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold text-slate-800 m-0">{p.nome || p.id}</h3>
                  <p className="text-xs font-mono text-slate-500 m-0">Codigo: {p.id}</p>
                  <p className="text-xs text-slate-400 m-0">{p.dataCadastro || 'S/D'}</p>
                </div>
                <div className="flex gap-2">
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar empreendimento ${p.id}`}
                    onClick={() => state.openEdit(p)}
                  >
                    <AppIcon name="edit" size={20} />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hover:text-danger"
                    aria-label={`Excluir empreendimento ${p.id}`}
                    onClick={() => state.setConfirmDelete(p.id)}
                  >
                    <AppIcon name="trash" size={20} />
                  </IconButton>
                </div>
              </header>

              {hasPendencies && (
                <div className="flex flex-wrap gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs font-medium text-amber-800">
                  {missingSchedule && (
                    <span className="inline-flex items-center gap-1">
                      <AppIcon name="alert" size={14} />
                      Sem data de relatorio
                    </span>
                  )}
                  {missingLO && (
                    <span className="inline-flex items-center gap-1">
                      <AppIcon name="alert" size={14} />
                      Sem LO associada
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 px-5 py-4 border-b border-slate-100">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{p.tipo || 'Sem tipo'}</span>
                {p.tensao && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">{p.tensao} kV</span>}
                {p.extensao && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{p.extensao} km</span>}
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
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => onOpenProjectInspections?.(p.id)}
                >
                  <AppIcon name="clipboard" size={18} />
                  Vistorias
                </Button>
                {hasKmlData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="flex-1 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700"
                    onClick={() => {
                      state.setRouteModalProject(p);
                      state.setRouteSelection([]);
                    }}
                  >
                    <AppIcon name="route" size={18} />
                    Tracar rota
                  </Button>
                )}
              </div>

              {!hasKmlData && (
                <div className="px-5 pb-5 bg-slate-50">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full bg-slate-100 hover:bg-slate-200 border-slate-300"
                    onClick={() => {
                      mergeTargetProjectRef.current = p;
                      mergeInputRef.current?.click();
                    }}
                  >
                    <AppIcon name="upload" size={18} />
                    Importar KML neste empreendimento
                  </Button>
                </div>
              )}

              {hasExportGeometry && (
                <div className="px-5 pb-5 bg-slate-50">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full bg-slate-100 hover:bg-slate-200 border-slate-300"
                    onClick={() => safeRun(() => downloadProjectKml(p))}
                  >
                    <AppIcon name="map" size={18} />
                    Exportar KML
                  </Button>
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

      <KmlLinePickerModal
        open={state.kmlLinePickerOpen}
        lines={state.kmlDetectedLines}
        existingProjectIds={projects.map((p) => p.id)}
        onSelect={(lineGroup) => state.selectKmlLine(lineGroup)}
        onBatchCreate={state.kmlPendingMode === 'create' ? (groups) => safeRun(() => state.batchCreateFromKml(groups)) : undefined}
        batchCreating={state.batchCreating}
        onCancel={state.closeKmlLinePicker}
      />

      <RoutePlannerModal
        project={state.routeModalProject}
        routeSelection={state.routeSelection}
        setRouteSelection={state.setRouteSelection}
        onClose={() => state.setRouteModalProject(null)}
      />

      <ConfirmDeleteModal
        open={!!state.confirmDelete}
        itemName="o empreendimento"
        itemId={state.confirmDelete}
        onCancel={() => state.setConfirmDelete(null)}
        onConfirm={() => safeRun(() => state.handleDelete(state.confirmDelete))}
      />
    </section>
  );
}

export default ProjectsView;


