import { useEffect, useMemo, useState } from 'react';
import { createEmptyProject, normalizeProjectPayload } from '../models/projectModel';
import {
  getProjectReportConfig,
  normalizeReportMonths,
  normalizeReportPeriodicity,
  validateReportSchedule,
} from '../utils/reportSchedule';
import { mergeTowerCoordinates, parseKmlTowers, parseKmlTowersFromGroup, detectKmlLines, validateTowerCoordinatesAsString } from '../utils/kmlUtils';
import { deleteProject, saveProject } from '../services/projectService';

const emptyKmlMeta = {
  sigla: '',
  nome: '',
  torres: 0,
  extensao: '',
  lineStringFound: false,
  sourceLabel: '',
  linhaCoordenadas: [],
  linhaNome: '',
  linhaFonteKml: '',
};

const emptyKmlMergeSnapshot = {
  id: '',
  nome: '',
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
  const [kmlLinePickerOpen, setKmlLinePickerOpen] = useState(false);
  const [kmlDetectedLines, setKmlDetectedLines] = useState([]);
  const [kmlPendingText, setKmlPendingText] = useState('');
  const [kmlPendingMode, setKmlPendingMode] = useState('create');
  const [kmlPendingTargetProject, setKmlPendingTargetProject] = useState(null);
  const [kmlPendingFileName, setKmlPendingFileName] = useState('');
  const [batchCreating, setBatchCreating] = useState(false);

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
      linhaCoordenadas: Array.isArray(project.linhaCoordenadas) ? project.linhaCoordenadas : [],
      linhaFonteKml: String(project.linhaFonteKml || ''),
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

    if (mesesEntregaRelatorio.length > 0) {
      const scheduleValidation = validateReportSchedule({
        periodicidadeRelatorio,
        mesesEntregaRelatorio,
        anoBaseBienal,
      });
      if (!scheduleValidation.ok) throw new Error(scheduleValidation.message);
    }

    const torresCoordenadas = Array.isArray(formData.torresCoordenadas) ? formData.torresCoordenadas : [];
    const torres = torresCoordenadas.length > 0
      ? String(torresCoordenadas.length)
      : String(formData.torres || '');

    const payload = normalizeProjectPayload({
      ...formData,
      periodicidadeRelatorio,
      mesesEntregaRelatorio,
      anoBaseBienal,
      torres,
      torresCoordenadas,
      linhaCoordenadas: Array.isArray(formData.linhaCoordenadas) ? formData.linhaCoordenadas : [],
      linhaFonteKml: String(formData.linhaFonteKml || ''),
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

  function _applyParsedKml(parsed, mode, targetProject, fileName, overrides = {}) {
    const parsedMeta = parsed?.meta || emptyKmlMeta;
    const baseId = String(fileName || 'PROJ').replace(/\.[^/.]+$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'PROJ';

    if (mode === 'merge') {
      if (targetProject) openEdit(targetProject);
      const source = targetProject || formData || {};
      setKmlMergeSnapshot({
        id: String(source.id || ''),
        nome: String(source.nome || ''),
        extensao: String(source.extensao || ''),
        torres: String(source.torres || ''),
      });
    } else {
      setKmlMergeSnapshot(emptyKmlMergeSnapshot);
    }

    if (mode === 'create') {
      setIsFormOpen(false);
      setIsEditing(false);
      setCreateFromKmlData({
        ...baseCreateFromKml,
        id: String(overrides.sigla || parsedMeta.sigla || baseId).toUpperCase(),
        nome: String(overrides.nome || parsedMeta.linhaNome || parsedMeta.nome || fileName || 'Empreendimento').replace(/\.[^/.]+$/, ''),
        extensao: String(parsedMeta.extensao || ''),
        torres: String(parsedMeta.torres ?? parsed.rows.length ?? ''),
        tensao: String(overrides.tensao || ''),
      });
    }

    setKmlMeta(parsedMeta);
    setApplyKmlMetadataOnMerge(false);
    setKmlReviewMode(mode);
    setKmlRows(parsed.rows);
    setKmlImportErrors(parsed.errors || []);
    setKmlReviewOpen(true);
  }

  async function parseKmlFile(file, mode, targetProject = null) {
    if (!file) return;
    const text = await file.text();

    const detection = detectKmlLines(text);
    if (detection.isMultiLine) {
      setKmlPendingText(text);
      setKmlPendingMode(mode);
      setKmlPendingTargetProject(targetProject);
      setKmlPendingFileName(file.name || '');
      setKmlDetectedLines(detection.lines);
      setKmlLinePickerOpen(true);
      return;
    }

    const parsed = parseKmlTowers(text);
    _applyParsedKml(parsed, mode, targetProject, file.name);
  }

  function selectKmlLine(lineGroup) {
    const parsed = parseKmlTowersFromGroup(kmlPendingText, lineGroup.folderIndices);
    const overrides = {
      sigla: lineGroup.sigla,
      nome: lineGroup.descriptiveName,
      tensao: lineGroup.tensaoKv,
    };
    _applyParsedKml(parsed, kmlPendingMode, kmlPendingTargetProject, kmlPendingFileName, overrides);
    closeKmlLinePicker();
  }

  async function batchCreateFromKml(lineGroups) {
    if (!kmlPendingText || lineGroups.length === 0) return;
    setBatchCreating(true);
    try {
      let created = 0;
      let skipped = 0;
      for (const group of lineGroups) {
        if (projects.some((p) => p.id === group.sigla.toUpperCase())) {
          skipped += 1;
          continue;
        }
        const parsed = parseKmlTowersFromGroup(kmlPendingText, group.folderIndices);
        const parsedMeta = parsed?.meta || emptyKmlMeta;
        const payload = normalizeProjectPayload({
          id: group.sigla.toUpperCase(),
          nome: group.descriptiveName || parsedMeta.linhaNome || parsedMeta.nome || group.sigla,
          tipo: 'Linha de Transmissão',
          tensao: group.tensaoKv || '',
          extensao: parsedMeta.extensao || '',
          torres: String(parsedMeta.torres ?? parsed.rows.length ?? ''),
          periodicidadeRelatorio: '',
          mesesEntregaRelatorio: [],
          anoBaseBienal: null,
          torresCoordenadas: mergeTowerCoordinates([], parsed.rows),
          linhaCoordenadas: Array.isArray(parsedMeta.linhaCoordenadas) ? parsedMeta.linhaCoordenadas : [],
          linhaFonteKml: String(parsedMeta.linhaFonteKml || ''),
          dataCadastro: new Date().toISOString().split('T')[0],
        });
        await saveProject(payload.id, payload, { updatedBy: currentUserEmail }, { skipRefresh: true });
        created += 1;
      }
      closeKmlLinePicker();
      await onSaved?.();
      const parts = [`${created} empreendimento(s) criado(s)`];
      if (skipped > 0) parts.push(`${skipped} já existente(s)`);
      showToast?.(parts.join(', ') + '.', 'success');
    } catch (e) {
      showToast?.(e.message || 'Erro na criação em lote.', 'error');
    } finally {
      setBatchCreating(false);
    }
  }

  function closeKmlLinePicker() {
    setKmlLinePickerOpen(false);
    setKmlDetectedLines([]);
    setKmlPendingText('');
    setKmlPendingTargetProject(null);
    setKmlPendingFileName('');
  }

  function applyKmlToForm() {
    if (reviewedKml.hasErrors) throw new Error('Existem linhas inválidas no KML. Corrija ou remova antes de aplicar.');
    setFormData((prev) => {
      const next = {
        ...prev,
        torresCoordenadas: mergeTowerCoordinates(prev.torresCoordenadas || [], reviewedKml.rows),
      };

      if (Array.isArray(kmlMeta.linhaCoordenadas) && kmlMeta.linhaCoordenadas.length > 0) {
        next.linhaCoordenadas = kmlMeta.linhaCoordenadas;
        next.linhaFonteKml = String(kmlMeta.linhaFonteKml || '');
      }

      if (applyKmlMetadataOnMerge) {
        next.torres = String(kmlMeta.torres ?? reviewedKml.rows.length ?? '');
        if (kmlMeta.extensao) next.extensao = String(kmlMeta.extensao);
        if (kmlMeta.linhaNome || kmlMeta.nome) next.nome = String(kmlMeta.linhaNome || kmlMeta.nome);
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

    if (mesesEntregaRelatorio.length > 0) {
      const scheduleValidation = validateReportSchedule({
        periodicidadeRelatorio,
        mesesEntregaRelatorio,
        anoBaseBienal,
      });
      if (!scheduleValidation.ok) throw new Error(scheduleValidation.message);
    }

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
      linhaCoordenadas: Array.isArray(kmlMeta.linhaCoordenadas) ? kmlMeta.linhaCoordenadas : [],
      linhaFonteKml: String(kmlMeta.linhaFonteKml || ''),
      dataCadastro: new Date().toISOString().split('T')[0],
    });

    await saveProject(payload.id, payload, { updatedBy: currentUserEmail });
    setIsFormOpen(false);
    setIsEditing(false);
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
    kmlLinePickerOpen,
    kmlDetectedLines,
    selectKmlLine,
    closeKmlLinePicker,
    batchCreateFromKml,
    batchCreating,
    kmlPendingMode,
  };
}
