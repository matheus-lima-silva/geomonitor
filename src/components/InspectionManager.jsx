import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoSaveInspection } from '../hooks/useAutoSaveInspection';
import { createEmptyInspection } from '../models/inspectionModel';
import { saveErosion } from '../services/erosionService';
import { gerarPeriodoDias, preservarDetalhesDias } from '../utils/dateUtils';
import { parseTowerInput } from '../utils/parseTowerInput';
import { useToast } from '../context/ToastContext';
import {
  EROSION_LOCATION_OPTIONS,
  validateErosionLocation,
} from '../features/erosions/utils/erosionUtils';

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
    if (typed) source = parseTowerInput(typed).numbers;
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

function createInspectionId(projetoId, dataInicio) {
  if (!projetoId || !dataInicio) return `VS-${Date.now()}`;
  const [yyyy, mm, dd] = String(dataInicio).split('-');
  return `VS-${String(projetoId).toUpperCase()}-${dd}${mm}${yyyy}`;
}

function InspectionManager({
  projects,
  erosions,
  actorName,
  onSaved,
  planningDraft,
  onPlanningDraftConsumed,
}) {
  const [inspection, setInspection] = useState(createEmptyInspection());
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [torreModal, setTorreModal] = useState(null);
  const [suggestedTowerInput, setSuggestedTowerInput] = useState('');
  const autoPendingCheckRef = useRef('');
  const { ensureSaved, saving } = useAutoSaveInspection();
  const { show } = useToast();

  const diaAtual = useMemo(
    () => inspection.detalhesDias.find((dia) => dia.data === diaSelecionado),
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

  function applySuggestedTowersToCurrentDay() {
    if (!diaSelecionado || !suggestedTowerInput) return;
    const torres = parseTowerInput(suggestedTowerInput);
    atualizarDia(diaSelecionado, (dia) => ({
      ...dia,
      torres: torres,
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
      setTorreModal(numeroTorre);
    } catch {
      show('Não foi possível salvar vistoria antes da erosão.', 'error');
    }
  }

  async function handleSaveErosion(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const localTipo = String(formData.get('localTipo') || '').trim();
      const localDescricao = String(formData.get('localDescricao') || '').trim();
      const locationValidation = validateErosionLocation({ localTipo, localDescricao });
      if (!locationValidation.ok) {
        show(locationValidation.message, 'error');
        return;
      }

      await saveErosion({
        vistoriaId: inspection.id,
        vistoriaIds: [...new Set([inspection.id])],
        projetoId: inspection.projetoId,
        torreRef: String(torreModal),
        latitude: formData.get('latitude') || '',
        longitude: formData.get('longitude') || '',
        localTipo,
        localDescricao,
        obs: formData.get('descricao') || '',
      }, { origem: 'vistoria' });

      atualizarDia(diaSelecionado, (dia) => ({
        ...dia,
        torresDetalhadas: dia.torresDetalhadas.map((torre) =>
          towerMatches(torre.numero, torreModal) ? { ...torre, temErosao: true } : torre,
        ),
      }));

      setTorreModal(null);
      show('Erosão cadastrada com sucesso.', 'success');
    } catch {
      show('Erro ao cadastrar erosão.', 'error');
    }
  }

  function resolveInspectionProjectId(explicitProjectId = '') {
    return String(explicitProjectId || inspection.projetoId || '').trim();
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

  function getPendingErosionsForInspection(inspectionId, explicitProjectId = '') {
    const projectId = resolveInspectionProjectId(explicitProjectId);
    if (!projectId || !inspectionId) return [];
    const projectErosions = (erosions || []).filter((item) => String(item?.projetoId || '').trim() === projectId);
    return projectErosions.filter((erosion) => {
      const pendency = getInspectionPendency(erosion, inspectionId);
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
    show(`Pendências de visita em erosões: ${towers.join(', ') || '-'}. As torres já foram carregadas para marcação da data.`, 'error');
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
        const confirmed = window.confirm(
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
    <section className="panel nested">
      <h3>Nova Vistoria</h3>
      <p className="muted">Diário multi-dia com checklist por torre e cadastro de erosão.</p>

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
          placeholder="Responsável"
          value={inspection.responsavel || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, responsavel: e.target.value }))}
        />
        <input
          placeholder="Observações gerais"
          value={inspection.obs || ''}
          onChange={(e) => setInspection((prev) => ({ ...prev, obs: e.target.value }))}
        />
      </div>

      <div className="row-actions">
        <button type="button" onClick={handleSaveInspection} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar vistoria'}
        </button>
      </div>

      {suggestedTowerInput && (
        <div className="notice">
          <div><strong>Torres sugeridas:</strong> {suggestedTowerInput}</div>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={applySuggestedTowersToCurrentDay} disabled={!diaSelecionado}>
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
        <div className="panel nested">
          <h4>Diário de {diaAtual.data}</h4>
          <input
            placeholder="Clima"
            value={diaAtual.clima}
            onChange={(e) => atualizarDia(diaSelecionado, (dia) => ({ ...dia, clima: e.target.value }))}
          />

          <input
            placeholder="Torres visitadas (ex: 1-3, 5, 8)"
            onBlur={(e) => {
              const torres = parseTowerInput(e.target.value);
              atualizarDia(diaSelecionado, (dia) => ({
                ...dia,
                torres,
                torresDetalhadas: torres.map(
                  (numero) => dia.torresDetalhadas.find((item) => item.numero === numero) ?? { numero, obs: '', temErosao: false },
                ),
              }));
            }}
          />

          <ul>
            {diaAtual.torresDetalhadas.map((torre) => (
              <li key={torre.numero} className={torre.temErosao ? 'erosion' : ''}>
                <strong>Torre {torre.numero}</strong>
                <input
                  placeholder="Observação"
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
                <button type="button" onClick={() => abrirModalErosao(torre.numero)} disabled={saving}>
                  {saving ? 'Salvando...' : 'Detalhar'}
                </button>
                {(() => {
                  const linked = (erosions || []).filter((item) =>
                    String(item?.projetoId || '').trim() === String(inspection.projetoId || '').trim()
                    && String(item?.torreRef || '').trim() === String(torre.numero || '').trim());
                  if (linked.length === 0) return null;
                  const pendency = linked
                    .map((item) => getInspectionPendency(item, inspection.id))
                    .find(Boolean);
                  const visited = pendency?.status === 'visitada' && pendency?.dia;
                  return (
                    <button type="button" className="secondary" onClick={() => markTowerErosionVisit(torre.numero)} disabled={saving}>
                      {visited ? `Visitada em ${pendency.dia}` : 'Marcar visita da erosão'}
                    </button>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {torreModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSaveErosion}>
            <h4>Erosão - Torre {torreModal}</h4>
            <select name="localTipo" defaultValue="">
              <option value="">Local da erosão...</option>
              {EROSION_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <input name="localDescricao" placeholder="Detalhe do local (obrigatório se Outros)" />
            <input name="latitude" placeholder="Latitude" />
            <input name="longitude" placeholder="Longitude" />
            <textarea name="descricao" placeholder="Descrição" rows="4" />
            <div className="row-actions">
              <button type="submit">Salvar erosão</button>
              <button type="button" className="secondary" onClick={() => setTorreModal(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export default InspectionManager;
