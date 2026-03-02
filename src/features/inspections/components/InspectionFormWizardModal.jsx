import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '../../../components/AppIcon';
import { saveInspection } from '../../../services/inspectionService';
import { postCalculoErosao, saveErosion } from '../../../services/erosionService';
import { useToast } from '../../../context/ToastContext';
import { gerarPeriodoDias, preservarDetalhesDias } from '../../../utils/dateUtils';
import { parseTowerInput } from '../../../utils/parseTowerInput';
import {
  buildCriticalityInputFromErosion,
  deriveErosionTypeFromTechnicalFields,
  normalizeErosionTechnicalFields,
  validateErosionLocation,
  validateErosionTechnicalFields,
} from '../../shared/viewUtils';
import {
  isCompleteUtmCoordinates,
  isPartialUtmCoordinates,
  normalizeLocationCoordinates,
  parseCoordinateNumber,
  resolveLocationCoordinatesForSave,
} from '../../shared/erosionCoordinates';
import ErosionTechnicalFields from '../../erosions/components/ErosionTechnicalFields';
import { buildHotelHistory, extractHotelFields, findPreviousDayHotel } from '../utils/hotelHistory';
import {
  buildInspectionId,
  compareTowerNumbers,
  ensurePendingTowersVisibleInDays,
  findDuplicateTowersAcrossDays,
  getInspectionPendency,
  getPendingErosionsForInspection,
  isBrDateValid,
  normalizeLinkedInspectionIds,
  toBrDate,
  upsertInspectionPendency,
} from '../utils/inspectionWorkflow';

const BASE_FORM = {
  id: '',
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  obs: '',
  status: 'aberta',
  detalhesDias: [],
};

const EMPTY_EROSION_FORM = {
  estagio: '',
  status: 'Ativo',
  localContexto: {
    localTipo: '',
    exposicao: '',
    estruturaProxima: '',
    localDescricao: '',
  },
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
  descricao: '',
};

function sanitizeInlineStringArray(input) {
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

function buildSafeInlineErosionFormState(source = {}) {
  const raw = source && typeof source === 'object' ? source : {};
  const locationCoordinates = normalizeLocationCoordinates(raw);
  const technical = normalizeErosionTechnicalFields(raw);

  return {
    ...EMPTY_EROSION_FORM,
    estagio: String(raw.estagio || '').trim(),
    status: String(raw.status || 'Ativo').trim() || 'Ativo',
    localContexto: {
      ...EMPTY_EROSION_FORM.localContexto,
      ...(technical.localContexto || {}),
    },
    locationCoordinates: {
      ...EMPTY_EROSION_FORM.locationCoordinates,
      ...locationCoordinates,
    },
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
    fotosLinks: sanitizeInlineStringArray(raw.fotosLinks),
    descricao: String(raw.obs || raw.descricao || '').trim(),
  };
}

function formatTowerLabel(towerRef) {
  const ref = String(towerRef ?? '').trim();
  if (!ref) return 'Nao informado';
  if (ref === '0') return 'Portico (T0)';
  return `Torre ${ref}`;
}

function hasAnyLocationValue(locationCoordinates = {}) {
  return [
    locationCoordinates.latitude,
    locationCoordinates.longitude,
    locationCoordinates.utmEasting,
    locationCoordinates.utmNorthing,
    locationCoordinates.utmZone,
    locationCoordinates.utmHemisphere,
    locationCoordinates.altitude,
    locationCoordinates.reference,
  ].some((value) => String(value || '').trim() !== '');
}

function getInlineCoordinatesStatus(locationCoordinates = {}) {
  if (isCompleteUtmCoordinates(locationCoordinates)) return 'UTM completo';
  if (isPartialUtmCoordinates(locationCoordinates)) return 'UTM incompleto';
  const latitude = parseCoordinateNumber(locationCoordinates.latitude);
  const longitude = parseCoordinateNumber(locationCoordinates.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return 'Decimal';
  return 'Nao preenchido';
}

function getDateScore(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

function getLatestLinkedErosion(erosions = [], projectId = '', towerNumber = '') {
  return (erosions || [])
    .filter((item) =>
      String(item?.projetoId || '').trim() === String(projectId || '').trim()
      && String(item?.torreRef || '').trim() === String(towerNumber || '').trim())
    .sort((a, b) => {
      const aScore = Math.max(
        getDateScore(a?.ultimaAtualizacao),
        getDateScore(a?.updatedAt),
        getDateScore(a?.createdAt),
        getDateScore(a?.dataCadastro),
        getDateScore(a?.data),
      );
      const bScore = Math.max(
        getDateScore(b?.ultimaAtualizacao),
        getDateScore(b?.updatedAt),
        getDateScore(b?.createdAt),
        getDateScore(b?.dataCadastro),
        getDateScore(b?.data),
      );
      if (aScore !== bScore) return bScore - aScore;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    })[0] || null;
}

function ensureDayShape(day) {
  const sourceInput = String(day?.torresInput ?? day?.torres ?? '').trim();
  const torresArray = Array.isArray(day?.torres)
    ? day.torres
    : parseTowerInput(sourceInput);
  const torresDetalhadasRaw = Array.isArray(day?.torresDetalhadas)
    ? day.torresDetalhadas
    : torresArray.map((numero) => ({ numero, obs: '', temErosao: false }));
  const torresDetalhadas = torresDetalhadasRaw
    .map((tower) => ({
      numero: String(tower?.numero || '').trim(),
      obs: String(tower?.obs || '').trim(),
      temErosao: !!tower?.temErosao,
    }))
    .filter((tower) => tower.numero)
    .sort((a, b) => compareTowerNumbers(a.numero, b.numero));
  const normalizedTowerNumbers = torresDetalhadas.map((tower) => tower.numero);
  const hotelTorreBaseRaw = String(day?.hotelTorreBase || '').trim();
  const hotelTorreBase = normalizedTowerNumbers.includes(hotelTorreBaseRaw) ? hotelTorreBaseRaw : '';

  return {
    data: String(day?.data || '').trim(),
    clima: String(day?.clima || '').trim(),
    torres: normalizedTowerNumbers,
    torresInput: normalizedTowerNumbers.join(', '),
    torresDetalhadas,
    hotelNome: String(day?.hotelNome ?? ''),
    hotelMunicipio: String(day?.hotelMunicipio ?? ''),
    hotelLogisticaNota: String(day?.hotelLogisticaNota ?? '').trim(),
    hotelReservaNota: String(day?.hotelReservaNota ?? '').trim(),
    hotelEstadiaNota: String(day?.hotelEstadiaNota ?? '').trim(),
    hotelTorreBase,
  };
}

function normalizeInspectionForm(input) {
  const source = { ...BASE_FORM, ...(input || {}) };
  return {
    ...source,
    id: String(source.id || '').trim(),
    projetoId: String(source.projetoId || '').trim(),
    dataInicio: String(source.dataInicio || '').trim(),
    dataFim: String(source.dataFim || '').trim(),
    responsavel: String(source.responsavel || '').trim(),
    obs: String(source.obs || ''),
    detalhesDias: (Array.isArray(source.detalhesDias) ? source.detalhesDias : []).map(ensureDayShape),
  };
}

function getDayTowerKeys(day) {
  return (Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [])
    .map((tower) => String(tower?.numero || '').trim())
    .filter(Boolean);
}

function formatHistoryOption(item) {
  const usageText = Number(item?.usageCount || 0) > 1 ? ` | ${item.usageCount} usos` : '';
  const dateText = item?.lastDate ? ` | Ultimo uso: ${item.lastDate}` : '';
  return `${item.hotelNome}${item.hotelMunicipio ? ` (${item.hotelMunicipio})` : ''}${usageText}${dateText}`;
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function InspectionFormWizardModal({
  open,
  isEditing,
  initialData,
  projects,
  inspections,
  erosions,
  actorName,
  suggestedTowerInput,
  onOpenErosionDraft,
  onCancel,
  onSaved,
}) {
  const { show } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => normalizeInspectionForm(initialData));
  const [expandedDay, setExpandedDay] = useState('');
  const [expandedTowerKey, setExpandedTowerKey] = useState('');
  const [collapsedTowerPickerDays, setCollapsedTowerPickerDays] = useState({});
  const [openHotelPickerDayKey, setOpenHotelPickerDayKey] = useState('');
  const [hotelPickerSearch, setHotelPickerSearch] = useState('');
  const [erosionModal, setErosionModal] = useState(null);
  const [erosionForm, setErosionForm] = useState(() => buildSafeInlineErosionFormState());
  const [inlineCoordinatesExpanded, setInlineCoordinatesExpanded] = useState(false);
  const [inlineUtmErrorToken, setInlineUtmErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const autoPendingCheckRef = useRef('');
  const hotelPickerRef = useRef(null);
  const hotelPickerSearchRef = useRef(null);

  const selectedProject = useMemo(
    () => (projects || []).find((item) => item.id === formData.projetoId) || null,
    [projects, formData.projetoId],
  );

  const hotelHistory = useMemo(
    () => buildHotelHistory({
      inspections,
      draftInspection: formData,
      projectId: formData.projetoId,
    }),
    [inspections, formData],
  );

  const projectTowerOptions = useMemo(() => {
    const totalTowers = Number(selectedProject?.torres || 0);
    const withPortico = ['0'];
    if (!Number.isFinite(totalTowers) || totalTowers <= 0) return withPortico;
    const towers = Array.from({ length: Math.trunc(totalTowers) }, (_, index) => String(index + 1));
    return [...withPortico, ...towers];
  }, [selectedProject?.torres]);

  const filteredHotelHistory = useMemo(() => {
    const term = normalizeSearchText(hotelPickerSearch);
    if (!term) return hotelHistory;
    return hotelHistory.filter((item) => {
      const hotelName = normalizeSearchText(item?.hotelNome);
      const hotelCity = normalizeSearchText(item?.hotelMunicipio);
      return hotelName.includes(term) || hotelCity.includes(term);
    });
  }, [hotelHistory, hotelPickerSearch]);

  const hasExactHotelMatch = useMemo(() => {
    const term = normalizeSearchText(hotelPickerSearch);
    if (!term) return true;
    return hotelHistory.some((item) => normalizeSearchText(item?.hotelNome) === term);
  }, [hotelHistory, hotelPickerSearch]);

  const summary = useMemo(() => {
    const days = Array.isArray(formData.detalhesDias) ? formData.detalhesDias : [];
    const daysWithChecklist = days.filter((day) => (day?.torresDetalhadas || []).length > 0).length;
    const uniqueTowers = new Set();
    days.forEach((day) => getDayTowerKeys(day).forEach((tower) => uniqueTowers.add(tower)));
    const towersWithErosion = days.reduce(
      (acc, day) => acc + (day?.torresDetalhadas || []).filter((tower) => tower?.temErosao).length,
      0,
    );
    return {
      daysCount: days.length,
      daysWithChecklist,
      uniqueTowerCount: uniqueTowers.size,
      towersWithErosion,
    };
  }, [formData.detalhesDias]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeInspectionForm(initialData);
    setFormData(normalized);
    setStep(1);
    setExpandedDay(normalized.detalhesDias?.[0]?.data || '');
    setExpandedTowerKey('');
    setCollapsedTowerPickerDays({});
    setOpenHotelPickerDayKey('');
    setHotelPickerSearch('');
    setErosionModal(null);
    setErosionForm(buildSafeInlineErosionFormState());
    setInlineCoordinatesExpanded(false);
    setInlineUtmErrorToken(0);
    autoPendingCheckRef.current = '';
  }, [open, initialData]);

  useEffect(() => {
    if (!open || isEditing) return;
    const generatedId = buildInspectionId(formData.projetoId, formData.dataInicio, inspections);
    if (!generatedId || generatedId === formData.id) return;
    setFormData((prev) => ({ ...prev, id: generatedId }));
  }, [open, isEditing, formData.projetoId, formData.dataInicio, formData.id, inspections]);

  useEffect(() => {
    if (!open) return;
    const inspectionId = String(formData.id || '').trim();
    const projectId = String(formData.projetoId || '').trim();
    const hasDays = Array.isArray(formData.detalhesDias) && formData.detalhesDias.length > 0;
    if (!inspectionId || !projectId || !hasDays) return;

    const key = `${inspectionId}|${projectId}`;
    if (autoPendingCheckRef.current === key) return;
    autoPendingCheckRef.current = key;

    (async () => {
      try {
        await checkInspectionPendencies({
          inspectionId,
          projectId,
          syncBeforeCheck: false,
          notifyWhenPending: true,
        });
      } catch {
        show('Erro ao verificar pendencias de erosao nesta vistoria.', 'error');
      }
    })();
  }, [open, formData.id, formData.projetoId, formData.detalhesDias, erosions]);

  useEffect(() => {
    if (!openHotelPickerDayKey) return undefined;

    function handlePointerDown(event) {
      if (hotelPickerRef.current && !hotelPickerRef.current.contains(event.target)) {
        setOpenHotelPickerDayKey('');
        setHotelPickerSearch('');
      }
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setOpenHotelPickerDayKey('');
      setHotelPickerSearch('');
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openHotelPickerDayKey]);

  useEffect(() => {
    if (!openHotelPickerDayKey) return undefined;
    const timer = window.setTimeout(() => {
      hotelPickerSearchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openHotelPickerDayKey]);

  if (!open) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  const inlineCoordinatesStatus = getInlineCoordinatesStatus(erosionForm.locationCoordinates || {});

  function syncDays(next) {
    const source = normalizeInspectionForm(next);
    const start = String(source.dataInicio || '').trim();
    const end = String(source.dataFim || '').trim() || start;
    if (!start || !end) return { ...source, detalhesDias: [] };

    const dates = gerarPeriodoDias(start, end);
    const details = preservarDetalhesDias(source.detalhesDias, dates).map(ensureDayShape);
    return { ...source, detalhesDias: details };
  }

  function updateGeneralField(key, value) {
    setFormData((prev) => {
      if (key === 'dataInicio' || key === 'dataFim') return syncDays({ ...prev, [key]: value });
      return { ...prev, [key]: value };
    });
  }

  function updateDayField(dayIndex, patch) {
    setFormData((prev) => {
      const days = [...(prev.detalhesDias || [])];
      const day = days[dayIndex];
      if (!day) return prev;
      days[dayIndex] = ensureDayShape({ ...day, ...patch });
      return { ...prev, detalhesDias: days };
    });
  }

  function updateTowerDetail(dayIndex, towerIndex, patch) {
    setFormData((prev) => {
      const days = [...(prev.detalhesDias || [])];
      const day = days[dayIndex];
      if (!day) return prev;
      const towers = [...(day.torresDetalhadas || [])];
      towers[towerIndex] = {
        ...towers[towerIndex],
        ...patch,
        numero: String(towers[towerIndex]?.numero || '').trim(),
      };
      days[dayIndex] = ensureDayShape({ ...day, torresDetalhadas: towers });
      return { ...prev, detalhesDias: days };
    });
  }

  function updateInlineLocationField(field, value) {
    setErosionForm((prev) => ({
      ...prev,
      locationCoordinates: {
        ...(prev.locationCoordinates || {}),
        [field]: value,
      },
    }));
  }

  function toggleDayTower(dayIndex, towerNumber) {
    const towerKey = String(towerNumber || '').trim();
    if (!towerKey) return;
    setFormData((prev) => {
      const days = [...(prev.detalhesDias || [])];
      const day = days[dayIndex];
      if (!day) return prev;
      const normalizedDay = ensureDayShape(day);
      const towersMap = new Map((normalizedDay.torresDetalhadas || []).map((item) => [String(item?.numero || '').trim(), item]));

      if (towersMap.has(towerKey)) {
        towersMap.delete(towerKey);
      } else {
        const previousTower = (normalizedDay.torresDetalhadas || []).find((item) => String(item?.numero || '').trim() === towerKey) || {};
        towersMap.set(towerKey, {
          numero: towerKey,
          obs: String(previousTower?.obs || '').trim(),
          temErosao: !!previousTower?.temErosao,
        });
      }

      const nextDetailed = [...towersMap.values()].sort((a, b) => compareTowerNumbers(a.numero, b.numero));
      const nextTowerNumbers = nextDetailed.map((item) => String(item?.numero || '').trim()).filter(Boolean);
      const currentHotelTowerBase = String(normalizedDay.hotelTorreBase || '').trim();
      const nextHotelTowerBase = nextTowerNumbers.includes(currentHotelTowerBase) ? currentHotelTowerBase : '';

      days[dayIndex] = ensureDayShape({
        ...normalizedDay,
        torres: nextTowerNumbers,
        torresInput: nextTowerNumbers.join(', '),
        torresDetalhadas: nextDetailed,
        hotelTorreBase: nextHotelTowerBase,
      });
      return { ...prev, detalhesDias: days };
    });
  }

  function clearDayTowerSelection(dayIndex) {
    setFormData((prev) => {
      const days = [...(prev.detalhesDias || [])];
      const day = days[dayIndex];
      if (!day) return prev;
      days[dayIndex] = ensureDayShape({
        ...day,
        torres: [],
        torresInput: '',
        torresDetalhadas: [],
        hotelTorreBase: '',
      });
      return { ...prev, detalhesDias: days };
    });
  }

  function toggleTowerPickerCollapse(dayKey) {
    setCollapsedTowerPickerDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  }

  function applySuggestedTowersToDay(dayIndex) {
    const day = formData.detalhesDias?.[dayIndex];
    if (!day || !suggestedTowerInput) return;
    let towers = parseTowerInput(suggestedTowerInput);
    const maxTowers = Number(selectedProject?.torres || 0);
    if (Number.isFinite(maxTowers) && maxTowers > 0) {
      towers = towers.filter((item) => item >= 0 && item <= maxTowers);
    }
    const existing = new Map((day.torresDetalhadas || []).map((item) => [String(item?.numero || '').trim(), item]));
    const detalhadas = towers.map((number) => {
      const key = String(number);
      const prev = existing.get(key) || {};
      return {
        numero: key,
        obs: String(prev?.obs || '').trim(),
        temErosao: !!prev?.temErosao,
      };
    });
    updateDayField(dayIndex, {
      torres: towers,
      torresInput: towers.join(', '),
      torresDetalhadas: detalhadas,
    });
    show('Torres sugeridas aplicadas ao dia.', 'success');
  }

  function toggleHotelPicker(dayKey, initialValue = '') {
    setOpenHotelPickerDayKey((prev) => {
      if (prev === dayKey) {
        setHotelPickerSearch('');
        return '';
      }
      setHotelPickerSearch(initialValue);
      return dayKey;
    });
  }

  function handleSelectHotelFromHistory(dayIndex, hotelItem) {
    if (!hotelItem) return;
    updateDayField(dayIndex, extractHotelFields(hotelItem));
    setOpenHotelPickerDayKey('');
    setHotelPickerSearch('');
  }

  function handleCreateNewHotel(dayIndex) {
    const hotelName = String(hotelPickerSearch || '').trim();
    if (!hotelName) return;
    updateDayField(dayIndex, { hotelNome: hotelName });
    setOpenHotelPickerDayKey('');
    setHotelPickerSearch('');
  }

  function repeatPreviousDayHotel(dayIndex) {
    const day = formData.detalhesDias?.[dayIndex];
    if (!day) return;
    const previous = findPreviousDayHotel(formData.detalhesDias, day.data);
    if (!previous) {
      show('Nao ha hotel valido no dia anterior.', 'error');
      return;
    }
    updateDayField(dayIndex, extractHotelFields(previous));
    show(`Hotel do dia anterior (${previous.date}) aplicado.`, 'success');
  }

  function resolveInspectionProjectId(explicitProjectId = '') {
    return String(explicitProjectId || formData.projetoId || '').trim();
  }

  function buildInspectionPayload(input, inspectionId) {
    const source = normalizeInspectionForm(input);
    return {
      ...source,
      id: String(inspectionId || source.id || '').trim(),
      dataFim: source.dataFim || source.dataInicio,
      status: source.status || 'aberta',
      detalhesDias: (source.detalhesDias || []).map((day) => {
        const towers = Array.isArray(day?.torres) ? day.torres : parseTowerInput(day?.torresInput || day?.torres || '');
        return {
          ...ensureDayShape(day),
          torres: towers,
          torresInput: String(day?.torresInput || '').trim() || towers.join(', '),
          torresDetalhadas: (day?.torresDetalhadas || []).map((tower) => ({
            numero: String(tower?.numero || '').trim(),
            obs: String(tower?.obs || '').trim(),
            temErosao: !!tower?.temErosao,
          })),
          hotelNome: String(day?.hotelNome ?? '').trim(),
          hotelMunicipio: String(day?.hotelMunicipio ?? '').trim(),
          hotelTorreBase: String(day?.hotelTorreBase || '').trim(),
        };
      }),
    };
  }

  async function ensureInspectionSavedForInlineActions() {
    if (!formData.projetoId || !formData.dataInicio) {
      throw new Error('Selecione empreendimento e data de inicio antes desta acao.');
    }
    const id = String(formData.id || '').trim() || buildInspectionId(formData.projetoId, formData.dataInicio, inspections) || `VS-${Date.now()}`;
    const payload = buildInspectionPayload({ ...formData, id }, id);
    await saveInspection(payload, { merge: true, updatedBy: actorName });
    setFormData((prev) => ({ ...prev, id }));
    return id;
  }

  async function syncInspectionPendencies(inspectionId, explicitProjectId = '') {
    const projectId = resolveInspectionProjectId(explicitProjectId);
    if (!projectId || !inspectionId) return;
    const projectErosions = (erosions || []).filter((item) => String(item?.projetoId || '').trim() === projectId);
    await Promise.all(projectErosions.map((erosion) => saveErosion({
      ...erosion,
      vistoriaId: inspectionId,
      vistoriaIds: [...new Set([inspectionId, ...normalizeLinkedInspectionIds(erosion)])],
      pendenciasVistoria: upsertInspectionPendency(erosion, inspectionId),
    }, {
      merge: true,
      skipAutoFollowup: true,
      updatedBy: actorName,
    })));
  }

  async function checkInspectionPendencies({
    inspectionId,
    projectId = '',
    syncBeforeCheck = false,
    notifyWhenPending = true,
  } = {}) {
    const normalizedInspectionId = String(inspectionId || '').trim();
    const normalizedProjectId = resolveInspectionProjectId(projectId);
    if (!normalizedInspectionId || !normalizedProjectId) return [];

    if (syncBeforeCheck) {
      await syncInspectionPendencies(normalizedInspectionId, normalizedProjectId);
    }

    const pending = getPendingErosionsForInspection({
      erosions,
      projectId: normalizedProjectId,
      inspectionId: normalizedInspectionId,
    });

    if (pending.length > 0) {
      setFormData((prev) => {
        const updatedDays = ensurePendingTowersVisibleInDays({
          detailsDays: prev.detalhesDias,
          pendingErosions: pending,
          targetDay: prev.detalhesDias?.[0]?.data || '',
        });
        return { ...prev, detalhesDias: updatedDays };
      });
      if (notifyWhenPending) {
        const towers = [...new Set(
          pending.map((item) => String(item?.torreRef || '').trim()).filter(Boolean),
        )].sort(compareTowerNumbers);
        show(`Pendencias de visita em erosoes: ${towers.join(', ') || '-'}. As torres foram carregadas.`, 'error');
      }
    }

    return pending;
  }

  async function openErosionFromTower(dayIndex, towerNumber) {
    try {
      const inspectionId = await ensureInspectionSavedForInlineActions();
      const latest = getLatestLinkedErosion(erosions, formData.projetoId, towerNumber);
      setFormData((prev) => ({ ...prev, id: inspectionId }));
      setErosionModal({
        dayIndex,
        towerNumber: String(towerNumber || '').trim(),
        existingErosion: latest,
      });
      const locationCoordinates = normalizeLocationCoordinates(latest || {});
      setErosionForm(buildSafeInlineErosionFormState(latest));
      setInlineCoordinatesExpanded(hasAnyLocationValue(locationCoordinates));
      setInlineUtmErrorToken(0);
    } catch (err) {
      show(err.message || 'Nao foi possivel salvar vistoria antes de abrir erosao.', 'error');
    }
  }

  async function markPendingErosionVisit(dayIndex, towerNumber) {
    try {
      const dayDate = String(formData.detalhesDias?.[dayIndex]?.data || '').trim();
      const defaultDate = toBrDate(dayDate) || toBrDate(new Date().toISOString().slice(0, 10));
      const typed = window.prompt('Informe a data da visita (DD/MM/AAAA):', defaultDate);
      if (typed === null) return;
      const visitDate = String(typed || '').trim();
      if (!isBrDateValid(visitDate)) {
        show('Data invalida. Use DD/MM/AAAA.', 'error');
        return;
      }

      const inspectionId = await ensureInspectionSavedForInlineActions();
      const projectId = String(formData.projetoId || '').trim();
      const towerKey = String(towerNumber || '').trim();
      const targetErosions = (erosions || []).filter((item) =>
        String(item?.projetoId || '').trim() === projectId
        && String(item?.torreRef || '').trim() === towerKey);

      if (targetErosions.length === 0) {
        show('Nao ha erosao cadastrada nessa torre para marcar visita.', 'error');
        return;
      }

      await Promise.all(targetErosions.map((erosion) => saveErosion({
        ...erosion,
        vistoriaId: inspectionId,
        vistoriaIds: [...new Set([inspectionId, ...normalizeLinkedInspectionIds(erosion)])],
        pendenciasVistoria: upsertInspectionPendency(erosion, inspectionId, {
          status: 'visitada',
          dia: visitDate,
        }),
      }, {
        merge: true,
        skipAutoFollowup: true,
        updatedBy: actorName,
      })));

      show(`Visita da erosao marcada para ${visitDate}.`, 'success');
    } catch {
      show('Erro ao marcar visita da erosao.', 'error');
    }
  }

  async function handleSaveErosion(event) {
    event.preventDefault();
    try {
      if (!erosionModal?.towerNumber) {
        show('Torre nao definida para erosao.', 'error');
        return;
      }

      const validation = validateErosionLocation(erosionForm);
      if (!validation.ok) {
        show(validation.message, 'error');
        return;
      }

      const inspectionId = String(formData.id || '').trim() || await ensureInspectionSavedForInlineActions();
      const existing = erosionModal.existingErosion || null;
      const photos = Array.isArray(erosionForm.fotosLinks)
        ? erosionForm.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const invalidPhoto = photos.find((item) => !/^https?:\/\//i.test(item));
      if (invalidPhoto) {
        show(`Link de foto invalido: ${invalidPhoto}`, 'error');
        return;
      }

      const technicalValidation = validateErosionTechnicalFields(erosionForm);
      if (!technicalValidation.ok) {
        show(technicalValidation.message, 'error');
        return;
      }

      const locationResult = resolveLocationCoordinatesForSave({
        locationCoordinates: erosionForm.locationCoordinates,
      });
      if (!locationResult.ok) {
        if (String(locationResult.error || '').toLowerCase().includes('utm')) {
          setInlineCoordinatesExpanded(true);
          setInlineUtmErrorToken((prev) => prev + 1);
        }
        show(locationResult.error, 'error');
        return;
      }

      const normalizedTechnicalData = {
        ...erosionForm,
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
      const calculoResponse = await postCalculoErosao(criticalityInput);
      const criticalidadeV2 = calculoResponse.campos_calculados || null;
      const alertasValidacao = Array.isArray(calculoResponse.alertas_validacao)
        ? calculoResponse.alertas_validacao
        : [];

      if (alertasValidacao.length > 0) {
        const shouldContinue = window.confirm(
          `Foram encontrados alertas tecnicos:\\n\\n- ${alertasValidacao.join('\\n- ')}\\n\\nDeseja salvar mesmo assim?`,
        );
        if (!shouldContinue) return;
      }

      const payload = {
        ...(existing || {}),
        ...(existing?.id ? { id: existing.id } : {}),
        vistoriaId: inspectionId,
        vistoriaIds: existing
          ? [...new Set([inspectionId, ...normalizeLinkedInspectionIds(existing)])]
          : [inspectionId],
        projetoId: formData.projetoId,
        torreRef: String(erosionModal.towerNumber),
        tipo: deriveErosionTypeFromTechnicalFields(normalizedTechnicalData),
        estagio: String(erosionForm.estagio || '').trim(),
        status: String(erosionForm.status || 'Ativo').trim() || 'Ativo',
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        locationCoordinates: locationResult.locationCoordinates,
        localContexto: technicalValidation.value.localContexto,
        presencaAguaFundo: technicalValidation.value.presencaAguaFundo,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        caracteristicasFeicao: technicalValidation.value.caracteristicasFeicao,
        usosSolo: technicalValidation.value.usosSolo,
        usoSoloOutro: technicalValidation.value.usoSoloOutro,
        saturacaoPorAgua: technicalValidation.value.saturacaoPorAgua,
        tipoSolo: technicalValidation.value.tipoSolo,
        profundidadeMetros: technicalValidation.value.profundidadeMetros,
        declividadeGraus: technicalValidation.value.declividadeGraus,
        distanciaEstruturaMetros: technicalValidation.value.distanciaEstruturaMetros,
        sinaisAvanco: technicalValidation.value.sinaisAvanco,
        vegetacaoInterior: technicalValidation.value.vegetacaoInterior,
        medidaPreventiva: Array.isArray(criticalidadeV2?.lista_solucoes_sugeridas)
          ? (criticalidadeV2.lista_solucoes_sugeridas[0] || '')
          : '',
        fotosLinks: photos,
        obs: String(erosionForm.descricao || '').trim(),
        criticalidadeV2,
        alertsAtivos: alertasValidacao,
        criticality: criticalidadeV2?.legacy,
      };

      await saveErosion(payload, {
        origem: 'vistoria',
        merge: !!existing,
        updatedBy: actorName,
      });

      setFormData((prev) => {
        const days = [...(prev.detalhesDias || [])];
        const day = days[erosionModal.dayIndex];
        if (!day) return prev;
        const towers = (day.torresDetalhadas || []).map((tower) =>
          String(tower?.numero || '').trim() === String(erosionModal.towerNumber)
            ? { ...tower, temErosao: true }
            : tower);
        days[erosionModal.dayIndex] = ensureDayShape({ ...day, torresDetalhadas: towers });
        return { ...prev, detalhesDias: days };
      });

      setErosionModal(null);
      setErosionForm(buildSafeInlineErosionFormState());
      setInlineCoordinatesExpanded(false);
      setInlineUtmErrorToken(0);
      show(existing ? 'Erosao atualizada com sucesso.' : 'Erosao cadastrada com sucesso.', 'success');
    } catch {
      show('Erro ao salvar erosao.', 'error');
    }
  }

  async function handleOpenErosionDraft() {
    if (!onOpenErosionDraft) {
      show('Fluxo de rascunho de erosao indisponivel.', 'error');
      return;
    }
    if (!erosionModal?.towerNumber) {
      show('Torre nao definida para erosao.', 'error');
      return;
    }

    try {
      const inspectionId = String(formData.id || '').trim() || await ensureInspectionSavedForInlineActions();
      const technicalValidation = validateErosionTechnicalFields(erosionForm);
      if (!technicalValidation.ok) {
        show(technicalValidation.message, 'error');
        return;
      }
      const locationResult = resolveLocationCoordinatesForSave({
        locationCoordinates: erosionForm.locationCoordinates,
      });
      if (!locationResult.ok) {
        if (String(locationResult.error || '').toLowerCase().includes('utm')) {
          setInlineCoordinatesExpanded(true);
          setInlineUtmErrorToken((prev) => prev + 1);
        }
        show(locationResult.error, 'error');
        return;
      }
      const photos = Array.isArray(erosionForm.fotosLinks)
        ? erosionForm.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const normalizedTechnicalData = {
        ...erosionForm,
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

      onOpenErosionDraft({
        projetoId: formData.projetoId,
        vistoriaId: inspectionId,
        torreRef: String(erosionModal.towerNumber || '').trim(),
        tipo: deriveErosionTypeFromTechnicalFields(normalizedTechnicalData),
        estagio: String(erosionForm.estagio || '').trim(),
        status: String(erosionForm.status || 'Ativo').trim() || 'Ativo',
        locationCoordinates: locationResult.locationCoordinates,
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        localContexto: technicalValidation.value.localContexto,
        presencaAguaFundo: technicalValidation.value.presencaAguaFundo,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        caracteristicasFeicao: technicalValidation.value.caracteristicasFeicao,
        usosSolo: technicalValidation.value.usosSolo,
        usoSoloOutro: technicalValidation.value.usoSoloOutro,
        saturacaoPorAgua: technicalValidation.value.saturacaoPorAgua,
        tipoSolo: technicalValidation.value.tipoSolo,
        profundidadeMetros: technicalValidation.value.profundidadeMetros,
        declividadeGraus: technicalValidation.value.declividadeGraus,
        distanciaEstruturaMetros: technicalValidation.value.distanciaEstruturaMetros,
        sinaisAvanco: technicalValidation.value.sinaisAvanco,
        vegetacaoInterior: technicalValidation.value.vegetacaoInterior,
        fotosLinks: photos,
        obs: String(erosionForm.descricao || '').trim(),
      });

      setErosionModal(null);
      setErosionForm(buildSafeInlineErosionFormState());
      setInlineCoordinatesExpanded(false);
      setInlineUtmErrorToken(0);
    } catch (err) {
      show(err.message || 'Nao foi possivel abrir cadastro completo de erosao.', 'error');
    }
  }

  function validateStep1() {
    if (!formData.projetoId || !formData.dataInicio) {
      show('Preencha empreendimento e data de inicio.', 'error');
      return false;
    }
    if (formData.dataFim && formData.dataFim < formData.dataInicio) {
      show('Data fim nao pode ser anterior a data inicio.', 'error');
      return false;
    }
    return true;
  }

  function handleNextStep() {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      if (!expandedDay) setExpandedDay(formData.detalhesDias?.[0]?.data || '');
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    setStep(3);
  }

  function handlePreviousStep() {
    if (step === 1) return;
    setStep((prev) => prev - 1);
  }

  async function handleSaveInspection() {
    try {
      if (!validateStep1()) return;

      const duplicates = findDuplicateTowersAcrossDays(formData.detalhesDias);
      if (duplicates.length > 0) {
        const sample = duplicates
          .slice(0, 8)
          .map((item) => `- Torre ${item.tower}: ${item.days.join(', ')}`)
          .join('\n');
        const overflow = duplicates.length > 8 ? `\n... e mais ${duplicates.length - 8} torre(s).` : '';
        const confirmed = window.confirm(
          `Ha torres registadas em mais de um dia nesta vistoria:\n${sample}${overflow}\n\nIsso pode estar correto em caso de revisita.\nClique em OK para continuar ou Cancelar para revisar.`,
        );
        if (!confirmed) {
          show('Salvamento cancelado para revisao das torres repetidas.', 'error');
          setStep(2);
          return;
        }
      }

      setSaving(true);

      const inspectionId = String(formData.id || '').trim()
        || buildInspectionId(formData.projetoId, formData.dataInicio, inspections)
        || `VS-${Date.now()}`;
      const payload = buildInspectionPayload({ ...formData, id: inspectionId }, inspectionId);
      await saveInspection(payload, { merge: true, updatedBy: actorName });

      const pending = await checkInspectionPendencies({
        inspectionId,
        projectId: formData.projetoId,
        syncBeforeCheck: true,
        notifyWhenPending: true,
      });

      if (pending.length > 0) {
        setFormData((prev) => ({ ...prev, id: inspectionId }));
        setStep(2);
        return;
      }

      setFormData((prev) => ({ ...prev, id: inspectionId }));
      show('Vistoria salva com sucesso.', 'success');
      onSaved?.(inspectionId, payload);
    } catch (err) {
      show(err.message || 'Erro ao salvar vistoria.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="inspections-wizard-root">
      <div className="inspections-wizard-backdrop">
        <div
          className="inspections-wizard-modal"
          role="dialog"
          aria-modal="true"
          aria-label={isEditing ? 'Editar Vistoria' : 'Nova Vistoria'}
        >
          <div className="inspections-wizard-head">
            <div>
              <h3>{isEditing ? 'Editar Vistoria' : 'Nova Vistoria'}</h3>
              <p className="muted">Wizard em 3 etapas com preenchimento drill-down por dia e torre.</p>
            </div>
            <button type="button" className="secondary" onClick={onCancel}>
              <AppIcon name="close" />
            </button>
          </div>

          <div className="inspections-wizard-steps">
            <button type="button" className={`inspections-step-chip ${step === 1 ? 'is-active' : ''}`} onClick={() => setStep(1)}>1. Dados gerais</button>
            <button type="button" className={`inspections-step-chip ${step === 2 ? 'is-active' : ''}`} onClick={() => setStep(2)}>2. Diario</button>
            <button type="button" className={`inspections-step-chip ${step === 3 ? 'is-active' : ''}`} onClick={() => setStep(3)}>3. Revisao</button>
          </div>

          <div className="inspections-wizard-body">
            {step === 1 ? (
              <div className="inspections-step-pane">
                <div className="grid-form">
                  <div>
                    <label>ID</label>
                    <input value={formData.id || ''} disabled placeholder="ID gerado automaticamente" />
                  </div>
                  <div>
                    <label>Empreendimento *</label>
                    <select value={formData.projetoId} onChange={(e) => updateGeneralField('projetoId', e.target.value)}>
                      <option value="">Selecione...</option>
                      {(projects || []).map((project) => (
                        <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Responsavel</label>
                    <input value={formData.responsavel || ''} onChange={(e) => updateGeneralField('responsavel', e.target.value)} placeholder="Nome do responsavel" />
                  </div>
                  <div>
                    <label>Data inicio *</label>
                    <input type="date" value={formData.dataInicio || ''} onChange={(e) => updateGeneralField('dataInicio', e.target.value)} />
                  </div>
                  <div>
                    <label>Data fim</label>
                    <input type="date" value={formData.dataFim || ''} onChange={(e) => updateGeneralField('dataFim', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Observacoes</label>
                  <textarea rows="3" value={formData.obs || ''} onChange={(e) => updateGeneralField('obs', e.target.value)} placeholder="Observacoes gerais da vistoria..." />
                </div>
                {suggestedTowerInput ? (
                  <div className="notice">
                    <div><strong>Torres sugeridas pelo planejamento:</strong> {suggestedTowerInput}</div>
                  </div>
                ) : null}
                {formData.detalhesDias.length === 0 ? (
                  <div className="notice">Defina data inicio e data fim para gerar os dias da vistoria.</div>
                ) : (
                  <div className="notice">
                    <strong>Dias gerados:</strong> {formData.detalhesDias.length}
                  </div>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="inspections-step-pane">
                <div className="inspections-day-list">
                  {formData.detalhesDias.map((day, dayIndex) => {
                    const isDayExpanded = expandedDay === day.data;
                    const dayKey = String(day?.data || `dia-${dayIndex}`);
                    const isTowerPickerCollapsed = !!collapsedTowerPickerDays[dayKey];
                    const isHotelPickerOpen = openHotelPickerDayKey === dayKey;
                    const selectedDayTowers = [...(day.torresDetalhadas || [])]
                      .filter((tower) => String(tower?.numero || '').trim())
                      .sort((a, b) => compareTowerNumbers(a.numero, b.numero));
                    const selectedDayTowerKeys = new Set(selectedDayTowers.map((tower) => String(tower?.numero || '').trim()));
                    const canCreateHotelFromSearch = isHotelPickerOpen
                      && String(hotelPickerSearch || '').trim() !== ''
                      && !hasExactHotelMatch;
                    const previousHotel = findPreviousDayHotel(formData.detalhesDias, day.data);
                    return (
                      <article key={day.data || dayIndex} className="inspections-day-card">
                        <div className="inspections-day-card-head">
                          <div>
                            <strong>{day.data ? new Date(`${day.data}T00:00:00`).toLocaleDateString('pt-BR') : `Dia ${dayIndex + 1}`}</strong>
                            <div className="muted">{(day.torresDetalhadas || []).length} torre(s) detalhada(s)</div>
                          </div>
                          <button type="button" className="secondary" onClick={() => setExpandedDay((prev) => (prev === day.data ? '' : day.data))}>
                            <AppIcon name="details" />
                            {isDayExpanded ? 'Ocultar' : 'Detalhar dia'}
                          </button>
                        </div>

                        {isDayExpanded ? (
                          <div className="inspections-day-card-body">
                            <div className="inspections-day-field-grid">
                              <div className="inspections-day-field">
                                <label>Clima</label>
                                <select value={day.clima || ''} onChange={(e) => updateDayField(dayIndex, { clima: e.target.value })}>
                                  <option value="">Selecione...</option>
                                  <option value="Sol">Sol</option>
                                  <option value="Parcialmente Nublado">Parcialmente nublado</option>
                                  <option value="Nublado">Nublado</option>
                                  <option value="Chuva">Chuva</option>
                                </select>
                              </div>
                              <div className="inspections-day-field inspections-day-tower-selected-summary">
                                <label>Torres selecionadas</label>
                                <div className="muted">
                                  {selectedDayTowers.length > 0
                                    ? selectedDayTowers.map((tower) => formatTowerLabel(tower.numero)).join(', ')
                                    : 'Nenhuma torre selecionada.'}
                                </div>
                              </div>
                            </div>

                            <div className="inspections-day-tower-picker">
                              <div className="inspections-day-tower-picker-head">
                                <div className="inspections-day-tower-picker-head-copy">
                                  <strong>Selecionar torres do dia</strong>
                                  <span>{selectedDayTowers.length} selecionada(s)</span>
                                </div>
                                <button
                                  type="button"
                                  className="secondary inspections-day-tower-picker-toggle"
                                  onClick={() => toggleTowerPickerCollapse(dayKey)}
                                >
                                  <AppIcon name={isTowerPickerCollapsed ? 'chevron-down' : 'chevron-up'} />
                                  {isTowerPickerCollapsed ? 'Expandir' : 'Ocultar'}
                                </button>
                              </div>
                              {!isTowerPickerCollapsed ? (
                                <>
                                  <div className="inspections-day-tower-picker-grid">
                                    {projectTowerOptions.map((towerNumber) => {
                                      const active = selectedDayTowerKeys.has(String(towerNumber));
                                      return (
                                        <button
                                          key={`${dayKey}-picker-${towerNumber}`}
                                          type="button"
                                          className={`inspections-day-tower-picker-btn ${active ? 'is-active' : ''}`.trim()}
                                          onClick={() => toggleDayTower(dayIndex, towerNumber)}
                                        >
                                          {formatTowerLabel(towerNumber)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {projectTowerOptions.length === 0 ? (
                                    <p className="muted inspections-day-tower-picker-empty">
                                      Este empreendimento nao possui total de torres valido para selecao.
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                            </div>

                            <div className="row-actions inspections-day-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => clearDayTowerSelection(dayIndex)}
                                disabled={selectedDayTowers.length === 0}
                              >
                                <AppIcon name="close" />
                                Limpar selecao do dia
                              </button>
                              {suggestedTowerInput ? (
                                <button type="button" className="secondary" onClick={() => applySuggestedTowersToDay(dayIndex)}>
                                  <AppIcon name="clipboard" />
                                  Aplicar sugeridas
                                </button>
                              ) : null}
                            </div>

                            <div className="panel nested inspections-day-hotel-history">
                              <div className="inspections-day-hotel-history-grid">
                                <div
                                  className="inspections-day-hotel-picker"
                                  ref={isHotelPickerOpen ? hotelPickerRef : null}
                                >
                                  <button
                                    type="button"
                                    className={`inspections-day-hotel-picker-trigger ${isHotelPickerOpen ? 'is-open' : ''}`.trim()}
                                    aria-expanded={isHotelPickerOpen ? 'true' : 'false'}
                                    aria-haspopup="listbox"
                                    onClick={() => toggleHotelPicker(dayKey, String(day.hotelNome || ''))}
                                  >
                                    <span className="inspections-day-hotel-picker-trigger-label">
                                      {day.hotelNome
                                        ? `${day.hotelNome}${day.hotelMunicipio ? ` (${day.hotelMunicipio})` : ''}`
                                        : 'Selecionar hotel...'}
                                    </span>
                                    <AppIcon name={isHotelPickerOpen ? 'close' : 'details'} />
                                  </button>

                                  {isHotelPickerOpen ? (
                                    <div className="inspections-day-hotel-picker-menu" role="dialog" aria-label="Selecionar hotel">
                                      <label className="inspections-day-hotel-picker-search">
                                        <AppIcon name="search" />
                                        <input
                                          ref={hotelPickerSearchRef}
                                          type="search"
                                          value={hotelPickerSearch}
                                          placeholder="Buscar hotel por nome ou municipio..."
                                          onChange={(e) => setHotelPickerSearch(e.target.value)}
                                        />
                                      </label>

                                      <div className="inspections-day-hotel-picker-options" role="listbox" aria-label="Historico de hoteis">
                                        {filteredHotelHistory.map((item) => (
                                          <button
                                            key={item.key}
                                            type="button"
                                            className="inspections-day-hotel-picker-option"
                                            onClick={() => handleSelectHotelFromHistory(dayIndex, item)}
                                          >
                                            {formatHistoryOption(item)}
                                          </button>
                                        ))}
                                        {canCreateHotelFromSearch ? (
                                          <button
                                            type="button"
                                            className="inspections-day-hotel-picker-option is-create"
                                            onClick={() => handleCreateNewHotel(dayIndex)}
                                          >
                                            Criar novo hotel: "{String(hotelPickerSearch || '').trim()}"
                                          </button>
                                        ) : null}
                                        {filteredHotelHistory.length === 0 && !canCreateHotelFromSearch ? (
                                          <div className="inspections-day-hotel-picker-empty">Nenhum hotel encontrado.</div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>

                                <button type="button" className="secondary" onClick={() => repeatPreviousDayHotel(dayIndex)} disabled={!previousHotel}>
                                  <AppIcon name="copy" />
                                  Repetir dia anterior
                                </button>
                              </div>
                              {previousHotel ? (
                                <small className="muted">
                                  Hotel anterior disponivel ({previousHotel.date}): {previousHotel.hotelNome || 'Sem nome'}
                                </small>
                              ) : null}
                            </div>

                            <div className="grid-form inspections-day-hotel-fields">
                              <input value={day.hotelNome || ''} onChange={(e) => updateDayField(dayIndex, { hotelNome: e.target.value })} placeholder="Hotel (opcional)" />
                              <input value={day.hotelMunicipio || ''} onChange={(e) => updateDayField(dayIndex, { hotelMunicipio: e.target.value })} placeholder="Municipio do hotel" />
                              <select value={day.hotelLogisticaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelLogisticaNota: e.target.value })}>
                                <option value="">Logistica (1-5)</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                              </select>
                              <select value={day.hotelReservaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelReservaNota: e.target.value })}>
                                <option value="">Reserva (1-5)</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                              </select>
                              <select value={day.hotelEstadiaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelEstadiaNota: e.target.value })}>
                                <option value="">Estadia (1-5)</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                              </select>
                              <select
                                value={day.hotelTorreBase || ''}
                                onChange={(e) => updateDayField(dayIndex, { hotelTorreBase: e.target.value })}
                                disabled={selectedDayTowers.length === 0}
                              >
                                <option value="">
                                  {selectedDayTowers.length === 0
                                    ? 'Selecione torres visitadas no dia'
                                    : 'Torre base da hospedagem'}
                                </option>
                                {selectedDayTowers.map((tower) => (
                                  <option key={`hotel-base-${dayIndex}-${tower.numero}`} value={tower.numero}>Torre {tower.numero}</option>
                                ))}
                              </select>
                            </div>

                            {(day.torresDetalhadas || []).length > 0 ? (
                              <div className="table-scroll inspections-tower-table-wrap">
                                <table className="inspections-tower-table">
                                  <thead>
                                    <tr>
                                      <th>Torre</th>
                                      <th>Observacao</th>
                                      <th>Acoes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(day.torresDetalhadas || []).map((tower, towerIndex) => {
                                      const towerKey = String(tower?.numero || '').trim();
                                      const linkedTowerErosions = (erosions || []).filter((item) =>
                                        String(item?.projetoId || '').trim() === String(formData.projetoId || '').trim()
                                        && String(item?.torreRef || '').trim() === towerKey);
                                      const pendency = linkedTowerErosions
                                        .map((item) => getInspectionPendency(item, formData.id))
                                        .find(Boolean);
                                      const hasVisitedDate = pendency?.status === 'visitada' && String(pendency?.dia || '').trim();
                                      const hasErosion = !!tower?.temErosao || linkedTowerErosions.length > 0;
                                      const key = `${day.data}|${towerKey}`;
                                      const expandedTower = expandedTowerKey === key;
                                      return (
                                        <tr key={`${day.data}-${towerKey}`} className={hasErosion ? 'is-erosion' : ''}>
                                          <td className="inspections-tower-col-number">
                                            <span className="inspections-tower-number">{formatTowerLabel(towerKey)}</span>
                                          </td>
                                          <td className="inspections-tower-col-note">
                                            <input
                                              className="inspections-tower-note-input"
                                              value={tower?.obs || ''}
                                              onChange={(e) => updateTowerDetail(dayIndex, towerIndex, { obs: e.target.value })}
                                              placeholder="Observacoes da torre"
                                            />
                                            {expandedTower ? (
                                              <div className="muted inspections-tower-summary">
                                                <div><strong>Resumo:</strong> {linkedTowerErosions.length > 0 ? 'Ha erosao vinculada nesta torre.' : 'Sem erosao vinculada.'}</div>
                                                <div><strong>Pendencia:</strong> {hasVisitedDate ? `visitada em ${pendency.dia}` : (linkedTowerErosions.length > 0 ? 'pendente' : 'sem pendencia')}</div>
                                              </div>
                                            ) : null}
                                          </td>
                                          <td className="inspections-tower-col-actions">
                                            <div className="inspections-tower-actions">
                                              <button
                                                type="button"
                                                className={`inspections-tower-btn-detail ${expandedTower ? 'is-active' : ''}`.trim()}
                                                onClick={() => setExpandedTowerKey((prev) => (prev === key ? '' : key))}
                                                aria-label={expandedTower ? 'Ocultar detalhes da torre' : 'Detalhar torre'}
                                                title={expandedTower ? 'Ocultar detalhes da torre' : 'Detalhar torre'}
                                              >
                                                <AppIcon name="details" />
                                              </button>
                                              <button
                                                type="button"
                                                className={`inspections-tower-btn-erosion ${hasErosion ? 'has-erosion' : ''}`.trim()}
                                                onClick={() => openErosionFromTower(dayIndex, towerKey)}
                                                aria-label={hasErosion ? 'Editar erosao vinculada' : 'Cadastrar erosao nesta torre'}
                                                title={hasErosion ? 'Editar erosao vinculada' : 'Cadastrar erosao nesta torre'}
                                                disabled={saving}
                                              >
                                                <AppIcon name="alert" />
                                              </button>
                                              {linkedTowerErosions.length > 0 ? (
                                                <button type="button" className="secondary" onClick={() => markPendingErosionVisit(dayIndex, towerKey)}>
                                                  <AppIcon name="check" />
                                                  {hasVisitedDate ? `Visitada ${pendency.dia}` : 'Marcar visita'}
                                                </button>
                                              ) : null}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="muted">Sem torres detalhadas para este dia. Gere o checklist para continuar.</div>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  {formData.detalhesDias.length === 0 ? (
                    <p className="muted">Nenhum dia gerado. Volte para etapa 1 e defina as datas.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="inspections-step-pane">
                <div className="project-card">
                  <h4>Resumo da vistoria</h4>
                  <div className="muted">
                    <div><strong>ID:</strong> {formData.id || '(sera gerado no salvar)'}</div>
                    <div><strong>Empreendimento:</strong> {formData.projetoId || '-'}</div>
                    <div><strong>Periodo:</strong> {formData.dataInicio || '-'} ate {formData.dataFim || formData.dataInicio || '-'}</div>
                    <div><strong>Responsavel:</strong> {formData.responsavel || '-'}</div>
                    <div><strong>Dias registados:</strong> {summary.daysCount}</div>
                    <div><strong>Dias com checklist:</strong> {summary.daysWithChecklist}</div>
                    <div><strong>Torres unicas no diario:</strong> {summary.uniqueTowerCount}</div>
                    <div><strong>Torres sinalizadas com erosao:</strong> {summary.towersWithErosion}</div>
                  </div>
                </div>

                {findDuplicateTowersAcrossDays(formData.detalhesDias).length > 0 ? (
                  <div className="notice">
                    Existem torres registadas em mais de um dia. O sistema pedira confirmacao no salvamento.
                  </div>
                ) : null}

                {suggestedTowerInput ? (
                  <div className="notice">
                    <strong>Torres sugeridas do planejamento:</strong> {suggestedTowerInput}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="inspections-wizard-foot">
            <button type="button" className="secondary" onClick={onCancel}>
              <AppIcon name="close" />
              Cancelar
            </button>
            <div className="row-actions">
              {step > 1 ? (
                <button type="button" className="secondary" onClick={handlePreviousStep}>
                  <AppIcon name="chevron-left" />
                  Voltar
                </button>
              ) : null}
              {step < 3 ? (
                <button type="button" onClick={handleNextStep}>
                  Avancar
                  <AppIcon name="chevron-right" />
                </button>
              ) : (
                <button type="button" onClick={handleSaveInspection} disabled={saving}>
                  <AppIcon name="save" />
                  {saving ? 'Salvando...' : 'Salvar vistoria'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {erosionModal ? (
        <div className="modal-backdrop inspections-inline-erosion-backdrop">
          <form className="modal inspections-inline-erosion-modal" onSubmit={handleSaveErosion}>
            <div className="inspections-inline-erosion-head">
              <h4>Erosao - {formatTowerLabel(erosionModal.towerNumber)}</h4>
              {erosionModal.existingErosion?.id ? (
                <p className="muted">Editando erosao existente: {erosionModal.existingErosion.id}</p>
              ) : null}
            </div>
            <div className="inspections-inline-erosion-body">
              <div className="grid-form">
                <select value={erosionForm.estagio || ''} onChange={(e) => setErosionForm((prev) => ({ ...prev, estagio: e.target.value }))}>
                  <option value="">Estagio (grau erosivo)...</option>
                  <option value="inicial">Inicial</option>
                  <option value="intermediario">Intermediario</option>
                  <option value="avancado">Avancado</option>
                  <option value="critico">Critico</option>
                </select>
                <select value={erosionForm.status || 'Ativo'} onChange={(e) => setErosionForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="Ativo">Status: Ativo</option>
                  <option value="Monitoramento">Status: Monitoramento</option>
                  <option value="Estabilizado">Status: Estabilizado</option>
                </select>
              </div>
              <div className="grid-form">
                <span className="muted">Campos tecnicos canônicos (mesmos do cadastro principal).</span>
              </div>
              <div className="inspections-inline-erosion-coordinates">
                <div className="inspections-inline-erosion-coordinates-head">
                  <strong>Coordenadas / UTM</strong>
                  <button
                    type="button"
                    className="secondary erosions-coordinates-toggle"
                    onClick={() => setInlineCoordinatesExpanded((prev) => !prev)}
                    aria-expanded={inlineCoordinatesExpanded ? 'true' : 'false'}
                    data-utm-error-token={inlineUtmErrorToken}
                  >
                    <span>{inlineCoordinatesStatus}</span>
                    <AppIcon name={inlineCoordinatesExpanded ? 'chevron-up' : 'chevron-down'} />
                  </button>
                </div>
                {inlineCoordinatesExpanded ? (
                  <>
                    <div className="grid-form">
                      <input
                        placeholder="Latitude (centesimal)"
                        value={erosionForm.locationCoordinates?.latitude || ''}
                        onChange={(e) => updateInlineLocationField('latitude', e.target.value)}
                      />
                      <input
                        placeholder="Longitude (centesimal)"
                        value={erosionForm.locationCoordinates?.longitude || ''}
                        onChange={(e) => updateInlineLocationField('longitude', e.target.value)}
                      />
                    </div>
                    <div className="grid-form">
                      <input
                        placeholder="UTM Easting"
                        value={erosionForm.locationCoordinates?.utmEasting || ''}
                        onChange={(e) => updateInlineLocationField('utmEasting', e.target.value)}
                      />
                      <input
                        placeholder="UTM Northing"
                        value={erosionForm.locationCoordinates?.utmNorthing || ''}
                        onChange={(e) => updateInlineLocationField('utmNorthing', e.target.value)}
                      />
                    </div>
                    <div className="grid-form">
                      <input
                        placeholder="UTM Zona"
                        value={erosionForm.locationCoordinates?.utmZone || ''}
                        onChange={(e) => updateInlineLocationField('utmZone', e.target.value)}
                      />
                      <select
                        value={erosionForm.locationCoordinates?.utmHemisphere || ''}
                        onChange={(e) => updateInlineLocationField('utmHemisphere', e.target.value)}
                      >
                        <option value="">Hemisferio UTM...</option>
                        <option value="N">N</option>
                        <option value="S">S</option>
                      </select>
                    </div>
                    <div className="grid-form">
                      <input
                        placeholder="Altitude"
                        value={erosionForm.locationCoordinates?.altitude || ''}
                        onChange={(e) => updateInlineLocationField('altitude', e.target.value)}
                      />
                      <input
                        placeholder="Referencia"
                        value={erosionForm.locationCoordinates?.reference || ''}
                        onChange={(e) => updateInlineLocationField('reference', e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <ErosionTechnicalFields
                formData={erosionForm}
                onPatch={(patch) => setErosionForm((prev) => ({ ...prev, ...patch }))}
              />

              <div className="inspections-inline-erosion-text-grid">
                <textarea
                  rows="2"
                  className="inspections-inline-erosion-textarea inspections-inline-erosion-textarea-links"
                  placeholder="Fotos (links, um por linha)"
                  value={Array.isArray(erosionForm.fotosLinks) ? erosionForm.fotosLinks.join('\n') : ''}
                  onChange={(e) => setErosionForm((prev) => ({
                    ...prev,
                    fotosLinks: String(e.target.value || '')
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  }))}
                />
                <textarea
                  rows="3"
                  className="inspections-inline-erosion-textarea inspections-inline-erosion-textarea-large inspections-inline-erosion-textarea-full"
                  placeholder="Descricao"
                  value={erosionForm.descricao}
                  onChange={(e) => setErosionForm((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </div>
            </div>
            <div className="row-actions inspections-inline-erosion-actions">
              {onOpenErosionDraft ? (
                <button
                  type="button"
                  className="secondary inspections-inline-erosion-draft-btn"
                  onClick={handleOpenErosionDraft}
                >
                  <AppIcon name="details" />
                  Abrir cadastro completo na aba Erosoes
                </button>
              ) : null}
              <div className="inspections-inline-erosion-actions-main">
                <button type="submit">
                  <AppIcon name="save" />
                  {erosionModal.existingErosion ? 'Salvar alteracoes' : 'Salvar erosao'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setErosionModal(null);
                    setErosionForm(buildSafeInlineErosionFormState());
                    setInlineCoordinatesExpanded(false);
                    setInlineUtmErrorToken(0);
                  }}
                >
                  <AppIcon name="close" />
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>,
    portalTarget,
  );
}

export default InspectionFormWizardModal;
