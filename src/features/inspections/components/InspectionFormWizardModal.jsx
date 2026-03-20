import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '../../../components/AppIcon';
import { Button, IconButton, Input, Select, Textarea } from '../../../components/ui';
import { saveInspection } from '../../../services/inspectionService';
import { postCalculoErosao, saveErosion } from '../../../services/erosionService';
import { useLocalStorageDraft } from '../../../hooks/useLocalStorageDraft';
import { useToast } from '../../../context/ToastContext';
import { gerarPeriodoDias, preservarDetalhesDias } from '../../../utils/dateUtils';
import { parseTowerInput } from '../../../utils/parseTowerInput';
import {
  buildCriticalityInputFromErosion,
  deriveErosionTypeFromTechnicalFields,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
  validateErosionRequiredFields,
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
  isErosionLinkedToInspection,
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
  registroHistorico: false,
  intervencaoRealizada: '',
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
    registroHistorico: isHistoricalErosionRecord(raw),
    intervencaoRealizada: String(raw.intervencaoRealizada || '').trim(),
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
      // Preserve trailing spaces while the user is typing in the daily checklist comment.
      obs: String(tower?.obs || ''),
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

  const draftKey = `geomonitor_inspection_draft_${initialData?.id || 'novo'}`;
  const [formData, setFormData, clearDraft] = useLocalStorageDraft(draftKey, normalizeInspectionForm(initialData));

  const [expandedDay, setExpandedDay] = useState('');
  const [expandedTowerKey, setExpandedTowerKey] = useState('');
  const [collapsedTowerPickerDays, setCollapsedTowerPickerDays] = useState({});
  const [openHotelPickerDayKey, setOpenHotelPickerDayKey] = useState('');
  const [hotelPickerSearch, setHotelPickerSearch] = useState('');
  const [erosionModal, setErosionModal] = useState(null);
  const [erosionForm, setErosionForm] = useState(() => buildSafeInlineErosionFormState());
  const [inlineValidationErrors, setInlineValidationErrors] = useState({});
  const [inlineCoordinatesExpanded, setInlineCoordinatesExpanded] = useState(false);
  const [inlineUtmErrorToken, setInlineUtmErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const autoPendingCheckRef = useRef('');
  const hotelPickerRef = useRef(null);
  const hotelPickerSearchRef = useRef(null);
  const inlineErosionOverlayRef = useRef(null);
  const inlineErosionBodyRef = useRef(null);

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
    setStep(1);
    setExpandedDay((prev) => prev || formData?.detalhesDias?.[0]?.data || '');
    setExpandedTowerKey('');
    setCollapsedTowerPickerDays({});
    setOpenHotelPickerDayKey('');
    setHotelPickerSearch('');
    setErosionModal(null);
    setErosionForm(buildSafeInlineErosionFormState());
    setInlineValidationErrors({});
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

  useEffect(() => {
    if (!erosionModal) return;
    if (inlineErosionOverlayRef.current) {
      inlineErosionOverlayRef.current.scrollTop = 0;
    }
    if (inlineErosionBodyRef.current) {
      inlineErosionBodyRef.current.scrollTop = 0;
    }
  }, [erosionModal]);

  if (!open) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  const inlineCoordinatesStatus = getInlineCoordinatesStatus(erosionForm.locationCoordinates || {});
  const inlineIsHistoricalRecord = isHistoricalErosionRecord(erosionForm);

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

  function updateInlineStatus(value) {
    setErosionForm((prev) => ({
      ...prev,
      status: value,
      registroHistorico: value === 'Estabilizado'
        ? true
        : Boolean(prev?.registroHistorico),
    }));
  }

  function toggleInlineHistoricalRecord(enabled) {
    setErosionForm((prev) => {
      const currentStatus = String(prev?.status || '').trim() || 'Ativo';
      return {
        ...prev,
        registroHistorico: enabled,
        status: enabled
          ? (currentStatus === 'Ativo' ? 'Monitoramento' : currentStatus)
          : (currentStatus === 'Estabilizado' ? 'Monitoramento' : currentStatus),
      };
    });
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

  function ensureLocalInspectionId() {
    const currentId = String(formData.id || '').trim();
    if (currentId) return currentId;

    const nextInspectionId = buildInspectionId(formData.projetoId, formData.dataInicio, inspections) || `VS-${Date.now()}`;
    setFormData((prev) => {
      const prevId = String(prev.id || '').trim();
      if (prevId) return prev;
      return { ...prev, id: nextInspectionId };
    });
    return nextInspectionId;
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
    const linkedErosions = (erosions || []).filter((item) =>
      String(item?.projetoId || '').trim() === projectId
      && isErosionLinkedToInspection(item, inspectionId));
    await Promise.all(linkedErosions.map((erosion) => saveErosion({
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
        show(`Pendencias de visita em erosoes: ${towers.join(', ') || '-'}. As torres foram carregadas.`, 'info');
      }
    }

    return pending;
  }

  function openErosionFromTower(dayIndex, towerNumber) {
    const inspectionId = ensureLocalInspectionId();
    const latest = getLatestLinkedErosion(erosions, formData.projetoId, towerNumber);
    setFormData((prev) => ({ ...prev, id: inspectionId }));
    setErosionModal({
      dayIndex,
      towerNumber: String(towerNumber || '').trim(),
      existingErosion: latest,
    });
    const locationCoordinates = normalizeLocationCoordinates(latest || {});
    setErosionForm(buildSafeInlineErosionFormState(latest));
    setInlineValidationErrors({});
    setInlineCoordinatesExpanded(hasAnyLocationValue(locationCoordinates));
    setInlineUtmErrorToken(0);
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

      const requiredValidation = validateErosionRequiredFields({
        ...erosionForm,
        projetoId: formData.projetoId,
        torreRef: String(erosionModal.towerNumber || '').trim(),
      });
      setInlineValidationErrors(requiredValidation.fieldErrors);
      if (!requiredValidation.ok) {
        show(requiredValidation.message || 'Preencha os campos obrigatorios destacados.', 'error');
        return;
      }

      const inspectionId = await ensureInspectionSavedForInlineActions();
      const existing = erosionModal.existingErosion || null;
      const photos = Array.isArray(erosionForm.fotosLinks)
        ? erosionForm.fotosLinks.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const invalidPhoto = photos.find((item) => !/^https?:\/\//i.test(item));
      if (invalidPhoto) {
        setInlineValidationErrors((prev) => ({ ...prev, fotosLinks: `Link de foto invalido: ${invalidPhoto}` }));
        show(`Link de foto invalido: ${invalidPhoto}`, 'error');
        return;
      }

      const isHistoricalRecord = requiredValidation.historical;
      const technicalValidation = isHistoricalRecord
        ? { ok: true, value: normalizeErosionTechnicalFields(erosionForm) }
        : validateErosionTechnicalFields(erosionForm);
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
        ...Object.fromEntries(Object.entries(erosionForm || {}).filter(([key]) => key !== 'caracteristicasFeicao')),
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
      };
      let criticalidadeV2 = null;
      let alertasValidacao = [];

      if (!isHistoricalRecord) {
        const criticalityInput = buildCriticalityInputFromErosion(normalizedTechnicalData);
        const calculoResponse = await postCalculoErosao(criticalityInput);
        criticalidadeV2 = calculoResponse.campos_calculados || null;
        alertasValidacao = Array.isArray(calculoResponse.alertas_validacao)
          ? calculoResponse.alertas_validacao
          : [];

        if (alertasValidacao.length > 0) {
          const shouldContinue = window.confirm(
            `Foram encontrados alertas tecnicos:\\n\\n- ${alertasValidacao.join('\\n- ')}\\n\\nDeseja salvar mesmo assim?`,
          );
          if (!shouldContinue) return;
        }
      }

      const existingPayload = existing && typeof existing === 'object'
        ? Object.fromEntries(Object.entries(existing).filter(([key]) => key !== 'caracteristicasFeicao'))
        : {};

      const payload = {
        ...existingPayload,
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
        registroHistorico: isHistoricalRecord,
        intervencaoRealizada: String(erosionForm.intervencaoRealizada || '').trim(),
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        locationCoordinates: locationResult.locationCoordinates,
        localContexto: technicalValidation.value.localContexto,
        presencaAguaFundo: technicalValidation.value.presencaAguaFundo,
        tiposFeicao: technicalValidation.value.tiposFeicao,
        usosSolo: technicalValidation.value.usosSolo,
        usoSoloOutro: technicalValidation.value.usoSoloOutro,
        saturacaoPorAgua: technicalValidation.value.saturacaoPorAgua,
        tipoSolo: technicalValidation.value.tipoSolo,
        profundidadeMetros: technicalValidation.value.profundidadeMetros,
        declividadeGraus: technicalValidation.value.declividadeGraus,
        distanciaEstruturaMetros: technicalValidation.value.distanciaEstruturaMetros,
        sinaisAvanco: technicalValidation.value.sinaisAvanco,
        vegetacaoInterior: technicalValidation.value.vegetacaoInterior,
        impacto: isHistoricalRecord ? '' : existing?.impacto,
        score: isHistoricalRecord ? null : existing?.score,
        frequencia: isHistoricalRecord ? '' : existing?.frequencia,
        intervencao: isHistoricalRecord
          ? (String(erosionForm.intervencaoRealizada || '').trim() || 'Intervencao ja executada')
          : existing?.intervencao,
        medidaPreventiva: isHistoricalRecord
          ? ''
          : (Array.isArray(criticalidadeV2?.lista_solucoes_sugeridas)
            ? (criticalidadeV2.lista_solucoes_sugeridas[0] || '')
            : ''),
        fotosLinks: photos,
        obs: String(erosionForm.descricao || '').trim(),
        criticalidadeV2: isHistoricalRecord ? null : criticalidadeV2,
        alertsAtivos: isHistoricalRecord ? [] : alertasValidacao,
        criticality: isHistoricalRecord ? null : criticalidadeV2?.legacy,
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
      setInlineValidationErrors({});
      setInlineCoordinatesExpanded(false);
      setInlineUtmErrorToken(0);
      show(existing ? 'Erosao atualizada com sucesso.' : 'Erosao cadastrada com sucesso.', 'success');
    } catch (err) {
      show(err?.message || 'Erro ao salvar erosao.', 'error');
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
      const projectId = String(formData.projetoId || '').trim();
      const towerRef = String(erosionModal.towerNumber || '').trim();
      if (!projectId) {
        show('Selecione empreendimento antes de abrir o cadastro completo.', 'error');
        return;
      }
      if (!towerRef) {
        show('Torre nao definida para erosao.', 'error');
        return;
      }

      setInlineValidationErrors({});

      const isHistoricalRecord = isHistoricalErosionRecord(erosionForm);
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
      const invalidPhoto = photos.find((item) => !/^https?:\/\//i.test(item));
      if (invalidPhoto) {
        setInlineValidationErrors((prev) => ({ ...prev, fotosLinks: `Link de foto invalido: ${invalidPhoto}` }));
        show(`Link de foto invalido: ${invalidPhoto}`, 'error');
        return;
      }

      const inspectionId = await ensureInspectionSavedForInlineActions();
      const technicalData = normalizeErosionTechnicalFields(erosionForm);
      const existing = erosionModal.existingErosion || null;
      const linkedInspectionIds = existing
        ? [...new Set([inspectionId, ...normalizeLinkedInspectionIds(existing)])]
        : [inspectionId];

      onOpenErosionDraft({
        projetoId: projectId,
        vistoriaId: inspectionId,
        vistoriaIds: linkedInspectionIds,
        torreRef: towerRef,
        tipo: deriveErosionTypeFromTechnicalFields({ ...erosionForm, tiposFeicao: technicalData.tiposFeicao }),
        estagio: String(erosionForm.estagio || '').trim(),
        status: String(erosionForm.status || 'Ativo').trim() || 'Ativo',
        registroHistorico: isHistoricalRecord,
        intervencaoRealizada: String(erosionForm.intervencaoRealizada || '').trim(),
        locationCoordinates: locationResult.locationCoordinates,
        latitude: locationResult.latitude || '',
        longitude: locationResult.longitude || '',
        localContexto: technicalData.localContexto,
        presencaAguaFundo: technicalData.presencaAguaFundo,
        tiposFeicao: technicalData.tiposFeicao,
        usosSolo: technicalData.usosSolo,
        usoSoloOutro: technicalData.usoSoloOutro,
        saturacaoPorAgua: technicalData.saturacaoPorAgua,
        tipoSolo: technicalData.tipoSolo,
        profundidadeMetros: technicalData.profundidadeMetros,
        declividadeGraus: technicalData.declividadeGraus,
        distanciaEstruturaMetros: technicalData.distanciaEstruturaMetros,
        sinaisAvanco: technicalData.sinaisAvanco,
        vegetacaoInterior: technicalData.vegetacaoInterior,
        fotosLinks: photos,
        obs: String(erosionForm.descricao || '').trim(),
      });

      setErosionModal(null);
      setErosionForm(buildSafeInlineErosionFormState());
      setInlineValidationErrors({});
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

      let pending = [];
      try {
        pending = await checkInspectionPendencies({
          inspectionId,
          projectId: formData.projetoId,
          syncBeforeCheck: true,
          notifyWhenPending: true,
        });
      } catch {
        // A vistoria já foi persistida; não bloquear fechamento por falha de sincronização auxiliar.
        show('Vistoria salva, mas nao foi possivel sincronizar pendencias de erosao agora.', 'info');
      }

      if (pending.length > 0) {
        setFormData((prev) => ({ ...prev, id: inspectionId }));
        setStep(2);
        return;
      }

      clearDraft();
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onCancel}></div>
      <div
        className="bg-white w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl relative z-10 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar Vistoria' : 'Nova Vistoria'}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-200 bg-white shrink-0 min-h-[82px]">
          <div>
            <h3 className="text-xl font-bold text-slate-800 m-0 leading-tight">{isEditing ? 'Editar Vistoria' : 'Nova Vistoria'}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-0">Wizard em 3 etapas com preenchimento drill-down por dia e torre.</p>
          </div>
          <IconButton type="button" variant="ghost" size="md" aria-label="Fechar" onClick={onCancel}>
            <AppIcon name="close" />
          </IconButton>
        </div>

        <div className="flex bg-slate-50 border-b border-slate-200 px-6 py-2 overflow-x-auto gap-2 shrink-0">
          <Button type="button" size="md" variant={step === 1 ? 'primary' : 'ghost'} className="px-4 rounded-full whitespace-nowrap" onClick={() => setStep(1)}>1. Dados gerais</Button>
          <Button type="button" size="md" variant={step === 2 ? 'primary' : 'ghost'} className="px-4 rounded-full whitespace-nowrap" onClick={() => setStep(2)}>2. Diario</Button>
          <Button type="button" size="md" variant={step === 3 ? 'primary' : 'ghost'} className="px-4 rounded-full whitespace-nowrap" onClick={() => setStep(3)}>3. Revisao</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {step === 1 ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <Input
                  id="inspection-id"
                  label="ID"
                  value={formData.id || ''}
                  disabled
                  className="bg-slate-100 text-slate-500 cursor-not-allowed"
                  placeholder="ID gerado automaticamente"
                />
                <Select
                  id="inspection-project"
                  label="Empreendimento *"
                  value={formData.projetoId}
                  onChange={(e) => updateGeneralField('projetoId', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {(projects || []).map((project) => (
                    <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>
                  ))}
                </Select>
                <Input
                  id="inspection-responsavel"
                  label="Responsavel"
                  value={formData.responsavel || ''}
                  onChange={(e) => updateGeneralField('responsavel', e.target.value)}
                  placeholder="Nome do responsavel"
                />
                <Input
                  id="inspection-date-start"
                  label="Data inicio *"
                  type="date"
                  value={formData.dataInicio || ''}
                  onChange={(e) => updateGeneralField('dataInicio', e.target.value)}
                />
                <Input
                  id="inspection-date-end"
                  label="Data fim"
                  type="date"
                  value={formData.dataFim || ''}
                  onChange={(e) => updateGeneralField('dataFim', e.target.value)}
                />
              </div>
              <Textarea
                id="inspection-obs"
                label="Observacoes"
                rows={3}
                value={formData.obs || ''}
                onChange={(e) => updateGeneralField('obs', e.target.value)}
                placeholder="Observacoes gerais da vistoria..."
              />
              {suggestedTowerInput ? (
                <div className="bg-info-light text-brand-800 p-4 rounded-xl border border-info-border text-sm">
                  <div><strong>Torres sugeridas pelo planejamento:</strong> {suggestedTowerInput}</div>
                </div>
              ) : null}
              {formData.detalhesDias.length === 0 ? (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100 text-sm">Defina data inicio e data fim para gerar os dias da vistoria.</div>
              ) : (
                <div className="bg-info-light text-brand-800 p-4 rounded-xl border border-info-border text-sm">
                  <strong>Dias gerados:</strong> {formData.detalhesDias.length}
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="flex flex-col gap-4">
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
                    <article key={day.data || dayIndex} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-center justify-between p-4 bg-white cursor-pointer select-none" onClick={() => setExpandedDay((prev) => (prev === day.data ? '' : day.data))}>
                        <div>
                          <strong className="text-slate-800 text-lg">{day.data ? new Date(`${day.data}T00:00:00`).toLocaleDateString('pt-BR') : `Dia ${dayIndex + 1}`}</strong>
                          <div className="text-sm text-slate-500">{(day.torresDetalhadas || []).length} torre(s) detalhada(s)</div>
                        </div>
                        <Button type="button" size="sm" variant="outline" className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); setExpandedDay((prev) => (prev === day.data ? '' : day.data)); }}>
                          <AppIcon name="details" />
                          {isDayExpanded ? 'Ocultar' : 'Detalhar dia'}
                        </Button>
                      </div>

                      {isDayExpanded ? (
                        <div className="p-5 border-t border-slate-100 flex flex-col gap-5 bg-slate-50/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select id={`inspection-day-weather-${dayIndex}`} label="Clima" value={day.clima || ''} onChange={(e) => updateDayField(dayIndex, { clima: e.target.value })}>
                              <option value="">Selecione...</option>
                              <option value="Sol">Sol</option>
                              <option value="Parcialmente Nublado">Parcialmente nublado</option>
                              <option value="Nublado">Nublado</option>
                              <option value="Chuva">Chuva</option>
                            </Select>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                              <label className="text-sm font-semibold text-slate-700 m-0">Torres selecionadas</label>
                              <div className="text-sm text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                                {selectedDayTowers.length > 0
                                  ? selectedDayTowers.map((tower) => formatTowerLabel(tower.numero)).join(', ')
                                  : 'Nenhuma torre selecionada.'}
                              </div>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50 cursor-pointer select-none" onClick={() => toggleTowerPickerCollapse(dayKey)}>
                              <div className="flex items-center gap-3 text-sm flex-wrap">
                                <strong className="text-slate-800">Selecionar torres do dia</strong>
                                <span className="text-slate-500 text-xs font-semibold px-2 py-0.5 bg-slate-200 rounded-full">{selectedDayTowers.length} selecionada(s)</span>
                              </div>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1"
                                onClick={(e) => { e.stopPropagation(); toggleTowerPickerCollapse(dayKey); }}
                              >
                                <AppIcon name={isTowerPickerCollapsed ? 'chevron-down' : 'chevron-up'} />
                                {isTowerPickerCollapsed ? 'Expandir' : 'Ocultar'}
                              </button>
                            </div>
                            {!isTowerPickerCollapsed ? (
                              <>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 p-3 max-h-[30vh] overflow-y-auto bg-slate-50">
                                  {projectTowerOptions.map((towerNumber) => {
                                    const active = selectedDayTowerKeys.has(String(towerNumber));
                                    return (
                                      <button
                                        key={`${dayKey}-picker-${towerNumber}`}
                                        type="button"
                                        className={`flex items-center justify-center p-2 border rounded-lg text-xs font-medium transition-colors ${active ? 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700 hover:border-brand-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'}`}
                                        onClick={() => toggleDayTower(dayIndex, towerNumber)}
                                      >
                                        {formatTowerLabel(towerNumber)}
                                      </button>
                                    );
                                  })}
                                </div>
                                {projectTowerOptions.length === 0 ? (
                                  <p className="text-sm text-slate-500 m-0 py-2 px-3">
                                    Este empreendimento nao possui total de torres valido para selecao.
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => clearDayTowerSelection(dayIndex)}
                              disabled={selectedDayTowers.length === 0}
                            >
                              <AppIcon name="close" />
                              Limpar selecao do dia
                            </Button>
                            {suggestedTowerInput ? (
                              <Button type="button" variant="outline" size="sm" className="px-3 py-1.5 border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => applySuggestedTowersToDay(dayIndex)}>
                                <AppIcon name="clipboard" />
                                Aplicar sugeridas
                              </Button>
                            ) : null}
                          </div>

                          <div className="bg-brand-50/50 border border-brand-100 p-4 rounded-xl flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div
                                className="relative flex-1 min-w-[200px]"
                                ref={isHotelPickerOpen ? hotelPickerRef : null}
                              >
                                <button
                                  type="button"
                                  className={`flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm w-full md:w-[350px] text-left transition-all ${isHotelPickerOpen ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-300 hover:border-brand-300'}`}
                                  aria-expanded={isHotelPickerOpen ? 'true' : 'false'}
                                  aria-haspopup="listbox"
                                  onClick={() => toggleHotelPicker(dayKey, String(day.hotelNome || ''))}
                                >
                                  <span className="truncate flex-1">
                                    {day.hotelNome
                                      ? `${day.hotelNome}${day.hotelMunicipio ? ` (${day.hotelMunicipio})` : ''}`
                                      : 'Selecionar hotel...'}
                                  </span>
                                  <AppIcon name={isHotelPickerOpen ? 'close' : 'details'} />
                                </button>

                                {isHotelPickerOpen ? (
                                  <div className="absolute top-[calc(100%+4px)] left-0 w-[400px] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden animate-slide-up origin-top" role="dialog" aria-label="Selecionar hotel">
                                    <label className="flex items-center gap-2 p-3 border-b border-slate-100 bg-slate-50 text-slate-400">
                                      <AppIcon name="search" />
                                      <input
                                        ref={hotelPickerSearchRef}
                                        type="search"
                                        className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                                        value={hotelPickerSearch}
                                        placeholder="Buscar hotel por nome ou municipio..."
                                        onChange={(e) => setHotelPickerSearch(e.target.value)}
                                      />
                                    </label>

                                    <div className="max-h-[250px] overflow-y-auto flex flex-col" role="listbox" aria-label="Historico de hoteis">
                                      {filteredHotelHistory.map((item) => (
                                        <button
                                          key={item.key}
                                          type="button"
                                          className="text-left w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 border-b border-slate-50 last:border-none transition-colors"
                                          onClick={() => handleSelectHotelFromHistory(dayIndex, item)}
                                        >
                                          {formatHistoryOption(item)}
                                        </button>
                                      ))}
                                      {canCreateHotelFromSearch ? (
                                        <button
                                          type="button"
                                          className="text-left w-full px-4 py-2.5 text-sm font-semibold text-brand-700 bg-brand-50/50 hover:bg-brand-100 transition-colors border-t border-brand-100"
                                          onClick={() => handleCreateNewHotel(dayIndex)}
                                        >
                                          Criar novo hotel: "{String(hotelPickerSearch || '').trim()}"
                                        </button>
                                      ) : null}
                                      {filteredHotelHistory.length === 0 && !canCreateHotelFromSearch ? (
                                        <div className="px-4 py-3 text-sm text-slate-500 italic">Nenhum hotel encontrado.</div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <Button type="button" variant="outline" size="sm" className="px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => repeatPreviousDayHotel(dayIndex)} disabled={!previousHotel}>
                                <AppIcon name="copy" />
                                Repetir dia anterior
                              </Button>
                            </div>
                            {previousHotel ? (
                              <small className="text-sm text-slate-500">
                                Hotel anterior disponivel ({previousHotel.date}): {previousHotel.hotelNome || 'Sem nome'}
                              </small>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <Input id={`inspection-hotel-name-${dayIndex}`} value={day.hotelNome || ''} onChange={(e) => updateDayField(dayIndex, { hotelNome: e.target.value })} placeholder="Hotel (opcional)" />
                            <Input id={`inspection-hotel-city-${dayIndex}`} value={day.hotelMunicipio || ''} onChange={(e) => updateDayField(dayIndex, { hotelMunicipio: e.target.value })} placeholder="Municipio do hotel" />
                            <Select id={`inspection-hotel-logistics-${dayIndex}`} value={day.hotelLogisticaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelLogisticaNota: e.target.value })}>
                              <option value="">Logistica (1-5)</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                            </Select>
                            <Select id={`inspection-hotel-booking-${dayIndex}`} value={day.hotelReservaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelReservaNota: e.target.value })}>
                              <option value="">Reserva (1-5)</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                            </Select>
                            <Select id={`inspection-hotel-stay-${dayIndex}`} value={day.hotelEstadiaNota ?? ''} onChange={(e) => updateDayField(dayIndex, { hotelEstadiaNota: e.target.value })}>
                              <option value="">Estadia (1-5)</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                            </Select>
                            <Select
                              id={`inspection-hotel-base-tower-${dayIndex}`}
                              className="disabled:opacity-60 disabled:bg-slate-100"
                              value={day.hotelTorreBase || ''}
                              onChange={(e) => updateDayField(dayIndex, { hotelTorreBase: e.target.value })}
                              disabled={selectedDayTowers.length === 0}
                            >
                              <option value="">
                                {selectedDayTowers.length === 0
                                  ? 'Selecione torres'
                                  : 'Torre base da hospedagem'}
                              </option>
                              {selectedDayTowers.map((tower) => (
                                <option key={`hotel-base-${dayIndex}-${tower.numero}`} value={tower.numero}>Torre {tower.numero}</option>
                              ))}
                            </Select>
                          </div>

                          {(day.torresDetalhadas || []).length > 0 ? (
                            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr>
                                    <th className="bg-slate-50 p-3 font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">Torre</th>
                                    <th className="bg-slate-50 p-3 font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">Observacao</th>
                                    <th className="bg-slate-50 p-3 font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">Acoes</th>
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
                                      <tr key={`${day.data}-${towerKey}`} className={hasErosion ? 'bg-red-50/50' : ''}>
                                        <td className="p-3 border-b border-slate-100 align-top w-[120px]">
                                          <span className="font-medium text-slate-800">{formatTowerLabel(towerKey)}</span>
                                        </td>
                                        <td className="p-3 border-b border-slate-100 align-top">
                                          <input
                                            className="w-full px-3 py-2 bg-slate-50 border border-transparent hover:border-slate-300 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 rounded-lg outline-none transition-all text-sm"
                                            value={tower?.obs || ''}
                                            onChange={(e) => updateTowerDetail(dayIndex, towerIndex, { obs: e.target.value })}
                                            placeholder="Observacoes da torre"
                                          />
                                          {expandedTower ? (
                                            <div className="mt-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                              <div><strong>Resumo:</strong> {linkedTowerErosions.length > 0 ? 'Ha erosao vinculada nesta torre.' : 'Sem erosao vinculada.'}</div>
                                              <div><strong>Pendencia:</strong> {hasVisitedDate ? `visitada em ${pendency.dia}` : (linkedTowerErosions.length > 0 ? 'pendente' : 'sem pendencia')}</div>
                                            </div>
                                          ) : null}
                                        </td>
                                        <td className="p-3 border-b border-slate-100 align-top w-[200px]">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <button
                                              type="button"
                                              className={`p-1.5 rounded-lg transition-colors ${expandedTower ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                              onClick={() => setExpandedTowerKey((prev) => (prev === key ? '' : key))}
                                              aria-label={expandedTower ? 'Ocultar detalhes da torre' : 'Detalhar torre'}
                                              title={expandedTower ? 'Ocultar detalhes da torre' : 'Detalhar torre'}
                                            >
                                              <AppIcon name="details" />
                                            </button>
                                            <button
                                              type="button"
                                              className={`p-1.5 rounded-lg transition-colors ${hasErosion ? 'text-red-600 bg-red-100 hover:bg-red-200' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                              onClick={() => openErosionFromTower(dayIndex, towerKey)}
                                              aria-label={hasErosion ? 'Editar erosao vinculada' : 'Cadastrar erosao nesta torre'}
                                              title={hasErosion ? 'Editar erosao vinculada' : 'Cadastrar erosao nesta torre'}
                                              disabled={saving}
                                            >
                                              <AppIcon name="alert" />
                                            </button>
                                            {linkedTowerErosions.length > 0 ? (
                                              <button type="button" className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1" onClick={() => markPendingErosionVisit(dayIndex, towerKey)}>
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
                            <div className="text-sm text-slate-500 italic p-2">Sem torres detalhadas para este dia. Gere o checklist para continuar.</div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {formData.detalhesDias.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhum dia gerado. Volte para etapa 1 e defina as datas.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6 animate-fade-in p-6 pt-0">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h4 className="text-lg font-bold text-slate-800 m-0 mb-3">Resumo da vistoria</h4>
                <div className="text-sm text-slate-600 flex flex-col gap-1.5">
                  <div><strong className="text-slate-700">ID:</strong> {formData.id || '(sera gerado no salvar)'}</div>
                  <div><strong className="text-slate-700">Empreendimento:</strong> {formData.projetoId || '-'}</div>
                  <div><strong className="text-slate-700">Periodo:</strong> {formData.dataInicio || '-'} ate {formData.dataFim || formData.dataInicio || '-'}</div>
                  <div><strong className="text-slate-700">Responsavel:</strong> {formData.responsavel || '-'}</div>
                  <div><strong className="text-slate-700">Dias registados:</strong> {summary.daysCount}</div>
                  <div><strong className="text-slate-700">Dias com checklist:</strong> {summary.daysWithChecklist}</div>
                  <div><strong className="text-slate-700">Torres unicas no diario:</strong> {summary.uniqueTowerCount}</div>
                  <div><strong className="text-slate-700">Torres sinalizadas com erosao:</strong> {summary.towersWithErosion}</div>
                </div>
              </div>

              {findDuplicateTowersAcrossDays(formData.detalhesDias).length > 0 ? (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100 text-sm">
                  Existem torres registadas em mais de um dia. O sistema pedira confirmacao no salvamento.
                </div>
              ) : null}

              {suggestedTowerInput ? (
                <div className="bg-brand-50 text-brand-800 p-4 rounded-xl border border-brand-100 text-sm">
                  <strong>Torres sugeridas do planejamento:</strong> {suggestedTowerInput}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between p-6 bg-white border-t border-slate-200 shrink-0">
          <Button type="button" variant="outline" size="md" className="px-4 py-2" onClick={onCancel}>
            <AppIcon name="close" />
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" size="md" className="px-4 py-2" onClick={handlePreviousStep}>
                <AppIcon name="chevron-left" />
                Voltar
              </Button>
            ) : null}
            {step < 3 ? (
              <Button type="button" variant="primary" size="md" className="px-4 py-2 shadow-sm" onClick={handleNextStep}>
                Avancar
                <AppIcon name="chevron-right" />
              </Button>
            ) : (
              <Button type="button" variant="primary" size="md" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed" onClick={handleSaveInspection} disabled={saving}>
                <AppIcon name="save" />
                {saving ? 'Salvando...' : 'Salvar vistoria'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {erosionModal ? (
        <div
          data-testid="inspection-inline-erosion-modal"
          ref={inlineErosionOverlayRef}
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex min-h-[100dvh] items-start justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
        >
          <form
            className="bg-white w-full max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] min-h-0 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden"
            onSubmit={handleSaveErosion}
          >
            <div className="p-5 border-b border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 m-0">Erosao - {formatTowerLabel(erosionModal.towerNumber)}</h4>
              {erosionModal.existingErosion?.id ? (
                <p className="text-sm text-slate-500 mt-1 mb-0">Editando erosao existente: {erosionModal.existingErosion.id}</p>
              ) : null}
            </div>
            <div
              data-testid="inspection-inline-erosion-modal-body"
              ref={inlineErosionBodyRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 flex flex-col gap-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  id="inspection-erosion-stage"
                  label={inlineIsHistoricalRecord ? 'Grau erosivo' : 'Grau erosivo *'}
                  value={erosionForm.estagio || ''}
                  onChange={(e) => setErosionForm((prev) => ({ ...prev, estagio: e.target.value }))}
                  error={inlineValidationErrors.estagio}
                >
                  <option value="">Selecione...</option>
                  <option value="inicial">Inicial</option>
                  <option value="intermediario">Intermediario</option>
                  <option value="avancado">Avancado</option>
                  <option value="critico">Critico</option>
                </Select>
                <Select
                  id="inspection-erosion-status"
                  label="Status"
                  value={erosionForm.status || 'Ativo'}
                  onChange={(e) => updateInlineStatus(e.target.value)}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Monitoramento">Monitoramento</option>
                  <option value="Estabilizado">Estabilizado (histórico)</option>
                </Select>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={inlineIsHistoricalRecord}
                    onChange={(e) => toggleInlineHistoricalRecord(e.target.checked)}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-amber-950">Cadastro apenas para histórico de acompanhamento</span>
                    <span className="text-sm text-amber-900">
                      Esse modo também é ativado automaticamente quando o status for <strong>Estabilizado</strong>.
                    </span>
                  </div>
                </label>

                {inlineIsHistoricalRecord ? (
                  <Textarea
                    id="inspection-erosion-historical-note"
                    label="Intervenção já realizada / contexto histórico *"
                    rows={3}
                    value={erosionForm.intervencaoRealizada || ''}
                    onChange={(e) => setErosionForm((prev) => ({ ...prev, intervencaoRealizada: e.target.value }))}
                    error={inlineValidationErrors.intervencaoRealizada}
                    placeholder="Ex.: contenção e drenagem executadas anteriormente; registro mantido só para acompanhamento."
                  />
                ) : null}
              </div>
              <div>
                <span className="text-sm text-slate-500 italic block">Campos tecnicos canônicos (mesmos do cadastro principal).</span>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-700">Coordenadas / UTM</strong>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-3 py-1.5 bg-white text-xs"
                    onClick={() => setInlineCoordinatesExpanded((prev) => !prev)}
                    aria-expanded={inlineCoordinatesExpanded ? 'true' : 'false'}
                    data-utm-error-token={inlineUtmErrorToken}
                  >
                    <span>{inlineCoordinatesStatus}</span>
                    <AppIcon name={inlineCoordinatesExpanded ? 'chevron-up' : 'chevron-down'} />
                  </Button>
                </div>
                {inlineCoordinatesExpanded ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="inspection-erosion-latitude"
                        placeholder="Latitude (centesimal)"
                        value={erosionForm.locationCoordinates?.latitude || ''}
                        onChange={(e) => updateInlineLocationField('latitude', e.target.value)}
                      />
                      <Input
                        id="inspection-erosion-longitude"
                        placeholder="Longitude (centesimal)"
                        value={erosionForm.locationCoordinates?.longitude || ''}
                        onChange={(e) => updateInlineLocationField('longitude', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="inspection-erosion-utm-easting"
                        placeholder="UTM Easting"
                        value={erosionForm.locationCoordinates?.utmEasting || ''}
                        onChange={(e) => updateInlineLocationField('utmEasting', e.target.value)}
                      />
                      <Input
                        id="inspection-erosion-utm-northing"
                        placeholder="UTM Northing"
                        value={erosionForm.locationCoordinates?.utmNorthing || ''}
                        onChange={(e) => updateInlineLocationField('utmNorthing', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="inspection-erosion-utm-zone"
                        placeholder="UTM Zona"
                        value={erosionForm.locationCoordinates?.utmZone || ''}
                        onChange={(e) => updateInlineLocationField('utmZone', e.target.value)}
                      />
                      <Select
                        id="inspection-erosion-utm-hemisphere"
                        value={erosionForm.locationCoordinates?.utmHemisphere || ''}
                        onChange={(e) => updateInlineLocationField('utmHemisphere', e.target.value)}
                      >
                        <option value="">Hemisferio UTM...</option>
                        <option value="N">N</option>
                        <option value="S">S</option>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="inspection-erosion-altitude"
                        placeholder="Altitude"
                        value={erosionForm.locationCoordinates?.altitude || ''}
                        onChange={(e) => updateInlineLocationField('altitude', e.target.value)}
                      />
                      <Input
                        id="inspection-erosion-reference"
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
                validationErrors={inlineValidationErrors}
                isHistoricalRecord={inlineIsHistoricalRecord}
                onPatch={(patch) => setErosionForm((prev) => ({ ...prev, ...patch }))}
              />

              <div className="flex flex-col gap-4">
                <Textarea
                  id="inspection-erosion-photo-links"
                  label="Fotos (links, um por linha)"
                  rows={2}
                  className="font-mono whitespace-pre"
                  value={Array.isArray(erosionForm.fotosLinks) ? erosionForm.fotosLinks.join('\n') : ''}
                  onChange={(e) => setErosionForm((prev) => ({
                    ...prev,
                    fotosLinks: String(e.target.value || '')
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  }))}
                  error={inlineValidationErrors.fotosLinks}
                />
                <Textarea
                  id="inspection-erosion-description"
                  label="Observações"
                  rows={3}
                  placeholder="Descricao"
                  value={erosionForm.descricao}
                  onChange={(e) => setErosionForm((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4 rounded-b-2xl">
              {onOpenErosionDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="px-4 py-2 bg-white"
                  onClick={handleOpenErosionDraft}
                >
                  <AppIcon name="details" />
                  Abrir cadastro completo na aba Erosoes
                </Button>
              ) : <div></div>}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="px-4 py-2 bg-white"
                  onClick={() => {
                    setErosionModal(null);
                    setErosionForm(buildSafeInlineErosionFormState());
                    setInlineValidationErrors({});
                    setInlineCoordinatesExpanded(false);
                    setInlineUtmErrorToken(0);
                  }}
                >
                  <AppIcon name="close" />
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="md" className="px-4 py-2 shadow-sm">
                  <AppIcon name="save" />
                  {erosionModal.existingErosion ? 'Salvar alteracoes' : 'Salvar erosao'}
                </Button>
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
