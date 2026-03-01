import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { calculateCriticality } from '../../shared/rulesConfig';
import { normalizeErosionStatus } from '../../shared/statusUtils';
import {
  deleteErosion,
  postCalculoErosao,
  saveErosion,
  saveErosionManualFollowupEvent,
} from '../../../services/erosionService';
import {
  buildCriticalityInputFromErosion,
  buildErosionReportRows,
  buildErosionsCsv,
  buildImpactSummary,
  deriveErosionTypeFromTechnicalFields,
  filterErosionsForReport,
  normalizeErosionTechnicalFields,
  normalizeFollowupHistory,
  validateErosionLocation,
  validateErosionTechnicalFields,
} from '../utils/erosionUtils';
import {
  hasValidDecimalCoordinates,
  normalizeLocationCoordinates,
  parseCoordinateNumber,
  resolveLocationCoordinatesForSave,
} from '../utils/erosionCoordinates';
import {
  buildBatchErosionFichasPdfDocument,
  buildSingleErosionFichaPdfDocument,
} from '../utils/erosionPdfTemplates';
import ErosionReportPanel from './ErosionReportPanel';
import ErosionCardGrid from './ErosionCardGrid';
import ErosionFormModal from './ErosionFormModal';
import ErosionDetailsModal from './ErosionDetailsModal';
import ErosionConfirmDeleteModal from './ErosionConfirmDeleteModal';

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
  caracteristicasFeicao: [],
  usosSolo: [],
  usoSoloOutro: '',
  saturacaoPorAgua: '',
  tipoSolo: '',
  profundidadeMetros: '',
  declividadeGraus: '',
  distanciaEstruturaMetros: '',
  sinaisAvanco: false,
  vegetacaoInterior: false,
  fotosLinks: [],
  status: 'Ativo',
  obs: '',
  acompanhamentosResumo: [],
};

function getInspectionDateScore(inspection) {
  const candidates = [inspection?.dataFim, inspection?.dataInicio, inspection?.data];
  for (let i = 0; i < candidates.length; i += 1) {
    const date = new Date(candidates[i]);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function normalizeErosionInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || '').trim();
  const list = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const pendencies = Array.isArray(erosion?.pendenciasVistoria) ? erosion.pendenciasVistoria : [];
  const fromPendencies = pendencies.map((item) => String(item?.vistoriaId || '').trim());
  return [...new Set([primary, ...list.map((item) => String(item || '').trim()), ...fromPendencies].filter(Boolean))];
}

function resolvePrimaryInspectionId(inspectionIds, inspections) {
  if (!inspectionIds || inspectionIds.length === 0) return '';
  const inspectionById = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));
  return [...inspectionIds].sort((a, b) => {
    const inspectionA = inspectionById.get(String(a || '').trim());
    const inspectionB = inspectionById.get(String(b || '').trim());
    const dateA = getInspectionDateScore(inspectionA);
    const dateB = getInspectionDateScore(inspectionB);
    if (dateA !== null && dateB !== null) return dateB - dateA;
    if (dateA !== null) return -1;
    if (dateB !== null) return 1;
    return String(b || '').localeCompare(String(a || ''));
  })[0];
}

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
    caracteristicasFeicao: Array.isArray(technical.caracteristicasFeicao) ? technical.caracteristicasFeicao : [],
    usosSolo: Array.isArray(technical.usosSolo) ? technical.usosSolo : [],
    usoSoloOutro: String(technical.usoSoloOutro || '').trim(),
    saturacaoPorAgua: String(technical.saturacaoPorAgua || '').trim(),
    tipoSolo: String(technical.tipoSolo || '').trim(),
    profundidadeMetros: Number.isFinite(technical.profundidadeMetros) ? String(technical.profundidadeMetros) : '',
    declividadeGraus: Number.isFinite(technical.declividadeGraus) ? String(technical.declividadeGraus) : '',
    distanciaEstruturaMetros: Number.isFinite(technical.distanciaEstruturaMetros) ? String(technical.distanciaEstruturaMetros) : '',
    sinaisAvanco: Boolean(technical.sinaisAvanco),
    vegetacaoInterior: Boolean(technical.vegetacaoInterior),
    fotosLinks: sanitizePhotoLinksInput(raw.fotosLinks),
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
  const parsed = parseTowerNumber(raw);
  if (Number.isFinite(parsed)) return parsed === 0 ? 'Portico (T0)' : `Torre ${parsed}`;
  if (raw) return `Torre ${raw}`;
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
  const now = new Date();
  const statusRows = Object.entries(summary.byStatus)
    .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
    .join('');
  const impactRows = Object.entries(summary.byImpact)
    .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
    .join('');

  const sortedRows = [...(rows || [])].sort(compareRowsByTowerAndId);
  let previousTowerGroup = null;
  const tableRows = sortedRows.map((row) => {
    const currentTowerGroup = formatTowerGroupLabel(row?.torreRef);
    const groupRow = currentTowerGroup !== previousTowerGroup
      ? `<tr><td colspan="7" style="background:#e2e8f0;font-weight:700;">Grupo da torre: ${currentTowerGroup}</td></tr>`
      : '';
    previousTowerGroup = currentTowerGroup;

    return `
      ${groupRow}
      <tr>
        <td>${row.id}</td>
        <td>${row.vistoriaId || '-'}</td>
        <td>${row.torreRef || '-'}</td>
        <td>${row['localContexto.localTipoLabel'] || row['localContexto.localTipo'] || '-'}</td>
        <td>${row.status || '-'}</td>
        <td>${row.impacto || '-'}</td>
        <td>${row.ultimaAtualizacao || '-'}</td>
      </tr>
    `;
  }).join('');

  const documentHtml = `
    <html>
      <head>
        <title>Relatorio de Erosoes - ${projectId}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; }
          .meta { margin-bottom: 16px; color: #334155; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h1>Relatorio de Processos Erosivos</h1>
        <div class="meta">
          <div><strong>Empreendimento:</strong> ${projectId}</div>
          <div><strong>Ano(s):</strong> ${selectedYears.length > 0 ? selectedYears.join(', ') : 'Todos'}</div>
          <div><strong>Periodo consolidado:</strong> ${selectedYears.length > 0 ? `${selectedYears[0]}-01-01 ate ${selectedYears[selectedYears.length - 1]}-12-31` : 'Historico completo do empreendimento'}</div>
          <div><strong>Gerado em:</strong> ${now.toLocaleString('pt-BR')}</div>
          <div><strong>Total de erosoes:</strong> ${rows.length}</div>
        </div>
        <div class="grid">
          <div class="box">
            <h3>Totais por status</h3>
            <ul>${statusRows || '<li>Sem dados</li>'}</ul>
          </div>
          <div class="box">
            <h3>Totais por impacto</h3>
            <ul>${impactRows || '<li>Sem dados</li>'}</ul>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Vistoria</th>
              <th>Torre</th>
              <th>Local</th>
              <th>Status</th>
              <th>Impacto</th>
              <th>Atualizacao</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7">Sem dados para o filtro selecionado.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;

  openPrintableWindow(documentHtml);
}

function openPrintableWindow(documentHtml) {
  const win = window.open('', '_blank', 'width=1120,height=820');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };

  const doc = win.document;
  if (typeof doc?.open === 'function') doc.open();
  if (typeof doc?.write === 'function') doc.write(documentHtml);
  if (typeof doc?.close === 'function') doc.close();

  win.onload = () => {
    setTimeout(printOnce, 120);
  };

  // Fallback para navegadores que nao disparam onload como esperado em about:blank.
  setTimeout(printOnce, 450);
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

function ErosionsView({
  erosions = [],
  projects = [],
  inspections = [],
  rulesConfig,
  searchTerm = '',
  pendingDraft = null,
  onDraftConsumed,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(BASE_FORM);
  const [editingId, setEditingId] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [utmErrorToken, setUtmErrorToken] = useState(0);
  const [isCardsVisible, setIsCardsVisible] = useState(false);
  const [isReportPanelCollapsed, setIsReportPanelCollapsed] = useState(true);
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

  const actorName = String(user?.displayName || user?.email || user?.uid || '').trim();

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
    const selectedProjectKey = String(reportFilters.projetoId || '').trim().toLowerCase();
    if (!selectedProjectKey) return [];

    const term = String(searchTerm || '').toLowerCase();
    const base = (erosions || [])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        tipo: deriveErosionTypeFromTechnicalFields(item),
      }))
      .filter((item) => String(item?.projetoId || '').trim().toLowerCase() === selectedProjectKey)
      .sort(compareRowsByTowerAndId);
    if (!term) return base;
    return base.filter((erosion) => String(erosion.id || '').toLowerCase().includes(term)
      || String(erosion.projetoId || '').toLowerCase().includes(term)
      || String(erosion.torreRef || '').toLowerCase().includes(term)
      || String(erosion.impacto || '').toLowerCase().includes(term));
  }, [erosions, reportFilters.projetoId, searchTerm]);

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
    setUtmErrorToken(0);
    setEditingId('');
    setIsFormOpen(true);
  }

  function openEdit(erosion) {
    const safeState = buildSafeErosionFormState(erosion, 'edit', inspections);
    setFormData(safeState);
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
      if (!formData.id || !formData.projetoId) {
        show('Preencha ID e empreendimento.', 'error');
        return;
      }

      const locationValidation = validateErosionLocation(formData);
      if (!locationValidation.ok) {
        show(locationValidation.message, 'error');
        return;
      }

      const photos = sanitizePhotoLinks(formData.fotosLinks);
      const photosValidation = validatePhotoLinks(photos);
      if (!photosValidation.ok) {
        show(photosValidation.message, 'error');
        return;
      }

      const technicalValidation = validateErosionTechnicalFields(formData);
      if (!technicalValidation.ok) {
        show(technicalValidation.message, 'error');
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

      const persisted = erosions.find((item) => item.id === formData.id) || null;
      const mergedInspectionIds = [...new Set([
        ...normalizeErosionInspectionIds(formData),
        ...normalizeErosionInspectionIds(persisted),
      ])];
      const primaryInspectionId = resolvePrimaryInspectionId(mergedInspectionIds, inspections);
      const normalizedTechnicalData = {
        ...formData,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        caracteristicasFeicao: technicalValidation.value.caracteristicasFeicao,
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
      };
      const criticalityInput = buildCriticalityInputFromErosion(normalizedTechnicalData);
      const calculoResponse = await postCalculoErosao(criticalityInput, {
        rulesConfig: rulesConfig?.criticalityV2 || rulesConfig,
      });
      const criticalidadeV2 = calculoResponse.campos_calculados;
      const alertasValidacao = Array.isArray(calculoResponse.alertas_validacao)
        ? calculoResponse.alertas_validacao
        : [];

      if (alertasValidacao.length > 0) {
        const shouldContinue = window.confirm(
          `Foram encontrados alertas tecnicos:\\n\\n- ${alertasValidacao.join('\\n- ')}\\n\\nDeseja salvar mesmo assim?`,
        );
        if (!shouldContinue) return;
      }

      const nextPayload = {
        ...formData,
        tipo: deriveErosionTypeFromTechnicalFields(normalizedTechnicalData),
        status: normalizeErosionStatus(formData.status),
        locationCoordinates: locationResult.locationCoordinates,
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        presencaAguaFundo: technicalValidation.value.presencaAguaFundo,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        caracteristicasFeicao: technicalValidation.value.caracteristicasFeicao,
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
        medidaPreventiva: Array.isArray(criticalidadeV2?.lista_solucoes_sugeridas)
          ? (criticalidadeV2.lista_solucoes_sugeridas[0] || '')
          : '',
        fotosLinks: photos,
        vistoriaId: primaryInspectionId || '',
        vistoriaIds: primaryInspectionId ? mergedInspectionIds : [],
        criticalidadeV2,
        alertsAtivos: alertasValidacao,
      };

      await saveErosion(
        {
          ...nextPayload,
          criticality: criticalidadeV2?.legacy,
        },
        {
          updatedBy: actorName,
          merge: true,
          rulesConfig: rulesConfig?.criticalityV2 || rulesConfig,
        },
      );

      setIsFormOpen(false);
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

    const project = (projects || []).find(
      (item) => String(item?.id || '').trim().toLowerCase() === String(reportFilters.projetoId || '').trim().toLowerCase(),
    ) || null;

    const rows = projectErosions.map((erosion) => ({
      erosion,
      project,
      history: getSortedHistory(erosion),
      relatedInspections: getRelatedInspections(erosion),
    }));

    openBatchErosionFichasPdfWindow({
      projectId: reportFilters.projetoId,
      project,
      rows,
    });
    show('Fichas em lote preparadas para impressao.', 'success');
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
    openErosionDetailsPdfWindow({
      erosion: activeDetailsErosion,
      project: projects.find((project) => project.id === activeDetailsErosion.projetoId),
      history: getSortedHistory(activeDetailsErosion),
      relatedInspections: relatedInspectionsInDetails,
    });
    show('PDF de detalhes preparado para impressao.', 'success');
  }

  const criticality = useMemo(() => {
    try {
      return calculateCriticality(buildCriticalityInputFromErosion(formData || {}), rulesConfig);
    } catch {
      return {
        impacto: 'Baixo',
        score: 0,
        frequencia: '24 meses',
        intervencao: 'Monitoramento visual',
        breakdown: null,
      };
    }
  }, [formData, rulesConfig]);

  return (
    <section className="panel erosions-panel">
      <div className="topbar erosions-topbar">
        <div>
          <h2>Erosoes</h2>
          <p className="muted">Cadastro e acompanhamento dos focos erosivos.</p>
        </div>
        <button type="button" onClick={openNew}>
          <AppIcon name="plus" />
          Nova Erosao
        </button>
      </div>

      <article className="erosions-reading-controls">
        <div className="erosions-reading-actions">
          <label className="erosions-field">
            <span>Empreendimento para leitura</span>
            <div className="erosions-project-dropdown" ref={projectDropdownRef}>
              <button
                type="button"
                className={`erosions-project-dropdown-trigger ${isProjectDropdownOpen ? 'is-open' : ''}`.trim()}
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
                <span className="erosions-project-dropdown-trigger-label">
                  {reportFilters.projetoId ? formatProjectOptionLabel(selectedProject || { id: reportFilters.projetoId, nome: '' }) : 'Selecione...'}
                </span>
                <AppIcon name={isProjectDropdownOpen ? 'close' : 'details'} />
              </button>

              {isProjectDropdownOpen ? (
                <div className="erosions-project-dropdown-menu" role="dialog" aria-label="Selecionar empreendimento">
                  <label className="erosions-project-dropdown-search">
                    <AppIcon name="search" />
                    <input
                      ref={projectDropdownSearchRef}
                      type="search"
                      value={projectSearchTerm}
                      placeholder="Buscar por ID ou nome..."
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                    />
                  </label>

                  <div className="erosions-project-dropdown-options" role="listbox" aria-label="Empreendimentos">
                    <button
                      type="button"
                      className={`erosions-project-dropdown-option ${!reportFilters.projetoId ? 'is-selected' : ''}`.trim()}
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
                          className={`erosions-project-dropdown-option ${isSelected ? 'is-selected' : ''}`.trim()}
                          data-project-id={projectId}
                          onClick={() => handleSelectProjectFromDropdown(projectId)}
                        >
                          {formatProjectOptionLabel(project)}
                        </button>
                      );
                    })}
                    {filteredProjects.length === 0 ? (
                      <div className="erosions-project-dropdown-empty">
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
            className="secondary"
            onClick={() => setIsCardsVisible((prev) => !prev)}
            disabled={!reportFilters.projetoId}
          >
            <AppIcon name={isCardsVisible ? 'close' : 'details'} />
            {isCardsVisible ? 'Ocultar cards' : 'Mostrar cards'}
          </button>
        </div>

        <div className="muted erosions-reading-summary">
          {!reportFilters.projetoId
            ? 'Selecione um empreendimento para iniciar a leitura de erosoes.'
            : (
              isCardsVisible
                ? `Exibindo ${filteredCards.length} erosao(oes) em ${selectedProject?.nome || reportFilters.projetoId}.`
                : `Empreendimento ${selectedProject?.nome || reportFilters.projetoId} selecionado. Cards ocultos.`
            )}
        </div>
      </article>

      {!reportFilters.projetoId ? (
        <article className="erosions-card erosions-card-empty">
          <p className="muted">Selecione um empreendimento para visualizar erosoes.</p>
        </article>
      ) : null}

      {reportFilters.projetoId && !isCardsVisible ? (
        <article className="erosions-card erosions-card-empty">
          <p className="muted">Cards ocultos. Clique em "Mostrar cards" para exibir.</p>
        </article>
      ) : null}

      {reportFilters.projetoId && isCardsVisible ? (
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
          setUtmErrorToken(0);
        }}
        onSave={handleSave}
      />

      <ErosionDetailsModal
        open={!!activeDetailsErosion}
        erosion={activeDetailsErosion}
        project={(projects || []).find((project) => String(project?.id || '').trim() === String(activeDetailsErosion?.projetoId || '').trim())}
        relatedInspections={relatedInspectionsInDetails}
        hasCoordinates={hasCoordinates}
        onClose={() => setDetailsModal(null)}
        onOpenMaps={openGoogleMapsRoute}
        onSaveManualEvent={handleSaveManualHistoryEvent}
        onExportPdf={handleExportDetailsPdf}
      />

      <ErosionConfirmDeleteModal
        open={!!deleteModal}
        erosionId={deleteModal?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal(null)}
      />
    </section>
  );
}

export default ErosionsView;

