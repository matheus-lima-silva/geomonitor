import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { Button, Modal } from './ui';
import { useAutoSaveInspection } from '../hooks/useAutoSaveInspection';
import { createEmptyInspection } from '../models/inspectionModel';
import { saveErosion } from '../services/erosionService';
import { gerarPeriodoDias, preservarDetalhesDias } from '../utils/dateUtils';
import { parseTowerInput } from '../utils/parseTowerInput';
import { useToast } from '../context/ToastContext';
import {
  EROSION_LOCATION_OPTIONS,
  validateErosionLocation,
} from '../features/shared/viewUtils';
import {
  buildHotelHistory,
  extractHotelFields,
  findPreviousDayHotel,
} from '../features/inspections/utils/hotelHistory';

function normalizeInspectionPendencies(value) {
  const raw = Array.isArray(value) ? value : [];
  const dedup = new Map();
  raw.forEach((item) => {
    const vistoriaId = String(item?.vistoriaId || '').trim();
    if (!vistoriaId) return;
    dedup.set(vistoriaId, {
      vistoriaId,
      status: String(item?.status || '').trim().toLowerCase() === 'visitada' ? 'visitada' : 'pendente',
      dia: String(item?.dia || '').trim(),
    });
  });
  return [...dedup.values()];
}

function toBrDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return text;
  return '';
}

function isBrDateValid(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeTowerKey(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return String(numeric);
  return text.toUpperCase();
}

function collectDayTowerKeys(day) {
  const detailed = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas.map((item) => item?.numero) : [];
  let source = detailed;
  if (source.length === 0 && Array.isArray(day?.torres)) source = day.torres;
  if (source.length === 0) {
    const typed = String(day?.torresInput ?? day?.torres ?? '').trim();
    if (typed) source = parseTowerInput(typed);
  }
  return [...new Set(source.map((item) => normalizeTowerKey(item)).filter(Boolean))];
}

function findDuplicateTowersAcrossDays(details) {
  const days = Array.isArray(details) ? details : [];
  const map = new Map();
  days.forEach((day) => {
    const dayLabel = toBrDate(day?.data) || String(day?.data || '').trim() || 'Dia sem data';
    collectDayTowerKeys(day).forEach((tower) => {
      if (!map.has(tower)) map.set(tower, new Set());
      map.get(tower).add(dayLabel);
    });
  });

  return [...map.entries()]
    .map(([tower, daySet]) => ({ tower, days: [...daySet] }))
    .filter((item) => item.days.length > 1)
    .sort((a, b) => {
      const aNum = Number(a.tower);
      const bNum = Number(b.tower);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      return String(a.tower).localeCompare(String(b.tower));
    });
}

function upsertInspectionPendency(erosion, inspectionId, patch = {}) {
  const vistoriaId = String(inspectionId || '').trim();
  if (!vistoriaId) return normalizeInspectionPendencies(erosion?.pendenciasVistoria);
  const current = normalizeInspectionPendencies(erosion?.pendenciasVistoria);
  const map = new Map(current.map((item) => [item.vistoriaId, item]));
  const prev = map.get(vistoriaId) || { vistoriaId, status: 'pendente', dia: '' };
  map.set(vistoriaId, { ...prev, ...patch, vistoriaId });
  return [...map.values()];
}

function getInspectionPendency(erosion, inspectionId) {
  const vistoriaId = String(inspectionId || '').trim();
  if (!vistoriaId) return null;
  return normalizeInspectionPendencies(erosion?.pendenciasVistoria)
    .find((item) => item.vistoriaId === vistoriaId) || null;
}

function normalizeLinkedInspectionIds(erosion) {
  const primary = String(erosion?.vistoriaId || '').trim();
  const fromList = Array.isArray(erosion?.vistoriaIds) ? erosion.vistoriaIds : [];
  const fromPendencies = normalizeInspectionPendencies(erosion?.pendenciasVistoria).map((item) => item.vistoriaId);
  return [...new Set([
    primary,
    ...fromList.map((item) => String(item || '').trim()),
    ...fromPendencies.map((item) => String(item || '').trim()),
  ].filter(Boolean))];
}

function isErosionLinkedToInspection(erosion, inspectionId) {
  const iid = String(inspectionId || '').trim();
  if (!iid) return false;
  return normalizeLinkedInspectionIds(erosion).includes(iid);
}

function createInspectionId(projetoId, dataInicio) {
  if (!projetoId || !dataInicio) return `VS-${Date.now()}`;
  const [yyyy, mm, dd] = String(dataInicio).split('-');
  return `VS-${String(projetoId).toUpperCase()}-${dd}${mm}${yyyy}`;
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

const EMPTY_EROSION_FORM = {
  localTipo: '',
  localDescricao: '',
  latitude: '',
  longitude: '',
  descricao: '',
};

function formatHotelHistoryOption(item) {
  const usageText = Number(item?.usageCount || 0) > 1 ? ` | ${item.usageCount} usos` : '';
  const dateText = item?.lastDate ? ` | Ultimo uso: ${item.lastDate}` : '';
  return `${item.hotelNome}${item.hotelMunicipio ? ` (${item.hotelMunicipio})` : ''}${usageText}${dateText}`;
}

function InspectionManager({
  projects,
  erosions,
  inspections = [],
  actorName,
  onSaved,
  planningDraft,
  onPlanningDraftConsumed,
}) {
  const [inspection, setInspection] = useState(createEmptyInspection());
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [torreModal, setTorreModal] = useState(null);
  const [erosionForm, setErosionForm] = useState(EMPTY_EROSION_FORM);
  const [expandedTowerKey, setExpandedTowerKey] = useState('');
  const [selectedHotelHistoryKey, setSelectedHotelHistoryKey] = useState('');
  const [suggestedTowerInput, setSuggestedTowerInput] = useState('');
  const [warningModal, setWarningModal] = useState(null);
  const autoPendingCheckRef = useRef('');
  const { ensureSaved, saving } = useAutoSaveInspection();
  const { show } = useToast();

  const diaAtual = useMemo(
    () => inspection.detalhesDias.find((dia) => dia.data === diaSelecionado),
    [inspection.detalhesDias, diaSelecionado],
  );

  const hotelHistory = useMemo(
    () => buildHotelHistory({
      inspections,
      draftInspection: inspection,
      projectId: inspection.projetoId,
    }),
    [inspections, inspection],
  );

  const selectedHotelHistory = useMemo(
    () => hotelHistory.find((item) => item.key === selectedHotelHistoryKey) || null,
    [hotelHistory, selectedHotelHistoryKey],
  );

  const previousDayHotel = useMemo(
    () => findPreviousDayHotel(inspection.detalhesDias, diaSelecionado),
    [inspection.detalhesDias, diaSelecionado],
  );

  function sincronizarDias(nextInspection) {
    const datas = gerarPeriodoDias(nextInspection.dataInicio, nextInspection.dataFim);
    const detalhesDias = preservarDetalhesDias(nextInspection.detalhesDias, datas);

    const firstDate = detalhesDias[0]?.data ?? '';
    if (!diaSelecionado && firstDate) setDiaSelecionado(firstDate);

    return { ...nextInspection, detalhesDias };
  }

  function atualizarDia(data, updater) {
    setInspection((prev) => ({
      ...prev,
      detalhesDias: prev.detalhesDias.map((dia) => (dia.data === data ? updater(dia) : dia)),
    }));
  }

  function applyHotelToDay(hotelData) {
    if (!diaSelecionado || !hotelData) return;
    const fields = extractHotelFields(hotelData);
    atualizarDia(diaSelecionado, (dia) => ({
      ...dia,
      ...fields,
    }));
  }

  function handleApplySelectedHotelHistory() {
    if (!selectedHotelHistory) {
      show('Selecione um hotel do historico para aplicar.', 'error');
      return;
    }
    applyHotelToDay(selectedHotelHistory);
    show('Dados de hospedagem aplicados ao dia atual.', 'success');
  }

  function handleRepeatPreviousDayHotel() {
    if (!previousDayHotel) {
      show('Nao ha hotel valido no dia anterior para repetir.', 'error');
      return;
    }
    applyHotelToDay(previousDayHotel);
    show(`Hotel do dia anterior (${previousDayHotel.date}) aplicado com sucesso.`, 'success');
  }

  function applySuggestedTowersToCurrentDay() {
    if (!diaSelecionado || !suggestedTowerInput) return;
    const torres = parseTowerInput(suggestedTowerInput);
    atualizarDia(diaSelecionado, (dia) => ({
      ...dia,
      torres: torres,
      torresInput: suggestedTowerInput,
      torresDetalhadas: torres.map(
        (numero) => dia.torresDetalhadas.find((item) => item.numero === numero) ?? { numero, obs: '', temErosao: false },
      ),
    }));
    show('Torres sugeridas aplicadas ao dia selecionado.', 'success');
  }

  async function abrirModalErosao(numeroTorre) {
    try {
      const inspectionId = await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });
      setInspection((prev) => ({ ...prev, id: inspectionId }));
      const latestErosion = getLatestLinkedErosion(erosions, inspection.projetoId, numeroTorre);
      setTorreModal({
        towerNumber: String(numeroTorre),
        existingErosion: latestErosion,
      });
      setErosionForm({
        localTipo: String(latestErosion?.localTipo || '').trim(),
        localDescricao: String(latestErosion?.localDescricao || '').trim(),
        latitude: String(latestErosion?.latitude || '').trim(),
        longitude: String(latestErosion?.longitude || '').trim(),
        descricao: String(latestErosion?.obs || '').trim(),
      });
    } catch {
      show('Nao foi possivel salvar vistoria antes da erosao.', 'error');
    }
  }

  async function handleSaveErosion(event) {
    event.preventDefault();

    try {
      if (!torreModal?.towerNumber) {
        show('Torre nao definida para o detalhe da erosao.', 'error');
        return;
      }

      const localTipo = String(erosionForm.localTipo || '').trim();
      const localDescricao = String(erosionForm.localDescricao || '').trim();
      const locationValidation = validateErosionLocation({ localTipo, localDescricao });
      if (!locationValidation.ok) {
        show(locationValidation.message, 'error');
        return;
      }

      const inspectionId = String(inspection.id || '').trim() || await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });
      setInspection((prev) => ({ ...prev, id: inspectionId }));

      const existing = torreModal.existingErosion || null;
      const payload = {
        ...(existing || {}),
        ...(existing?.id ? { id: existing.id } : {}),
        vistoriaId: inspectionId,
        vistoriaIds: existing
          ? [...new Set([inspectionId, ...normalizeLinkedInspectionIds(existing)])]
          : [inspectionId],
        projetoId: inspection.projetoId,
        torreRef: String(torreModal.towerNumber),
        latitude: String(erosionForm.latitude || '').trim(),
        longitude: String(erosionForm.longitude || '').trim(),
        localTipo,
        localDescricao,
        obs: String(erosionForm.descricao || '').trim(),
      };
      await saveErosion(payload, {
        origem: 'vistoria',
        merge: !!existing,
        updatedBy: actorName,
      });

      atualizarDia(diaSelecionado, (dia) => ({
        ...dia,
        torresDetalhadas: dia.torresDetalhadas.map((torre) =>
          towerMatches(torre.numero, torreModal.towerNumber) ? { ...torre, temErosao: true } : torre,
        ),
      }));

      setTorreModal(null);
      setErosionForm(EMPTY_EROSION_FORM);
      show(existing ? 'Erosao atualizada com sucesso.' : 'Erosao cadastrada com sucesso.', 'success');
    } catch {
      show('Erro ao salvar erosao.', 'error');
    }
  }

  function resolveInspectionProjectId(explicitProjectId = '') {
    return String(explicitProjectId || inspection.projetoId || '').trim();
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

  function getPendingErosionsForInspection(inspectionId, explicitProjectId = '') {
    const projectId = resolveInspectionProjectId(explicitProjectId);
    if (!projectId || !inspectionId) return [];
    const projectErosions = (erosions || []).filter((item) => String(item?.projetoId || '').trim() === projectId);
    return projectErosions.filter((erosion) => {
      const pendency = getInspectionPendency(erosion, inspectionId);
      if (!pendency) return false;
      const hasVisitDate = pendency?.status === 'visitada' && String(pendency?.dia || '').trim();
      return !hasVisitDate;
    });
  }

  function ensurePendingTowersVisible(pendingErosions) {
    setInspection((prev) => {
      const targetDay = diaSelecionado || prev.detalhesDias?.[0]?.data || '';
      if (!targetDay) return prev;

      const pendingTowers = [...new Set(
        (pendingErosions || [])
          .map((item) => String(item?.torreRef || '').trim())
          .filter(Boolean),
      )];

      const nextDays = (prev.detalhesDias || []).map((day) => {
        if (day.data !== targetDay) return day;

        const map = new Map((day.torresDetalhadas || []).map((item) => [String(item?.numero || '').trim(), item]));
        pendingTowers.forEach((tower) => {
          const existing = map.get(tower);
          if (!existing) {
            map.set(tower, { numero: tower, obs: '', temErosao: true });
            return;
          }
          map.set(tower, { ...existing, temErosao: true });
        });

        const merged = [...map.values()].sort((a, b) => Number(a.numero) - Number(b.numero));
        const towerInput = merged.map((item) => item.numero).join(', ');
        return {
          ...day,
          torres: merged.map((item) => item.numero),
          torresDetalhadas: merged,
          ...(towerInput ? { torresInput: towerInput } : {}),
        };
      });

      return { ...prev, detalhesDias: nextDays };
    });

    setDiaSelecionado((prev) => prev || inspection.detalhesDias?.[0]?.data || '');
  }

  function alertPendingTowers(pendingErosions) {
    const towers = [...new Set((pendingErosions || []).map((item) => String(item?.torreRef || '').trim()).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));
    show(`Pendências de visita em erosões: ${towers.join(', ') || '-'}. As torres já foram carregadas para marcação da data.`, 'info');
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

    const pending = getPendingErosionsForInspection(normalizedInspectionId, normalizedProjectId);
    if (pending.length > 0) {
      ensurePendingTowersVisible(pending);
      if (notifyWhenPending) alertPendingTowers(pending);
    }
    return pending;
  }

  async function markTowerErosionVisit(towerNumber) {
    try {
      const projectInspectionDate = diaSelecionado || '';
      const defaultDate = toBrDate(projectInspectionDate) || toBrDate(new Date().toISOString().slice(0, 10));
      const typed = window.prompt('Informe a data da visita (DD/MM/AAAA):', defaultDate);
      if (typed === null) return;
      const visitDate = String(typed || '').trim();
      if (!isBrDateValid(visitDate)) {
        show('Data inválida. Use o formato DD/MM/AAAA.', 'error');
        return;
      }
      const inspectionId = await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });
      setInspection((prev) => ({ ...prev, id: inspectionId }));
      const projectId = String(inspection.projetoId || '').trim();
      const towerKey = String(towerNumber || '').trim();
      const targetErosions = (erosions || []).filter((item) =>
        String(item?.projetoId || '').trim() === projectId
        && String(item?.torreRef || '').trim() === towerKey);
      if (targetErosions.length === 0) {
        show('Não há erosão cadastrada nessa torre para marcar visita.', 'error');
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
      show(`Visita da erosão marcada para ${visitDate}.`, 'success');
    } catch {
      show('Erro ao marcar visita da erosão.', 'error');
    }
  }

  function towerMatches(a, b) {
    return String(a) === String(b);
  }

  useEffect(() => {
    if (!planningDraft) return undefined;
    autoPendingCheckRef.current = '';
    setInspection((prev) => ({
      ...prev,
      projetoId: planningDraft.projectId || prev.projetoId,
      id: prev.id || createInspectionId(planningDraft.projectId || prev.projetoId, prev.dataInicio),
    }));
    setSuggestedTowerInput(planningDraft.towerInput || '');
    onPlanningDraftConsumed?.();
    return undefined;
  }, [planningDraft, onPlanningDraftConsumed]);

  useEffect(() => {
    const inspectionId = String(inspection.id || '').trim();
    const projectId = String(inspection.projetoId || '').trim();
    const hasDays = Array.isArray(inspection.detalhesDias) && inspection.detalhesDias.length > 0;
    if (!inspectionId || !projectId || !hasDays) return;

    const checkKey = `${inspectionId}|${projectId}`;
    if (autoPendingCheckRef.current === checkKey) return;
    autoPendingCheckRef.current = checkKey;

    (async () => {
      try {
        await checkInspectionPendencies({
          inspectionId,
          projectId,
          syncBeforeCheck: false,
          notifyWhenPending: true,
        });
      } catch {
        show('Erro ao verificar pendências de erosão nesta vistoria.', 'error');
      }
    })();
  }, [inspection.id, inspection.projetoId, inspection.detalhesDias, erosions]);

  useEffect(() => {
    setExpandedTowerKey('');
    setSelectedHotelHistoryKey('');
  }, [diaSelecionado, inspection.projetoId]);

  function showConfirm(message) {
    return new Promise((resolve) => {
      setWarningModal({
        message,
        onConfirm: () => { setWarningModal(null); resolve(true); },
        onCancel: () => { setWarningModal(null); resolve(false); },
      });
    });
  }

  async function handleSaveInspection() {
    try {
      if (!inspection.projetoId || !inspection.dataInicio) {
        show('Selecione empreendimento e data de início.', 'error');
        return;
      }

      const duplicateTowers = findDuplicateTowersAcrossDays(inspection.detalhesDias);
      if (duplicateTowers.length > 0) {
        const sample = duplicateTowers
          .slice(0, 8)
          .map((item) => `- Torre ${item.tower}: ${item.days.join(', ')}`)
          .join('\n');
        const overflow = duplicateTowers.length > 8 ? `\n... e mais ${duplicateTowers.length - 8} torre(s).` : '';
        const confirmed = await showConfirm(
          `Há torres registradas em mais de um dia nesta vistoria:\n${sample}${overflow}\n\nIsso pode estar correto em caso de revisita.\nClique em OK para continuar ou Cancelar para revisar.`,
        );
        if (!confirmed) {
          show('Salvamento cancelado para revisão das torres repetidas.', 'error');
          return;
        }
      }

      const inspectionId = await ensureSaved({
        ...inspection,
        id: inspection.id || createInspectionId(inspection.projetoId, inspection.dataInicio),
      });

      const pending = await checkInspectionPendencies({
        inspectionId,
        projectId: inspection.projetoId,
        syncBeforeCheck: true,
        notifyWhenPending: true,
      }).catch(() => {
        // A vistoria foi persistida; não bloquear finalização por falha de sincronização auxiliar.
        show('Vistoria salva, mas não foi possível sincronizar pendências de erosão agora.', 'info');
        return [];
      });
      if (pending.length > 0) {
        setInspection((prev) => ({ ...prev, id: inspectionId }));
        return;
      }

      setInspection((prev) => ({ ...prev, id: inspectionId }));
      show('Vistoria salva com sucesso.', 'success');
      onSaved?.(inspectionId);
    } catch {
      show('Erro ao salvar vistoria.', 'error');
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
      <h3 className="text-lg font-bold text-slate-800 m-0">Nova Vistoria</h3>
      <p className="text-sm text-slate-500">Diario multi-dia com checklist por torre e cadastro de erosao.</p>

      <div className="grid-form">
        <select value={inspection.projetoId} onChange={(e) => setInspection((prev) => ({ ...prev, projetoId: e.target.value }))}>
          <option value="">Selecione um empreendimento</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.nome}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={inspection.dataInicio}
          onChange={(e) => setInspection((prev) => sincronizarDias({ ...prev, dataInicio: e.target.value, id: createInspectionId(prev.projetoId, e.target.value) }))}
        />
        <input
          type="date"
          value={inspection.dataFim}
          onChange={(e) => setInspection((prev) => sincronizarDias({ ...prev, dataFim: e.target.value }))}
        />
        <input
          placeholder="Responsavel"
          value={inspection.responsavel || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, responsavel: e.target.value }))}
        />
        <input
          placeholder="Observacoes gerais"
          value={inspection.obs || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, obs: e.target.value }))}
        />
      </div>

      <div className="row-actions">
        <button type="button" onClick={handleSaveInspection} disabled={saving}>
          <AppIcon name="save" />
          {saving ? 'Salvando...' : 'Salvar vistoria'}
        </button>
      </div>

      {suggestedTowerInput && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mt-3">
          <div><strong>Torres sugeridas:</strong> {suggestedTowerInput}</div>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={applySuggestedTowersToCurrentDay} disabled={!diaSelecionado}>
              <AppIcon name="clipboard" />
              Aplicar torres sugeridas ao dia atual
            </button>
          </div>
        </div>
      )}

      <div className="chips">
        {inspection.detalhesDias.map((dia) => (
          <button key={dia.data} type="button" className={diaSelecionado === dia.data ? 'chip-active' : ''} onClick={() => setDiaSelecionado(dia.data)}>
            {dia.data}
          </button>
        ))}
      </div>

      {diaAtual && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-3">
          <h4>Diario de {diaAtual.data}</h4>
          <input
            placeholder="Clima"
            value={diaAtual.clima}
            onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, clima: e.target.value }))}
          />

          <div className="bg-white border border-slate-200 rounded-lg p-4 mt-3 flex flex-col gap-3">
            <div className="grid-form hotel-actions-grid">
              <select value={selectedHotelHistoryKey} onChange={(e) => setSelectedHotelHistoryKey(e.target.value)}>
                <option value="">Usar hotel do historico do empreendimento...</option>
                {hotelHistory.map((item) => (
                  <option key={item.key} value={item.key}>
                    {formatHotelHistoryOption(item)}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={handleApplySelectedHotelHistory} disabled={!selectedHotelHistoryKey}>
                <AppIcon name="clipboard" />
                Aplicar do historico
              </button>
              <button type="button" className="secondary" onClick={handleRepeatPreviousDayHotel} disabled={!previousDayHotel}>
                <AppIcon name="copy" />
                Repetir hotel do dia anterior
              </button>
            </div>
            {selectedHotelHistory && (
              <small className="text-sm text-slate-500">
                Selecionado: {selectedHotelHistory.hotelNome}
                {selectedHotelHistory.hotelMunicipio ? ` (${selectedHotelHistory.hotelMunicipio})` : ''}
              </small>
            )}
            {previousDayHotel && (
              <small className="text-sm text-slate-500">
                Dia anterior disponivel ({previousDayHotel.date}): {previousDayHotel.hotelNome || 'Sem nome'}
              </small>
            )}
          </div>

          <div className="grid-form">
            <input
              placeholder="Hotel (opcional)"
              value={diaAtual.hotelNome || ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelNome: e.target.value }))}
            />
            <input
              placeholder="Municipio do hotel (opcional)"
              value={diaAtual.hotelMunicipio || ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelMunicipio: e.target.value }))}
            />
            <select
              value={diaAtual.hotelLogisticaNota ?? ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelLogisticaNota: e.target.value }))}
            >
              <option value="">Logistica (1-5)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <select
              value={diaAtual.hotelReservaNota ?? ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelReservaNota: e.target.value }))}
            >
              <option value="">Reserva (1-5)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <select
              value={diaAtual.hotelEstadiaNota ?? ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelEstadiaNota: e.target.value }))}
            >
              <option value="">Estadia (1-5)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <select
              value={diaAtual.hotelTorreBase || ''}
              onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, hotelTorreBase: e.target.value }))}
            >
              <option value="">Torre base da hospedagem (opcional)</option>
              {(diaAtual.torresDetalhadas || []).map((item) => (
                <option key={`hotel-base-${diaSelecionado}-${item.numero}`} value={item.numero}>
                  Torre {item.numero}
                </option>
              ))}
            </select>
          </div>

          <input
            placeholder="Torres visitadas (ex: 1-3, 5, 8)"
            value={diaAtual.torresInput ?? (Array.isArray(diaAtual.torres) ? diaAtual.torres.join(', ') : '')}
            onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, torresInput: e.target.value }))}
            onBlur={(e) => {
              const towerInput = e.target.value;
              const torres = parseTowerInput(towerInput);
              atualizarDia(diaSelecionado, (dia) => ({
                ...dia,
                torres,
                torresInput: towerInput,
                torresDetalhadas: torres.map(
                  (numero) => dia.torresDetalhadas.find((item) => item.numero === numero) ?? { numero, obs: '', temErosao: false },
                ),
              }));
            }}
          />

          <ul className="tower-list">
            {diaAtual.torresDetalhadas.map((torre) => {
              const towerKey = String(torre.numero || '').trim();
              const linked = (erosions || []).filter((item) =>
                String(item?.projetoId || '').trim() === String(inspection.projetoId || '').trim()
                && String(item?.torreRef || '').trim() === towerKey);
              const pendency = linked
                .map((item) => getInspectionPendency(item, inspection.id))
                .find(Boolean);
              const visited = pendency?.status === 'visitada' && pendency?.dia;
              const isExpanded = expandedTowerKey === towerKey;

              return (
                <li key={towerKey} className={`tower-item ${torre.temErosao ? 'erosion' : ''}`}>
                  <div className="tower-item-header">
                    <div className="tower-item-title">
                      <strong>Torre {towerKey}</strong>
                      <span className="text-sm text-slate-500">
                        {linked.length > 0 ? `${linked.length} erosao(oes) vinculada(s)` : 'Sem erosao vinculada'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setExpandedTowerKey((prev) => (prev === towerKey ? '' : towerKey))}
                    >
                      <AppIcon name="details" />
                      {isExpanded ? 'Ocultar' : 'Detalhar'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="tower-item-details">
                      <div className="grid-form">
                        <input
                          placeholder="Observacao"
                          value={torre.obs}
                          onChange={(e) =>
                            atualizarDia(diaSelecionado, (dia) => ({
                              ...dia,
                              torresDetalhadas: dia.torresDetalhadas.map((item) =>
                                item.numero === torre.numero ? { ...item, obs: e.target.value } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="text-sm text-slate-500">
                        <div><strong>Resumo:</strong> {linked.length > 0 ? 'Ha erosao vinculada nesta torre.' : 'Nenhuma erosao vinculada ainda.'}</div>
                        <div>
                          <strong>Pendencia desta vistoria:</strong>
                          {' '}
                          {visited ? `visitada em ${pendency.dia}` : (linked.length > 0 ? 'pendente' : 'sem pendencia')}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button type="button" onClick={() => abrirModalErosao(torre.numero)} disabled={saving}>
                          <AppIcon name="details" />
                          {saving ? 'Salvando...' : 'Detalhar erosao'}
                        </button>
                        {linked.length > 0 && (
                          <button type="button" className="secondary" onClick={() => markTowerErosionVisit(torre.numero)} disabled={saving}>
                            <AppIcon name="check" />
                            {visited ? `Visitada em ${pendency.dia}` : 'Marcar visita da erosao'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {torreModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSaveErosion}>
            <h4>Erosao - Torre {torreModal.towerNumber}</h4>
            {torreModal.existingErosion?.id && (
              <p className="text-sm text-slate-500">Editando erosao existente: {torreModal.existingErosion.id}</p>
            )}
            <select
              name="localTipo"
              value={erosionForm.localTipo}
              onChange={(e) => setErosionForm((prev) => ({ ...prev, localTipo: e.target.value }))}
            >
              <option value="">Local da erosao...</option>
              {EROSION_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <input
              name="localDescricao"
              placeholder="Detalhe do local (obrigatorio se Outros)"
              value={erosionForm.localDescricao}
              onChange={(e) => setErosionForm((prev) => ({ ...prev, localDescricao: e.target.value }))}
            />
            <input
              name="latitude"
              placeholder="Latitude"
              value={erosionForm.latitude}
              onChange={(e) => setErosionForm((prev) => ({ ...prev, latitude: e.target.value }))}
            />
            <input
              name="longitude"
              placeholder="Longitude"
              value={erosionForm.longitude}
              onChange={(e) => setErosionForm((prev) => ({ ...prev, longitude: e.target.value }))}
            />
            <textarea
              name="descricao"
              placeholder="Descricao"
              rows="4"
              value={erosionForm.descricao}
              onChange={(e) => setErosionForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <div className="row-actions">
              <button type="submit">
                <AppIcon name="save" />
                {torreModal.existingErosion ? 'Salvar alteracoes' : 'Salvar erosao'}
              </button>
              <button type="button" className="secondary" onClick={() => setTorreModal(null)}>
                <AppIcon name="close" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {warningModal && (
        <Modal
          open={true}
          onClose={warningModal.onCancel}
          title="Confirmar"
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={warningModal.onCancel}>
                <AppIcon name="close" /> Cancelar
              </Button>
              <Button onClick={warningModal.onConfirm}>
                <AppIcon name="check" /> Confirmar
              </Button>
            </>
          }
        >
          <p className="m-0 text-sm text-slate-700 whitespace-pre-wrap">{warningModal.message}</p>
        </Modal>
      )}
    </section>
  );
}

export default InspectionManager;
