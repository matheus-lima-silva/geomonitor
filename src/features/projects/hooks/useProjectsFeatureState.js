import { useEffect, useMemo, useState } from 'react';
import { createEmptyProject, normalizeProjectPayload } from '../models/projectModel';
import {
  getProjectReportConfig,
  normalizeReportMonths,
  normalizeReportPeriodicity,
  validateReportSchedule,
} from '../utils/reportSchedule';
import { mergeTowerCoordinates, parseKmlTowers, validateTowerCoordinatesAsString } from '../utils/kmlUtils';
import { deleteProject, saveProject } from '../services/projectService';

const emptyKmlMeta = {
  sigla: '',
  nome: '',
  torres: 0,
  extensao: '',
  lineStringFound: false,
  sourceLabel: '',
};

const emptyKmlMergeSnapshot = {
  id: '',
  extensao: '',
  torres: '',
};

const baseCreateFromKml = {
  id: '',
  nome: '',
  tipo: 'Linha de Transmissão',
  tensao: '',
  extensao: '',
  torres: '',
  periodicidadeRelatorio: 'Anual',
  mesesEntregaRelatorio: [],
  anoBaseBienal: '',
};

export function useProjectsFeatureState({ projects, onSaved, showToast, currentUserEmail }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(createEmptyProject());
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [kmlReviewOpen, setKmlReviewOpen] = useState(false);
  const [kmlReviewMode, setKmlReviewMode] = useState('merge');
  const [kmlRows, setKmlRows] = useState([]);
  const [kmlImportErrors, setKmlImportErrors] = useState([]);
  const [createFromKmlData, setCreateFromKmlData] = useState(baseCreateFromKml);
  const [kmlMeta, setKmlMeta] = useState(emptyKmlMeta);
  const [kmlMergeSnapshot, setKmlMergeSnapshot] = useState(emptyKmlMergeSnapshot);
  const [applyKmlMetadataOnMerge, setApplyKmlMetadataOnMerge] = useState(false);
  const [routeModalProject, setRouteModalProject] = useState(null);
  const [routeSelection, setRouteSelection] = useState([]);

  const reviewedKml = useMemo(() => validateTowerCoordinatesAsString(kmlRows), [kmlRows]);

  useEffect(() => {
    if (!isFormOpen) return;
    const found = projects.find((p) => p.id === formData.id);
    if (!isEditing && found) {
      setFormData((prev) => ({ ...prev, id: '' }));
    }
  }, [projects, formData.id, isEditing, isFormOpen]);

  function openNew() {
    setFormData(createEmptyProject());
    setIsEditing(false);
    setIsFormOpen(true);
  }

  function openEdit(project) {
    const reportConfig = getProjectReportConfig(project);
    setFormData({
      ...createEmptyProject(),
      ...project,
      periodicidadeRelatorio: reportConfig.periodicidadeRelatorio,
      mesesEntregaRelatorio: reportConfig.mesesEntregaRelatorio,
      anoBaseBienal: reportConfig.anoBaseBienal ?? '',
      torresCoordenadas: Array.isArray(project.torresCoordenadas) ? project.torresCoordenadas : [],
    });
    setIsEditing(true);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
  }

  async function handleSave() {
    if (!formData.id || !formData.nome) {
      throw new Error('Preencha ID e Nome');
    }

    const periodicidadeRelatorio = normalizeReportPeriodicity(formData.periodicidadeRelatorio);
    const mesesEntregaRelatorio = normalizeReportMonths(formData.mesesEntregaRelatorio);
    const anoBaseBienal = periodicidadeRelatorio === 'Bienal' ? Number(formData.anoBaseBienal) : null;

    const scheduleValidation = validateReportSchedule({
      periodicidadeRelatorio,
      mesesEntregaRelatorio,
      anoBaseBienal,
    });

    if (!scheduleValidation.ok) throw new Error(scheduleValidation.message);

    const payload = normalizeProjectPayload({
      ...formData,
      periodicidadeRelatorio,
      mesesEntregaRelatorio,
      anoBaseBienal,
      torresCoordenadas: Array.isArray(formData.torresCoordenadas) ? formData.torresCoordenadas : [],
    });

    await saveProject(payload.id, payload, {
      merge: true,
      updatedBy: currentUserEmail,
    });

    setIsFormOpen(false);
    await onSaved?.();
    showToast?.('Empreendimento salvo com sucesso.', 'success');
  }

  async function handleDelete(id) {
    await deleteProject(id);
    setConfirmDelete(null);
    await onSaved?.();
    showToast?.('Empreendimento excluído.', 'success');
  }

  function closeKmlReview() {
    setKmlReviewOpen(false);
    setKmlRows([]);
    setKmlImportErrors([]);
    setKmlMeta(emptyKmlMeta);
    setKmlMergeSnapshot(emptyKmlMergeSnapshot);
    setApplyKmlMetadataOnMerge(false);
  }

  async function parseKmlFile(file, mode, targetProject = null) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseKmlTowers(text);
    const parsedMeta = parsed?.meta || emptyKmlMeta;
    const baseId = String(file.name || 'PROJ').replace(/\.[^/.]+$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'PROJ';

    if (mode === 'merge') {
      if (targetProject) openEdit(targetProject);
      const source = targetProject || formData || {};
      setKmlMergeSnapshot({
        id: String(source.id || ''),
        extensao: String(source.extensao || ''),
        torres: String(source.torres || ''),
      });
    } else {
      setKmlMergeSnapshot(emptyKmlMergeSnapshot);
    }

    if (mode === 'create') {
      setCreateFromKmlData({
        ...baseCreateFromKml,
        id: String(parsedMeta.sigla || baseId).toUpperCase(),
        nome: String(parsedMeta.nome || file.name || 'Empreendimento').replace(/\.[^/.]+$/, ''),
        extensao: String(parsedMeta.extensao || ''),
        torres: String(parsedMeta.torres ?? parsed.rows.length ?? ''),
      });
    }

    setKmlMeta(parsedMeta);
    setApplyKmlMetadataOnMerge(false);
    setKmlReviewMode(mode);
    setKmlRows(parsed.rows);
    setKmlImportErrors(parsed.errors || []);
    setKmlReviewOpen(true);
  }

  function applyKmlToForm() {
    if (reviewedKml.hasErrors) throw new Error('Existem linhas inválidas no KML. Corrija ou remova antes de aplicar.');
    setFormData((prev) => {
      const next = {
        ...prev,
        torresCoordenadas: mergeTowerCoordinates(prev.torresCoordenadas || [], reviewedKml.rows),
      };

      if (applyKmlMetadataOnMerge) {
        next.torres = String(kmlMeta.torres ?? reviewedKml.rows.length ?? '');
        if (kmlMeta.extensao) next.extensao = String(kmlMeta.extensao);
      }

      return next;
    });
    closeKmlReview();
    setIsFormOpen(true);
  }

  async function createProjectFromKml() {
    if (reviewedKml.hasErrors) throw new Error('Existem linhas inválidas no KML.');
    if (!createFromKmlData.id || !createFromKmlData.nome) throw new Error('Preencha ID e Nome para criar o empreendimento por KML.');
    if (projects.some((p) => p.id === createFromKmlData.id)) throw new Error('Já existe um empreendimento com esse ID.');

    const periodicidadeRelatorio = normalizeReportPeriodicity(createFromKmlData.periodicidadeRelatorio);
    const mesesEntregaRelatorio = normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio);
    const anoBaseBienal = periodicidadeRelatorio === 'Bienal' ? Number(createFromKmlData.anoBaseBienal) : null;

    const scheduleValidation = validateReportSchedule({
      periodicidadeRelatorio,
      mesesEntregaRelatorio,
      anoBaseBienal,
    });

    if (!scheduleValidation.ok) throw new Error(scheduleValidation.message);

    const payload = normalizeProjectPayload({
      id: createFromKmlData.id,
      nome: createFromKmlData.nome,
      tipo: createFromKmlData.tipo,
      tensao: createFromKmlData.tensao || '',
      extensao: createFromKmlData.extensao || '',
      torres: createFromKmlData.torres || String(reviewedKml.rows.length),
      periodicidadeRelatorio,
      mesesEntregaRelatorio,
      anoBaseBienal,
      torresCoordenadas: mergeTowerCoordinates([], reviewedKml.rows),
      dataCadastro: new Date().toISOString().split('T')[0],
    });

    await saveProject(payload.id, payload, { updatedBy: currentUserEmail });
    closeKmlReview();
    await onSaved?.();
    showToast?.('Empreendimento criado por KML.', 'success');
  }

  return {
    isFormOpen,
    formData,
    setFormData,
    isEditing,
    confirmDelete,
    setConfirmDelete,
    kmlReviewOpen,
    setKmlReviewOpen,
    kmlReviewMode,
    kmlRows,
    setKmlRows,
    kmlImportErrors,
    createFromKmlData,
    setCreateFromKmlData,
    kmlMeta,
    kmlMergeSnapshot,
    applyKmlMetadataOnMerge,
    setApplyKmlMetadataOnMerge,
    routeModalProject,
    setRouteModalProject,
    routeSelection,
    setRouteSelection,
    reviewedKml,
    openNew,
    openEdit,
    closeForm,
    handleSave,
    handleDelete,
    parseKmlFile,
    applyKmlToForm,
    createProjectFromKml,
    closeKmlReview,
  };
}
