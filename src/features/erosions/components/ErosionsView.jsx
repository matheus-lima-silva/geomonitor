import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { normalizeErosionStatus } from '../../shared/statusUtils';
import {
  deleteErosion,
  postCalculoErosao,
  saveErosion,
  saveErosionManualFollowupEvent,
} from '../../../services/erosionService';
import {
  getCriticalityCode,
  getInspectionDateScore,
  normalizeErosionInspectionIds,
  resolveErosionCriticality,
  resolvePrimaryInspectionId,
} from '../../../../shared/erosionHelpers';
import {
  buildCriticalityInputFromErosion,
  buildErosionReportRows,
  buildErosionsCsv,
  buildImpactSummary,
  deriveErosionTypeFromTechnicalFields,
  filterErosionsForReport,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
  normalizeFollowupHistory,
  validateErosionRequiredFields,
  validateErosionTechnicalFields,
} from '../../shared/viewUtils';
import {
  hasValidDecimalCoordinates,
  normalizeLocationCoordinates,
  parseCoordinateNumber,
  resolveLocationCoordinatesForSave,
} from '../../shared/erosionCoordinates';
import {
  buildBatchErosionFichasPdfDocument,
  buildBatchErosionFichasSimplificadasDocument,
  buildReportPdfDocument,
  buildSingleErosionFichaPdfDocument,
  buildSingleErosionFichaSimplificadaDocument,
  openPrintableWindow,
} from '../utils/erosionPdfTemplates';
import { formatTowerLabel } from '../../projects/utils/kmlUtils';
import { calculateCriticality } from '../../../../backend/utils/criticality';
import ErosionReportPanel from './ErosionReportPanel';
import ErosionCardGrid from './ErosionCardGrid';
import ErosionFormModal from './ErosionFormModal';
import ErosionDetailsModal from './ErosionDetailsModal';
import { Button, ConfirmDeleteModal, Modal } from '../../../components/ui';

const BASE_FORM = {
  id: '',
  projetoId: '',
  vistoriaId: '',
  vistoriaIds: [],
  torreRef: '',
  localContexto: {
    localTipo: '',
    exposicao: '',
    estruturaProxima: '',
    localDescricao: '',
  },
  estagio: '',
  latitude: '',
  longitude: '',
  locationCoordinates: {
    latitude: '',
    longitude: '',
    utmEasting: '',
    utmNorthing: '',
    utmZone: '',
    utmHemisphere: '',
    altitude: '',
    reference: '',
  },
  presencaAguaFundo: '',
  tiposFeicao: [],
  usosSolo: [],
  usoSoloOutro: '',
  saturacaoPorAgua: '',
  tipoSolo: '',
  profundidadeMetros: '',
  declividadeGraus: '',
  distanciaEstruturaMetros: '',
  sinaisAvanco: false,
  vegetacaoInterior: false,
  impactoVia: null,
  dimensionamento: '',
  fotosLinks: [],
  status: 'Ativo',
  registroHistorico: false,
  intervencaoRealizada: '',
  obs: '',
  acompanhamentosResumo: [],
};

function sanitizePhotoLinks(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function validatePhotoLinks(links = []) {
  const invalid = links.find((link) => !/^https?:\/\//i.test(String(link || '').trim()));
  if (!invalid) return { ok: true, message: '' };
  return {
    ok: false,
    message: `Link de foto invalido: ${invalid}`,
  };
}

function sanitizeArrayOfStrings(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function sanitizePhotoLinksInput(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  const text = String(input || '').trim();
  if (!text) return [];
  return text
    .split(/[\n|]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function buildSafeErosionFormState(source, mode = 'new', inspections = []) {
  const raw = source && typeof source === 'object' ? source : {};
  const technical = normalizeErosionTechnicalFields(raw);
  const locationCoordinates = normalizeLocationCoordinates(raw);
  const inspectionIds = normalizeErosionInspectionIds(raw);
  const normalizedInspectionIds = sanitizeArrayOfStrings(inspectionIds);
  const fallbackInspectionId = resolvePrimaryInspectionId(normalizedInspectionIds, inspections);
  const explicitInspectionId = String(raw.vistoriaId || '').trim();
  const primaryInspectionId = explicitInspectionId || fallbackInspectionId;
  const resolvedInspectionIds = primaryInspectionId
    ? [...new Set([primaryInspectionId, ...normalizedInspectionIds])]
    : normalizedInspectionIds;

  const normalizedId = String(raw.id || '').trim();
  const generatedId = mode === 'new' || mode === 'draft' ? `ERS-${Date.now()}` : '';
  const id = normalizedId || generatedId;

  return {
    ...BASE_FORM,
    id,
    projetoId: String(raw.projetoId || '').trim(),
    vistoriaId: primaryInspectionId || '',
    vistoriaIds: resolvedInspectionIds,
    torreRef: String(raw.torreRef || '').trim(),
    localContexto: {
      ...BASE_FORM.localContexto,
      ...(technical.localContexto || {}),
    },
    estagio: String(raw.estagio || '').trim(),
    status: normalizeErosionStatus(raw.status || BASE_FORM.status),
    latitude: locationCoordinates.latitude,
    longitude: locationCoordinates.longitude,
    locationCoordinates: {
      ...BASE_FORM.locationCoordinates,
      ...locationCoordinates,
    },
    obs: String(raw.obs || '').trim(),
    presencaAguaFundo: technical.presencaAguaFundo,
    tiposFeicao: Array.isArray(technical.tiposFeicao) ? technical.tiposFeicao : [],
    usosSolo: Array.isArray(technical.usosSolo) ? technical.usosSolo : [],
    usoSoloOutro: String(technical.usoSoloOutro || '').trim(),
    saturacaoPorAgua: String(technical.saturacaoPorAgua || '').trim(),
    tipoSolo: String(technical.tipoSolo || '').trim(),
    profundidadeMetros: Number.isFinite(technical.profundidadeMetros) ? String(technical.profundidadeMetros) : '',
    declividadeGraus: Number.isFinite(technical.declividadeGraus) ? String(technical.declividadeGraus) : '',
    distanciaEstruturaMetros: Number.isFinite(technical.distanciaEstruturaMetros) ? String(technical.distanciaEstruturaMetros) : '',
    sinaisAvanco: Boolean(technical.sinaisAvanco),
    vegetacaoInterior: Boolean(technical.vegetacaoInterior),
    impactoVia: technical.impactoVia,
    dimensionamento: String(technical.dimensionamento || '').trim(),
    fotosLinks: sanitizePhotoLinksInput(raw.fotosLinks),
    registroHistorico: isHistoricalErosionRecord(raw),
    intervencaoRealizada: String(raw.intervencaoRealizada || '').trim(),
    acompanhamentosResumo: normalizeFollowupHistory(raw.acompanhamentosResumo),
  };
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseTowerNumber(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (/^t-?\d+$/.test(normalized)) {
    const parsed = Number(normalized.slice(1));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (/^-?\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const match = normalized.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTowerGroupLabel(value) {
  const raw = String(value || '').trim();
  if (raw) return formatTowerLabel(raw);
  return 'Torre nao informada';
}

function compareRowsByTowerAndId(a, b) {
  const parsedA = parseTowerNumber(a?.torreRef);
  const parsedB = parseTowerNumber(b?.torreRef);
  const hasNumericA = Number.isFinite(parsedA);
  const hasNumericB = Number.isFinite(parsedB);

  if (hasNumericA && hasNumericB && parsedA !== parsedB) return parsedA - parsedB;
  if (hasNumericA && !hasNumericB) return -1;
  if (!hasNumericA && hasNumericB) return 1;

  const textA = String(a?.torreRef || '').trim().toLowerCase();
  const textB = String(b?.torreRef || '').trim().toLowerCase();
  if (textA !== textB) return textA.localeCompare(textB, 'pt-BR', { sensitivity: 'base', numeric: true });

  return String(a?.id || '').localeCompare(String(b?.id || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
}

function openReportPdfWindow({ projectId, rows, selectedYears }) {
  const summary = buildImpactSummary(rows);
  const documentHtml = buildReportPdfDocument({
    projectId,
    rows,
    selectedYears,
    summary,
  });

  openPrintableWindow(documentHtml);
}

function openErosionDetailsPdfWindow({
  erosion,
  project,
  history,
  relatedInspections,
}) {
  const documentHtml = buildSingleErosionFichaPdfDocument({
    erosion,
    project,
    history,
    relatedInspections,
  });
  openPrintableWindow(documentHtml);
}

function openBatchErosionFichasPdfWindow({
  projectId,
  project,
  rows,
}) {
  const documentHtml = buildBatchErosionFichasPdfDocument({
    projectId,
    project,
    rows,
  });
  openPrintableWindow(documentHtml);
}

function openErosionDetailsSimplificadaPdfWindow({ erosion, project }) {
  const documentHtml = buildSingleErosionFichaSimplificadaDocument({ erosion, project });
  openPrintableWindow(documentHtml);
}

function openBatchErosionFichasSimplificadasPdfWindow({ projectId, project, rows }) {
  const documentHtml = buildBatchErosionFichasSimplificadasDocument({ projectId, project, rows });
  openPrintableWindow(documentHtml);
}

function resolveCriticalityCodeForFilter(erosion) {
  const code = getCriticalityCode(resolveErosionCriticality(erosion));
  if (['C1', 'C2', 'C3', 'C4'].includes(code)) return code;
  const classe = String(erosion?.impacto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (classe.includes('muito alto')) return 'C4';
  if (classe.includes('alto')) return 'C3';
  if (classe.includes('medio')) return 'C2';
  if (classe.includes('baixo')) return 'C1';
  return '';
}

const CRITICALITY_FILTER_LABELS = {
  C1: 'C1 — Baixo',
  C2: 'C2 — Medio',
  C3: 'C3 — Alto',
  C4: 'C4 — Muito Alto',
};

function ErosionsView({
  erosions = [],
  projects = [],
  inspections = [],
  rulesConfig,
  searchTerm = '',
  pendingDraft = null,
  onDraftConsumed,
  criticalityFilter = '',
  onClearCriticalityFilter,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(BASE_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [utmErrorToken, setUtmErrorToken] = useState(0);
  const [isCardsVisible, setIsCardsVisible] = useState(false);
  const [isReportPanelCollapsed, setIsReportPanelCollapsed] = useState(true);
  const [fichaFormatModal, setFichaFormatModal] = useState(null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);
  const projectDropdownSearchRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const [reportFilters, setReportFilters] = useState({
    projetoId: '',
    ano: '',
    mostrarMultiAno: false,
    anosExtras: [],
  });

  const actorName = String(user?.nome || user?.displayName || user?.email || user?.uid || '').trim();

  const selectedProject = useMemo(
    () => (projects || []).find((item) => String(item?.id || '').trim() === String(reportFilters.projetoId || '').trim()) || null,
    [projects, reportFilters.projetoId],
  );

  const filteredProjects = useMemo(() => {
    const term = String(projectSearchTerm || '').trim().toLowerCase();
    if (!term) return projects || [];
    return (projects || []).filter((project) => {
      const id = String(project?.id || '').toLowerCase();
      const name = String(project?.nome || '').toLowerCase();
      return id.includes(term) || name.includes(term);
    });
  }, [projects, projectSearchTerm]);

  const filteredCards = useMemo(() => {
    const activeCritFilter = String(criticalityFilter || '').trim().toUpperCase();
    const selectedProjectKey = String(reportFilters.projetoId || '').trim().toLowerCase();

    if (!activeCritFilter && !selectedProjectKey) return [];

    const term = String(searchTerm || '').toLowerCase();
    const base = (erosions || [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        tipo: deriveErosionTypeFromTechnicalFields(item),
      }))
      .filter((item) => {
        if (activeCritFilter) return resolveCriticalityCodeForFilter(item) === activeCritFilter;
        return String(item?.projetoId || '').trim().toLowerCase() === selectedProjectKey;
      })
      .sort(compareRowsByTowerAndId);
    if (!term) return base;
    return base.filter((erosion) => String(erosion.id || '').toLowerCase().includes(term)
      || String(erosion.projetoId || '').toLowerCase().includes(term)
      || String(erosion.torreRef || '').toLowerCase().includes(term)
      || String(erosion.impacto || '').toLowerCase().includes(term));
  }, [erosions, reportFilters.projetoId, searchTerm, criticalityFilter]);

  const reportYears = useMemo(() => {
    if (!reportFilters.projetoId) return [currentYear];
    const inspectionsById = new Map((inspections || []).map((inspection) => [String(inspection?.id || '').trim(), inspection]));
    const yearsSet = new Set();

    (erosions || []).forEach((item) => {
      const linkedInspectionIds = normalizeErosionInspectionIds(item);
      const fallbackProjectId = linkedInspectionIds
        .map((inspectionId) => inspectionsById.get(inspectionId)?.projetoId)
        .find(Boolean);

      if (String((item?.projetoId || fallbackProjectId || '')).trim().toLowerCase() !== String(reportFilters.projetoId || '').trim().toLowerCase()) return;

      const candidates = [
        item?.ultimaAtualizacao,
        item?.updatedAt,
        item?.createdAt,
        item?.dataCadastro,
        item?.data,
      ];

      linkedInspectionIds.forEach((inspectionId) => {
        const inspection = inspectionsById.get(inspectionId);
        candidates.push(inspection?.dataFim, inspection?.dataInicio, inspection?.data);
      });

      for (let i = 0; i < candidates.length; i += 1) {
        const date = new Date(candidates[i]);
        if (Number.isNaN(date.getTime())) continue;
        yearsSet.add(date.getFullYear());
        break;
      }
    });

    const years = [...yearsSet].sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [erosions, inspections, reportFilters.projetoId, currentYear]);

  const selectedReportYears = useMemo(() => {
    const baseYearText = String(reportFilters.ano || '').trim();
    const hasBaseYear = baseYearText !== '';
    const baseYear = hasBaseYear ? Number(baseYearText) : null;
    const extras = (reportFilters.anosExtras || [])
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 9999 && year !== baseYear);

    if (!reportFilters.mostrarMultiAno) {
      if (!hasBaseYear) return [];
      return [baseYear];
    }

    if (!hasBaseYear) return [...new Set(extras)].sort((a, b) => a - b);
    return [...new Set([baseYear, ...extras])].sort((a, b) => a - b);
  }, [reportFilters]);

  const activeDetailsErosion = useMemo(() => {
    if (!detailsModal) return null;
    return erosions.find((item) => item.id === detailsModal.id) || detailsModal;
  }, [detailsModal, erosions]);

  const relatedInspectionsInDetails = useMemo(() => {
    if (!activeDetailsErosion) return [];
    const ids = normalizeErosionInspectionIds(activeDetailsErosion);
    const inspectionsById = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));
    return ids.map((id) => ({
      id,
      inspection: inspectionsById.get(id) || null,
    }));
  }, [activeDetailsErosion, inspections]);

  useEffect(() => {
    if (!pendingDraft) return;
    const safeState = buildSafeErosionFormState({
      ...pendingDraft,
      id: `ERS-${Date.now()}`,
      obs: pendingDraft.obs || (pendingDraft.origemDia ? `Origem da vistoria (${pendingDraft.origemDia}).` : ''),
    }, 'draft', inspections);
    setFormData(safeState);
    setFormErrors({});
    setUtmErrorToken(0);
    setEditingId('');
    setIsFormOpen(true);
    onDraftConsumed?.();
  }, [pendingDraft, onDraftConsumed, inspections]);

  useEffect(() => {
    if (!isProjectDropdownOpen) return undefined;

    function handlePointerDown(event) {
      if (!projectDropdownRef.current?.contains(event.target)) {
        setIsProjectDropdownOpen(false);
        setProjectSearchTerm('');
      }
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setIsProjectDropdownOpen(false);
      setProjectSearchTerm('');
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProjectDropdownOpen]);

  useEffect(() => {
    if (!isProjectDropdownOpen) return undefined;
    const timer = window.setTimeout(() => {
      projectDropdownSearchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isProjectDropdownOpen]);

  function handleProjectSelectionChange(nextProjectId) {
    const normalizedProjectId = String(nextProjectId || '').trim();
    const hasProjectChanged = String(reportFilters.projetoId || '').trim() !== normalizedProjectId;
    setReportFilters((prev) => ({
      ...prev,
      projetoId: normalizedProjectId,
      ano: hasProjectChanged ? '' : prev.ano,
      mostrarMultiAno: hasProjectChanged ? false : prev.mostrarMultiAno,
      anosExtras: hasProjectChanged ? [] : prev.anosExtras,
    }));
    if (hasProjectChanged) setIsCardsVisible(!!normalizedProjectId);
  }

  function formatProjectOptionLabel(project) {
    const id = String(project?.id || '').trim();
    const name = String(project?.nome || '').trim();
    if (!id && !name) return '-';
    if (!name) return id;
    if (!id) return name;
    return `${id} - ${name}`;
  }

  function handleSelectProjectFromDropdown(nextProjectId) {
    handleProjectSelectionChange(nextProjectId);
    setIsProjectDropdownOpen(false);
    setProjectSearchTerm('');
  }

  function openNew() {
    const safeState = buildSafeErosionFormState({}, 'new', inspections);
    setFormData(safeState);
    setFormErrors({});
    setUtmErrorToken(0);
    setEditingId('');
    setIsFormOpen(true);
  }

  function openEdit(erosion) {
    const safeState = buildSafeErosionFormState(erosion, 'edit', inspections);
    setFormData(safeState);
    setFormErrors({});
    setUtmErrorToken(0);
    setEditingId(String(safeState.id || ''));
    setIsFormOpen(true);
  }

  function hasCoordinates(erosion) {
    return hasValidDecimalCoordinates(erosion);
  }

  function openGoogleMapsRoute(erosion) {
    const coordinates = normalizeLocationCoordinates(erosion || {});
    const latitude = parseCoordinateNumber(coordinates.latitude);
    const longitude = parseCoordinateNumber(coordinates.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      show('Coordenadas invalidas para navegacao.', 'error');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleSave() {
    try {
      const requiredValidation = validateErosionRequiredFields(formData);
      setFormErrors(requiredValidation.fieldErrors);
      if (!requiredValidation.ok) {
        show(requiredValidation.message || 'Preencha os campos obrigatorios destacados.', 'error');
        return;
      }

      const photos = sanitizePhotoLinks(formData.fotosLinks);
      const photosValidation = validatePhotoLinks(photos);
      if (!photosValidation.ok) {
        setFormErrors((prev) => ({ ...prev, fotosLinks: photosValidation.message }));
        show(photosValidation.message, 'error');
        return;
      }

      const locationResult = resolveLocationCoordinatesForSave(formData);
      if (!locationResult.ok) {
        if (String(locationResult.error || '').toLowerCase().includes('utm')) {
          setUtmErrorToken((prev) => prev + 1);
        }
        show(locationResult.error, 'error');
        return;
      }

      const isHistoricalRecord = requiredValidation.historical;
      const technicalValidation = isHistoricalRecord
        ? { ok: true, value: normalizeErosionTechnicalFields(formData) }
        : validateErosionTechnicalFields(formData);
      if (!technicalValidation.ok) {
        show(technicalValidation.message, 'error');
        return;
      }

      const persisted = erosions.find((item) => item.id === formData.id) || null;
      const mergedInspectionIds = [...new Set([
        ...normalizeErosionInspectionIds(formData),
        ...normalizeErosionInspectionIds(persisted),
      ])];
      const primaryInspectionId = resolvePrimaryInspectionId(mergedInspectionIds, inspections);
      const { caracteristicasFeicao: _removedCaracteristicasFeicao, ...cleanFormData } = formData;
      const normalizedTechnicalData = {
        ...cleanFormData,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        usosSolo: technicalValidation.value.usosSolo,
        usoSoloOutro: technicalValidation.value.usoSoloOutro,
        saturacaoPorAgua: technicalValidation.value.saturacaoPorAgua,
        tipoSolo: technicalValidation.value.tipoSolo,
        localContexto: technicalValidation.value.localContexto,
        profundidadeMetros: technicalValidation.value.profundidadeMetros,
        declividadeGraus: technicalValidation.value.declividadeGraus,
        distanciaEstruturaMetros: technicalValidation.value.distanciaEstruturaMetros,
        sinaisAvanco: technicalValidation.value.sinaisAvanco,
        vegetacaoInterior: technicalValidation.value.vegetacaoInterior,
        impactoVia: technicalValidation.value.impactoVia,
        dimensionamento: technicalValidation.value.dimensionamento,
      };
      let criticalidade = null;
      let alertasValidacao = [];

      if (!isHistoricalRecord) {
        const criticalityInput = buildCriticalityInputFromErosion(normalizedTechnicalData);
        const calculoResponse = await postCalculoErosao(criticalityInput, {
          rulesConfig,
        });
        criticalidade = calculoResponse.campos_calculados;
        alertasValidacao = Array.isArray(calculoResponse.alertas_validacao)
          ? calculoResponse.alertas_validacao
          : [];

        if (alertasValidacao.length > 0) {
          const shouldContinue = window.confirm(
            `Foram encontrados alertas tecnicos:\n\n- ${alertasValidacao.join('\n- ')}\n\nDeseja salvar mesmo assim?`,
          );
          if (!shouldContinue) return;
        }
      }

      const nextPayload = {
        ...cleanFormData,
        tipo: deriveErosionTypeFromTechnicalFields(normalizedTechnicalData),
        status: normalizeErosionStatus(formData.status),
        registroHistorico: isHistoricalRecord,
        intervencaoRealizada: String(formData.intervencaoRealizada || '').trim(),
        locationCoordinates: locationResult.locationCoordinates,
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        presencaAguaFundo: technicalValidation.value.presencaAguaFundo,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        usosSolo: technicalValidation.value.usosSolo,
        usoSoloOutro: technicalValidation.value.usoSoloOutro,
        saturacaoPorAgua: technicalValidation.value.saturacaoPorAgua,
        tipoSolo: technicalValidation.value.tipoSolo,
        localContexto: technicalValidation.value.localContexto,
        profundidadeMetros: technicalValidation.value.profundidadeMetros,
        declividadeGraus: technicalValidation.value.declividadeGraus,
        distanciaEstruturaMetros: technicalValidation.value.distanciaEstruturaMetros,
        sinaisAvanco: technicalValidation.value.sinaisAvanco,
        vegetacaoInterior: technicalValidation.value.vegetacaoInterior,
        impactoVia: technicalValidation.value.impactoVia,
        dimensionamento: technicalValidation.value.dimensionamento,
        medidaPreventiva: isHistoricalRecord
          ? ''
          : (Array.isArray(criticalidade?.lista_solucoes_sugeridas)
            ? (criticalidade.lista_solucoes_sugeridas[0] || '')
            : ''),
        fotosLinks: photos,
        vistoriaId: primaryInspectionId || '',
        vistoriaIds: primaryInspectionId ? mergedInspectionIds : [],
        criticalidade: isHistoricalRecord ? null : criticalidade,
        alertsAtivos: isHistoricalRecord ? [] : alertasValidacao,
      };

      await saveErosion(
        nextPayload,
        {
          updatedBy: actorName,
          merge: true,
          rulesConfig,
        },
      );

      setIsFormOpen(false);
      setFormErrors({});
      setUtmErrorToken(0);
      show('Erosao salva com sucesso.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao salvar erosao.', 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteModal?.id) return;
    try {
      await deleteErosion(deleteModal.id);
      setDeleteModal(null);
      if (detailsModal?.id === deleteModal.id) setDetailsModal(null);
      show('Erosao excluida.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao excluir erosao.', 'error');
    }
  }

  function handleExportCsv() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para exportar.', 'error');
      return;
    }

    const filteredRows = filterErosionsForReport(
      erosions,
      {
        ...reportFilters,
        anos: selectedReportYears,
      },
      inspections,
    );

    const rows = buildErosionReportRows(filteredRows);
    const csv = buildErosionsCsv(rows);
    const yearLabel = selectedReportYears.length > 0 ? selectedReportYears.join('-') : 'todos-os-anos';
    const filename = `relatorio-erosoes-${reportFilters.projetoId}-${yearLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    show('CSV exportado com sucesso.', 'success');
  }

  function handleExportPdf() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para exportar.', 'error');
      return;
    }

    try {
      const filteredRows = filterErosionsForReport(
        erosions,
        {
          ...reportFilters,
          anos: selectedReportYears,
        },
        inspections,
      );

      const rows = buildErosionReportRows(filteredRows);
      openReportPdfWindow({
        projectId: reportFilters.projetoId,
        rows,
        selectedYears: selectedReportYears,
      });
      show('PDF preparado para impressao.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao gerar PDF.', 'error');
    }
  }

  function buildPdfRowsByProject(projectId) {
    return filterErosionsForReport(
      erosions,
      {
        projetoId: projectId,
        anos: [],
      },
      inspections,
    )
      .filter((item) => item && typeof item === 'object')
      .sort(compareRowsByTowerAndId);
  }

  function getRelatedInspections(erosion) {
    const ids = normalizeErosionInspectionIds(erosion);
    const inspectionsById = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));
    return ids.map((id) => ({
      id,
      inspection: inspectionsById.get(id) || null,
    }));
  }

  function getSortedHistory(erosion) {
    return normalizeFollowupHistory(erosion?.acompanhamentosResumo)
      .slice()
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  }

  function handlePrintBatchFichasPdf() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para imprimir fichas.', 'error');
      return;
    }

    const projectErosions = buildPdfRowsByProject(reportFilters.projetoId);
    if (projectErosions.length === 0) {
      show('Nenhuma erosao encontrada para o empreendimento selecionado.', 'error');
      return;
    }

    setFichaFormatModal({ mode: 'batch' });
  }

  function executeBatchFichasPdf(formato) {
    setFichaFormatModal(null);
    try {
      const projectErosions = buildPdfRowsByProject(reportFilters.projetoId);
      const project = (projects || []).find(
        (item) => String(item?.id || '').trim().toLowerCase() === String(reportFilters.projetoId || '').trim().toLowerCase(),
      ) || null;

      const rows = projectErosions.map((erosion) => ({
        erosion,
        project,
        history: getSortedHistory(erosion),
        relatedInspections: getRelatedInspections(erosion),
      }));

      if (formato === 'simplificada') {
        openBatchErosionFichasSimplificadasPdfWindow({
          projectId: reportFilters.projetoId,
          project,
          rows,
        });
      } else {
        openBatchErosionFichasPdfWindow({
          projectId: reportFilters.projetoId,
          project,
          rows,
        });
      }
      show('Fichas em lote preparadas para impressao.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao gerar fichas PDF.', 'error');
    }
  }

  async function handleSaveManualHistoryEvent(eventData) {
    if (!activeDetailsErosion) return false;

    try {
      const { manualEvent, nextStatus } = await saveErosionManualFollowupEvent(activeDetailsErosion, eventData, {
        updatedBy: actorName,
        inspections,
      });

      setDetailsModal((prev) => {
        if (!prev) return prev;
        const history = normalizeFollowupHistory(prev.acompanhamentosResumo);
        return {
          ...prev,
          status: nextStatus,
          acompanhamentosResumo: [...history, manualEvent].slice(-100),
        };
      });

      show('Evento registrado no historico.', 'success');
      return true;
    } catch (err) {
      show(err.message || 'Erro ao registrar evento.', 'error');
      return false;
    }
  }

  function handleExportDetailsPdf() {
    if (!activeDetailsErosion) return;
    setFichaFormatModal({ mode: 'single' });
  }

  function executeSingleFichaPdf(formato) {
    setFichaFormatModal(null);
    if (!activeDetailsErosion) return;
    const project = projects.find((p) => p.id === activeDetailsErosion.projetoId);
    if (formato === 'simplificada') {
      openErosionDetailsSimplificadaPdfWindow({
        erosion: activeDetailsErosion,
        project,
      });
    } else {
      openErosionDetailsPdfWindow({
        erosion: activeDetailsErosion,
        project,
        history: getSortedHistory(activeDetailsErosion),
        relatedInspections: relatedInspectionsInDetails,
      });
    }
    show('PDF preparado para impressao.', 'success');
  }

  const criticality = useMemo(() => {
    if (isHistoricalErosionRecord(formData || {})) {
      return {
        impacto: '',
        score: '',
        frequencia: '',
        intervencao: String(formData?.intervencaoRealizada || '').trim(),
        criticalidade: null,
      };
    }
    try {
      return calculateCriticality(buildCriticalityInputFromErosion(formData || {}), rulesConfig);
    } catch {
      return {
        impacto: 'Baixo',
        score: 0,
        frequencia: '24 meses',
        intervencao: 'Monitoramento visual',
        criticalidade: null,
      };
    }
  }, [formData, rulesConfig]);

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800 m-0">Erosoes</h2>
          <p className="text-slate-500 m-0">Cadastro e acompanhamento dos focos erosivos.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-brand-500" onClick={openNew}>
          <AppIcon name="plus" />
          Nova Erosao
        </button>
      </div>

      <article className="flex flex-col gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 min-w-[300px] flex-1">
            <span className="text-sm font-semibold text-slate-700">Empreendimento para leitura</span>
            <div className="relative" ref={projectDropdownRef}>
              <button
                type="button"
                className={`flex items-center justify-between w-full px-3 py-2 bg-white border text-left rounded-lg text-sm transition-all outline-none ${isProjectDropdownOpen ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-300 hover:border-brand-400'}`}
                aria-expanded={isProjectDropdownOpen ? 'true' : 'false'}
                aria-haspopup="listbox"
                onClick={() => {
                  setIsProjectDropdownOpen((prev) => {
                    const nextOpen = !prev;
                    if (!nextOpen) setProjectSearchTerm('');
                    return nextOpen;
                  });
                }}
              >
                <span className="truncate pr-4 text-slate-700">
                  {reportFilters.projetoId ? formatProjectOptionLabel(selectedProject || { id: reportFilters.projetoId, nome: '' }) : 'Selecione...'}
                </span>
                <span className="text-slate-400">
                  <AppIcon name={isProjectDropdownOpen ? 'close' : 'details'} />
                </span>
              </button>

              {isProjectDropdownOpen ? (
                <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-slide-up origin-top" role="dialog" aria-label="Selecionar empreendimento">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-100 text-slate-500">
                    <AppIcon name="search" />
                    <input
                      ref={projectDropdownSearchRef}
                      type="search"
                      className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                      value={projectSearchTerm}
                      placeholder="Buscar por ID ou nome..."
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                    />
                  </label>

                  <div className="max-h-60 overflow-y-auto flex flex-col p-1" role="listbox" aria-label="Empreendimentos">
                    <button
                      type="button"
                      className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${!reportFilters.projetoId ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
                      data-project-id=""
                      onClick={() => handleSelectProjectFromDropdown('')}
                    >
                      Selecione...
                    </button>
                    {filteredProjects.map((project, index) => {
                      const projectId = String(project?.id || '').trim();
                      const isSelected = String(reportFilters.projetoId || '').trim() === projectId;
                      return (
                        <button
                          key={projectId || `project-${index}`}
                          type="button"
                          className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${isSelected ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
                          data-project-id={projectId}
                          onClick={() => handleSelectProjectFromDropdown(projectId)}
                        >
                          {formatProjectOptionLabel(project)}
                        </button>
                      );
                    })}
                    {filteredProjects.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-center italic text-slate-500">
                        Nenhum empreendimento encontrado.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </label>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            onClick={() => setIsCardsVisible((prev) => !prev)}
            disabled={!reportFilters.projetoId}
          >
            <AppIcon name={isCardsVisible ? 'close' : 'details'} />
            {isCardsVisible ? 'Ocultar cards' : 'Mostrar cards'}
          </button>
        </div>

        <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
          {criticalityFilter
            ? `Filtro por criticidade: ${CRITICALITY_FILTER_LABELS[criticalityFilter] || criticalityFilter}. Exibindo ${filteredCards.length} erosao(oes).`
            : !reportFilters.projetoId
              ? 'Selecione um empreendimento para iniciar a leitura de erosoes.'
              : (
                isCardsVisible
                  ? `Exibindo ${filteredCards.length} erosao(oes) em ${selectedProject?.nome || reportFilters.projetoId}.`
                  : `Empreendimento ${selectedProject?.nome || reportFilters.projetoId} selecionado. Cards ocultos.`
              )}
        </div>

        {criticalityFilter ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-blue-800">
              Filtro ativo: {CRITICALITY_FILTER_LABELS[criticalityFilter] || criticalityFilter}
            </span>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition-colors"
              onClick={() => { if (onClearCriticalityFilter) onClearCriticalityFilter(); }}
            >
              <AppIcon name="close" size={12} />
              Limpar filtro
            </button>
          </div>
        ) : null}
      </article>

      {!criticalityFilter && !reportFilters.projetoId ? (
        <article className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
          <p className="text-slate-500 italic m-0">Selecione um empreendimento para visualizar erosoes.</p>
        </article>
      ) : null}

      {!criticalityFilter && reportFilters.projetoId && !isCardsVisible ? (
        <article className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
          <p className="text-slate-500 italic m-0">Cards ocultos. Clique em "Mostrar cards" para exibir.</p>
        </article>
      ) : null}

      {criticalityFilter || (reportFilters.projetoId && isCardsVisible) ? (
        <ErosionCardGrid
          erosions={filteredCards}
          projects={projects}
          hasCoordinates={hasCoordinates}
          onOpenDetails={(erosion) => setDetailsModal(erosion)}
          onOpenEdit={openEdit}
          onRequestDelete={(erosion) => setDeleteModal(erosion)}
          onOpenMaps={openGoogleMapsRoute}
        />
      ) : null}

      <ErosionReportPanel
        reportFilters={reportFilters}
        reportYears={reportYears}
        selectedReportYears={selectedReportYears}
        onSetFilters={setReportFilters}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onPrintBatchFichasPdf={handlePrintBatchFichasPdf}
        collapsed={isReportPanelCollapsed}
        onToggleCollapsed={() => setIsReportPanelCollapsed((prev) => !prev)}
      />

      <ErosionFormModal
        open={isFormOpen}
        isEditing={!!editingId}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        inspections={inspections}
        criticality={criticality}
        utmErrorToken={utmErrorToken}
        onCancel={() => {
          setIsFormOpen(false);
          setFormErrors({});
          setUtmErrorToken(0);
        }}
        onSave={handleSave}
        validationErrors={formErrors}
      />

      <ErosionDetailsModal
        open={!!activeDetailsErosion}
        erosion={activeDetailsErosion}
        project={(projects || []).find((project) => String(project?.id || '').trim() === String(activeDetailsErosion?.projetoId || '').trim())}
        relatedInspections={relatedInspectionsInDetails}
        currentUser={{
          email: String(user?.email || '').trim(),
          nome: String(user?.nome || user?.displayName || '').trim(),
        }}
        hasCoordinates={hasCoordinates}
        onClose={() => setDetailsModal(null)}
        onOpenMaps={openGoogleMapsRoute}
        onSaveManualEvent={handleSaveManualHistoryEvent}
        onExportPdf={handleExportDetailsPdf}
      />

      {deleteModal && (
        <ConfirmDeleteModal
          open={!!deleteModal}
          itemName="a erosão"
          itemId={deleteModal?.id}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      <Modal
        open={!!fichaFormatModal}
        onClose={() => setFichaFormatModal(null)}
        title="Formato da ficha"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-4">Escolha o formato de impressão da ficha de erosão:</p>
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => fichaFormatModal?.mode === 'batch' ? executeBatchFichasPdf('completa') : executeSingleFichaPdf('completa')}
          >
            <AppIcon name="pdf" />
            Ficha Completa
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => fichaFormatModal?.mode === 'batch' ? executeBatchFichasPdf('simplificada') : executeSingleFichaPdf('simplificada')}
          >
            <AppIcon name="pdf" />
            Ficha Simplificada
          </Button>
        </div>
      </Modal>
    </section>
  );
}

export default ErosionsView;
