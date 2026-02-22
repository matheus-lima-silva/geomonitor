import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { calculateCriticality } from '../../shared/rulesConfig';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import { deleteErosion, saveErosion } from '../../../services/erosionService';
import {
  appendFollowupEvent,
  buildManualFollowupEvent,
  buildErosionReportRows,
  buildErosionsCsv,
  buildImpactSummary,
  EROSION_LOCATION_OPTIONS,
  filterErosionsForReport,
  normalizeFollowupEventType,
  normalizeFollowupHistory,
  validateErosionLocation,
} from '../utils/erosionUtils';

const baseForm = {
  id: '',
  projetoId: '',
  vistoriaId: '',
  vistoriaIds: [],
  torreRef: '',
  localTipo: '',
  localDescricao: '',
  tipo: '',
  estagio: '',
  profundidade: '',
  declividade: '',
  largura: '',
  latitude: '',
  longitude: '',
  status: 'Ativo',
  obs: '',
  acompanhamentosResumo: [],
};

function getInspectionDateScore(inspection) {
  const candidates = [inspection?.dataFim, inspection?.dataInicio, inspection?.data];
  for (let i = 0; i < candidates.length; i += 1) {
    const d = new Date(candidates[i]);
    if (!Number.isNaN(d.getTime())) return d.getTime();
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
    const ia = inspectionById.get(String(a || '').trim());
    const ib = inspectionById.get(String(b || '').trim());
    const da = getInspectionDateScore(ia);
    const db = getInspectionDateScore(ib);
    if (da !== null && db !== null) return db - da;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return String(b || '').localeCompare(String(a || ''));
  })[0];
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

function openReportPdfWindow({ projectId, rows, selectedYears }) {
  const summary = buildImpactSummary(rows);
  const now = new Date();
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  const statusRows = Object.entries(summary.byStatus)
    .map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`)
    .join('');
  const impactRows = Object.entries(summary.byImpact)
    .map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`)
    .join('');

  const tableRows = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${row.vistoriaId || '-'}</td>
      <td>${row.torreRef || '-'}</td>
      <td>${row.localTipo || '-'}</td>
      <td>${row.status || '-'}</td>
      <td>${row.impacto || '-'}</td>
      <td>${row.ultimaAtualizacao || '-'}</td>
    </tr>
  `).join('');

  win.document.write(`
    <html>
      <head>
        <title>Relatório de Erosões - ${projectId}</title>
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
        <h1>Relatório de Processos Erosivos</h1>
        <div class="meta">
          <div><strong>Empreendimento:</strong> ${projectId}</div>
          <div><strong>Ano(s):</strong> ${selectedYears.length > 0 ? selectedYears.join(', ') : 'Todos'}</div>
          <div><strong>Período consolidado:</strong> ${selectedYears.length > 0 ? `${selectedYears[0]}-01-01 até ${selectedYears[selectedYears.length - 1]}-12-31` : 'Histórico completo do empreendimento'}</div>
          <div><strong>Gerado em:</strong> ${now.toLocaleString('pt-BR')}</div>
          <div><strong>Total de erosões:</strong> ${rows.length}</div>
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
              <th>Atualização</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7">Sem dados para o filtro selecionado.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function openErosionDetailsPdfWindow({ erosion, project, history }) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const historyHtml = (history || []).map((item) => {
    const itemType = normalizeFollowupEventType(item);
    const typeLabel = itemType === 'obra' ? 'Obra' : (itemType === 'autuacao' ? 'Autuação' : 'Sistema');
    const toneClass = itemType === 'obra' ? 'tone-obra' : (itemType === 'autuacao' ? 'tone-autuacao' : 'tone-sistema');
    const details = itemType === 'obra'
      ? `Etapa: ${escapeHtml(item.obraEtapa || '-')} | Descrição: ${escapeHtml(item.descricao || '-')}`
      : (itemType === 'autuacao'
        ? `Órgão: ${escapeHtml(item.orgao || '-')} | Nº/Descrição: ${escapeHtml(item.numeroOuDescricao || '-')} | Status: ${escapeHtml(item.autuacaoStatus || '-')}`
        : `Status da erosão: ${escapeHtml(item.statusNovo || '-')}`);
    return `
      <div class="timeline-item ${toneClass} avoid-break">
        <div class="timeline-head">
          <span class="badge">${escapeHtml(typeLabel)}</span>
          <span class="date">${escapeHtml(item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-')}</span>
        </div>
        <div class="timeline-summary">${escapeHtml(item.resumo || '-')}</div>
        <div class="timeline-details">${details}</div>
        <div class="timeline-meta">Usuário: ${escapeHtml(item.usuario || '-')} | Origem: ${escapeHtml(item.origem || '-')}</div>
      </div>
    `;
  }).join('');

  const obs = escapeHtml(String(erosion?.obs || '').trim() || '-').replace(/\n/g, '<br />');

  win.document.write(`
    <html>
      <head>
        <title>Detalhes da Erosão ${escapeHtml(erosion?.id || '-')}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; background: #f8fafc; }
          .wrapper { max-width: 100%; }
          .header { background: linear-gradient(135deg, #dbeafe 0%, #e2e8f0 100%); border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; }
          .title { font-size: 19px; font-weight: 700; margin: 0 0 4px 0; color: #1e3a8a; }
          .meta { color: #475569; font-size: 11px; }
          .section { margin-top: 12px; border: 1px solid #dbe4ee; border-radius: 10px; background: #ffffff; padding: 12px; }
          .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
          .row { line-height: 1.4; color: #1f2937; }
          .label { color: #475569; font-weight: 600; }
          .crit-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
          .crit-card { border: 1px solid #fdba74; border-radius: 8px; background: #fff7ed; padding: 8px; }
          .crit-card .k { color: #9a3412; font-size: 11px; font-weight: 600; }
          .crit-card .v { color: #7c2d12; font-size: 13px; font-weight: 700; margin-top: 2px; }
          .timeline-item { border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 8px; padding: 8px; margin-bottom: 8px; background: #fff; }
          .tone-obra { border-left-color: #3b82f6; background: #f8fbff; }
          .tone-autuacao { border-left-color: #f59e0b; background: #fffbeb; }
          .tone-sistema { border-left-color: #64748b; background: #f8fafc; }
          .timeline-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: #e2e8f0; color: #334155; }
          .date { font-size: 10px; color: #64748b; }
          .timeline-summary { font-weight: 600; color: #1f2937; margin-bottom: 2px; }
          .timeline-details { font-size: 11px; color: #334155; margin-bottom: 2px; }
          .timeline-meta { font-size: 10px; color: #64748b; }
          .empty { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; color: #64748b; background: #f8fafc; }
          .avoid-break { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header avoid-break">
            <h1 class="title">Detalhes da Erosão ${escapeHtml(erosion?.id || '-')}</h1>
            <div class="meta">Empreendimento: ${escapeHtml(erosion?.projetoId || '-')} ${project?.nome ? `(${escapeHtml(project.nome)})` : ''}</div>
            <div class="meta">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
          </div>

          <div class="section avoid-break">
            <h2 class="section-title">Resumo</h2>
            <div class="summary-grid">
              <div class="row"><span class="label">ID:</span> ${escapeHtml(erosion?.id || '-')}</div>
              <div class="row"><span class="label">Torre:</span> ${escapeHtml(erosion?.torreRef || '-')}</div>
              <div class="row"><span class="label">Status:</span> ${escapeHtml(erosion?.status || '-')}</div>
              <div class="row"><span class="label">Impacto:</span> ${escapeHtml(erosion?.impacto || '-')}</div>
              <div class="row"><span class="label">Coordenadas:</span> ${escapeHtml(`${erosion?.latitude || '-'}, ${erosion?.longitude || '-'}`)}</div>
              <div class="row"><span class="label">Última atualização:</span> ${escapeHtml(erosion?.ultimaAtualizacao ? new Date(erosion.ultimaAtualizacao).toLocaleString('pt-BR') : '-')}</div>
              <div class="row"><span class="label">Atualizado por:</span> ${escapeHtml(erosion?.atualizadoPor || '-')}</div>
              <div class="row"><span class="label">Local:</span> ${escapeHtml(erosion?.localTipo || '-')}</div>
            </div>
            <div class="row" style="margin-top:8px;"><span class="label">Observações:</span> ${obs}</div>
          </div>

          <div class="section avoid-break">
            <h2 class="section-title">Análise de Criticidade</h2>
            <div class="crit-grid">
              <div class="crit-card">
                <div class="k">Score de risco</div>
                <div class="v">${escapeHtml(erosion?.score ?? 'N/A')}</div>
              </div>
              <div class="crit-card">
                <div class="k">Frequência de revisita</div>
                <div class="v">${escapeHtml(erosion?.frequencia || '-')}</div>
              </div>
              <div class="crit-card">
                <div class="k">Intervenção recomendada</div>
                <div class="v">${escapeHtml(erosion?.intervencao || '-')}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Histórico de Acompanhamento</h2>
            ${historyHtml || '<div class="empty">Sem histórico de acompanhamento.</div>'}
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function ErosionsView({ erosions, projects, inspections, rulesConfig, searchTerm }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(baseForm);
  const [editingId, setEditingId] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    tipoEvento: 'obra',
    obraEtapa: 'Projeto',
    descricao: '',
    orgao: '',
    numeroOuDescricao: '',
    autuacaoStatus: 'Aberta',
  });
  const currentYear = new Date().getFullYear();
  const [reportFilters, setReportFilters] = useState({
    projetoId: '',
    ano: '',
    mostrarMultiAno: false,
    anosExtras: [],
  });

  const sorted = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    const base = [...erosions].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    if (!t) return base;
    return base.filter((e) =>
      String(e.id || '').toLowerCase().includes(t)
      || String(e.projetoId || '').toLowerCase().includes(t)
      || String(e.torreRef || '').toLowerCase().includes(t)
      || String(e.impacto || '').toLowerCase().includes(t),
    );
  }, [erosions, searchTerm]);

  const actorName = String(user?.displayName || user?.email || user?.uid || '').trim();

  const reportYears = useMemo(() => {
    if (!reportFilters.projetoId) return [currentYear];
    const inspectionsById = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));
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
        candidates.push(inspection?.dataFim, inspection?.dataInicio);
      });
      let parsedYear = null;
      for (let i = 0; i < candidates.length; i += 1) {
        const d = new Date(candidates[i]);
        if (!Number.isNaN(d.getTime())) {
          parsedYear = d.getFullYear();
          break;
        }
      }
      if (Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 9999) yearsSet.add(parsedYear);
    });
    const sortedYears = [...yearsSet].sort((a, b) => b - a);
    return sortedYears.length > 0 ? sortedYears : [currentYear];
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

  const relatedInspectionsInDetails = useMemo(() => {
    if (!detailsModal) return [];
    const ids = normalizeErosionInspectionIds(detailsModal);
    const byId = new Map((inspections || []).map((item) => [String(item?.id || '').trim(), item]));
    return ids.map((id) => ({
      id,
      inspection: byId.get(id) || null,
    }));
  }, [detailsModal, inspections]);

  function openNew() {
    setFormData({ ...baseForm, id: `ERS-${Date.now()}` });
    setEditingId('');
    setIsFormOpen(true);
  }

  function openEdit(erosion) {
    const inspectionIds = normalizeErosionInspectionIds(erosion);
    setFormData({
      ...baseForm,
      ...erosion,
      status: normalizeErosionStatus(erosion?.status),
      vistoriaId: resolvePrimaryInspectionId(inspectionIds, inspections),
      vistoriaIds: inspectionIds,
      localTipo: erosion?.localTipo || '',
      localDescricao: erosion?.localDescricao || '',
      acompanhamentosResumo: normalizeFollowupHistory(erosion?.acompanhamentosResumo),
    });
    setEditingId(erosion.id);
    setIsFormOpen(true);
  }

  function hasCoordinates(erosion) {
    const lat = Number(erosion?.latitude);
    const lng = Number(erosion?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  function openGoogleMapsRoute(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      show('Coordenadas inválidas para navegação.', 'error');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}&travelmode=driving`;
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

      const nextPayload = {
        ...formData,
        status: normalizeErosionStatus(formData.status),
      };
      const persisted = erosions.find((item) => item.id === formData.id) || null;
      const mergedInspectionIds = [...new Set([
        ...normalizeErosionInspectionIds(formData),
        ...normalizeErosionInspectionIds(persisted),
      ])];
      const primaryInspectionId = resolvePrimaryInspectionId(mergedInspectionIds, inspections);
      if (primaryInspectionId) {
        nextPayload.vistoriaId = primaryInspectionId;
        nextPayload.vistoriaIds = mergedInspectionIds;
      } else {
        nextPayload.vistoriaId = '';
        nextPayload.vistoriaIds = [];
      }

      const criticality = calculateCriticality(nextPayload, rulesConfig);

      await saveErosion(
        {
          ...nextPayload,
          criticality,
        },
        { updatedBy: actorName, merge: true },
      );

      setIsFormOpen(false);
      show('Erosão salva com sucesso.', 'success');
    } catch (e) {
      show(e.message || 'Erro ao salvar erosão.', 'error');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Excluir erosão ${id}?`)) return;
    await deleteErosion(id);
    show('Erosão excluída.', 'success');
  }

  function handleExportCsv() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para exportar.', 'error');
      return;
    }

    const filteredRows = filterErosionsForReport(erosions, {
      ...reportFilters,
      anos: selectedReportYears,
    }, inspections);
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

    const filteredRows = filterErosionsForReport(erosions, {
      ...reportFilters,
      anos: selectedReportYears,
    }, inspections);
    const rows = buildErosionReportRows(filteredRows);
    openReportPdfWindow({ projectId: reportFilters.projetoId, rows, selectedYears: selectedReportYears });
    show('PDF preparado para impressão.', 'success');
  }

  async function handleAddManualHistoryEvent() {
    if (!detailsModal) return;
    const tipo = String(eventForm.tipoEvento || '').trim();
    if (tipo === 'obra') {
      if (!String(eventForm.obraEtapa || '').trim()) {
        show('Selecione a etapa da obra.', 'error');
        return;
      }
      if (!String(eventForm.descricao || '').trim()) {
        show('Descreva a obra para registrar no histórico.', 'error');
        return;
      }
    } else if (tipo === 'autuacao') {
      if (!String(eventForm.orgao || '').trim()) {
        show('Informe o órgão público.', 'error');
        return;
      }
      if (!String(eventForm.numeroOuDescricao || '').trim()) {
        show('Informe o número ou descrição da autuação.', 'error');
        return;
      }
      if (!String(eventForm.autuacaoStatus || '').trim()) {
        show('Selecione o status da autuação.', 'error');
        return;
      }
    } else {
      show('Tipo de evento inválido.', 'error');
      return;
    }

    const target = erosions.find((item) => item.id === detailsModal.id) || detailsModal;
    const manualEvent = buildManualFollowupEvent(eventForm, { updatedBy: actorName });
    if (!manualEvent) {
      show('Dados do evento inválidos.', 'error');
      return;
    }

    setSavingEvent(true);
    try {
      const manualStep = String(manualEvent.obraEtapa || '').trim().toLowerCase();
      const shouldStabilize = manualEvent.tipoEvento === 'obra'
        && (manualStep === 'concluída' || manualStep === 'concluida');
      const nextStatus = shouldStabilize ? 'Estabilizado' : normalizeErosionStatus(target?.status);
      const nextInspectionIds = normalizeErosionInspectionIds(target);
      await saveErosion({
        ...target,
        status: nextStatus,
        vistoriaId: resolvePrimaryInspectionId(nextInspectionIds, inspections),
        vistoriaIds: nextInspectionIds,
        acompanhamentosResumo: appendFollowupEvent(target?.acompanhamentosResumo, manualEvent),
      }, {
        updatedBy: actorName,
        merge: true,
        skipAutoFollowup: true,
      });
      setDetailsModal((prev) => (prev ? {
        ...prev,
        status: nextStatus,
        acompanhamentosResumo: appendFollowupEvent(prev?.acompanhamentosResumo, manualEvent),
      } : prev));
      setShowAddEventForm(false);
      setEventForm({
        tipoEvento: 'obra',
        obraEtapa: 'Projeto',
        descricao: '',
        orgao: '',
        numeroOuDescricao: '',
        autuacaoStatus: 'Aberta',
      });
      show('Evento registado no histórico.', 'success');
    } catch (e) {
      show(e.message || 'Erro ao registar evento.', 'error');
    } finally {
      setSavingEvent(false);
    }
  }

  const calc = calculateCriticality(formData, rulesConfig);

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Erosões</h2>
          <p className="muted">Cadastro e acompanhamento das erosões identificadas.</p>
        </div>
        <button type="button" onClick={openNew}>Nova Erosão</button>
      </div>

      <div className="panel nested">
        <h3>Exportar relatório de erosões</h3>
        <div className="grid-form">
          <select value={reportFilters.projetoId} onChange={(e) => setReportFilters((prev) => ({ ...prev, projetoId: e.target.value, anosExtras: [] }))}>
            <option value="">Empreendimento...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.nome}</option>)}
          </select>
          <select value={String(reportFilters.ano)} onChange={(e) => setReportFilters((prev) => ({ ...prev, ano: e.target.value, anosExtras: (prev.anosExtras || []).filter((y) => Number(y) !== Number(e.target.value)) }))}>
            <option value="">Todos os anos</option>
            {reportYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button type="button" className="secondary" onClick={() => setReportFilters((prev) => ({ ...prev, mostrarMultiAno: !prev.mostrarMultiAno }))}>
            {reportFilters.mostrarMultiAno ? 'Ocultar seleção de mais anos' : 'Selecionar mais de um ano'}
          </button>
        </div>
        {reportFilters.mostrarMultiAno && (
          <div className="panel nested" style={{ marginTop: 10 }}>
            <div className="muted">Anos adicionais (além do ano principal)</div>
            <div className="chips">
              {reportYears.filter((year) => String(reportFilters.ano || '') === '' || Number(year) !== Number(reportFilters.ano)).map((year) => {
                const checked = (reportFilters.anosExtras || []).includes(year);
                return (
                  <label key={year} className="inline-row" style={{ border: '1px solid #cbd5e1', padding: '6px 8px', borderRadius: 8, background: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setReportFilters((prev) => {
                          const current = new Set((prev.anosExtras || []).map((y) => Number(y)));
                          if (e.target.checked) current.add(year);
                          else current.delete(year);
                          return { ...prev, anosExtras: [...current].sort((a, b) => a - b) };
                        });
                      }}
                    />
                    <span>{year}</span>
                  </label>
                );
              })}
              {reportYears.filter((year) => Number(year) !== Number(reportFilters.ano)).length === 0 && (
                <span className="muted">Sem outros anos disponíveis para este empreendimento.</span>
              )}
            </div>
          </div>
        )}
        <div className="row-actions">
          <button type="button" className="secondary" onClick={handleExportCsv}>Exportar CSV</button>
          <button type="button" onClick={handleExportPdf}>Exportar PDF</button>
        </div>
        <div className="muted">
          Filtro ativo: empreendimento <strong>{reportFilters.projetoId || '-'}</strong> | ano(s) <strong>{selectedReportYears.length > 0 ? selectedReportYears.join(', ') : 'Todos'}</strong>.
        </div>
      </div>

      <div className="project-cards">
        {sorted.map((e) => (
          <article key={e.id} className="project-card">
            <h3>{e.id}</h3>
            <div className="muted">
              <div><strong>Projeto:</strong> {e.projetoId || '-'}</div>
              <div><strong>Torre:</strong> {e.torreRef || '-'}</div>
              <div><strong>Local:</strong> {e.localTipo || '-'}</div>
              {e.localTipo === 'Outros' && <div><strong>Detalhe local:</strong> {e.localDescricao || '-'}</div>}
              <div><strong>Impacto:</strong> {e.impacto || '-'}</div>
              <div><strong>Status:</strong> <span className={erosionStatusClass(e.status)}>{normalizeErosionStatus(e.status)}</span></div>
            </div>
            <div className="row-actions two">
              <button type="button" className="secondary" onClick={() => setDetailsModal(e)}>Detalhes</button>
              <button type="button" className="secondary" onClick={() => openEdit(e)}>Editar</button>
              {hasCoordinates(e) && (
                <button type="button" onClick={() => openGoogleMapsRoute(e.latitude, e.longitude)}>Navegar</button>
              )}
              <button type="button" className="danger" onClick={() => handleDelete(e.id)}>Excluir</button>
            </div>
          </article>
        ))}
        {sorted.length === 0 && (
          <article className="project-card">
            <p className="muted">Nenhuma erosão encontrada.</p>
          </article>
        )}
      </div>

      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal xwide">
            <h3>{editingId ? 'Editar' : 'Nova'} Erosão</h3>
            <div className="grid-form">
              <input value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} placeholder="ID" />
              <select value={formData.projetoId} onChange={(e) => setFormData({ ...formData, projetoId: e.target.value })}>
                <option value="">Empreendimento...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
              </select>
              <select
                value={formData.vistoriaId}
                onChange={(e) => {
                  const nextInspection = String(e.target.value || '').trim();
                  const nextIds = [...new Set([
                    ...normalizeErosionInspectionIds(formData),
                    nextInspection,
                  ].filter(Boolean))];
                  setFormData({ ...formData, vistoriaId: nextInspection, vistoriaIds: nextIds });
                }}
              >
                <option value="">Vistoria...</option>
                {inspections.filter((i) => i.projetoId === formData.projetoId).map((i) => <option key={i.id} value={i.id}>{i.id}</option>)}
              </select>

              <input value={formData.torreRef} onChange={(e) => setFormData({ ...formData, torreRef: e.target.value })} placeholder="Torre" />
              <select value={formData.localTipo} onChange={(e) => setFormData({ ...formData, localTipo: e.target.value, localDescricao: e.target.value === 'Outros' ? formData.localDescricao : '' })}>
                <option value="">Local da erosão...</option>
                {EROSION_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {formData.localTipo === 'Outros' ? (
                <input value={formData.localDescricao} onChange={(e) => setFormData({ ...formData, localDescricao: e.target.value })} placeholder="Descreva o local" />
              ) : <div />}

              <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                <option value="">Tipo...</option>
                <option value="sulco">Sulco</option>
                <option value="ravina">Ravina</option>
                <option value="voçoroca">Voçoroca</option>
                <option value="deslizamento">Deslizamento</option>
              </select>
              <select value={formData.estagio} onChange={(e) => setFormData({ ...formData, estagio: e.target.value })}>
                <option value="">Estágio...</option>
                <option value="inicial">Inicial</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="critico">Crítico</option>
              </select>
              <select value={formData.profundidade} onChange={(e) => setFormData({ ...formData, profundidade: e.target.value })}>
                <option value="">Profundidade...</option>
                <option value="<0.5">&lt; 0.5m</option>
                <option value="0.5-1.5">0.5-1.5m</option>
                <option value="1.5-3.0">1.5-3.0m</option>
                <option value=">3.0">&gt; 3.0m</option>
              </select>
              <select value={formData.declividade} onChange={(e) => setFormData({ ...formData, declividade: e.target.value })}>
                <option value="">Declividade...</option>
                <option value="<15">&lt; 15°</option>
                <option value="15-30">15-30°</option>
                <option value="30-45">30-45°</option>
                <option value=">45">&gt; 45°</option>
              </select>
              <select value={formData.largura} onChange={(e) => setFormData({ ...formData, largura: e.target.value })}>
                <option value="">Largura...</option>
                <option value="<1">&lt; 1m</option>
                <option value="1-3">1-3m</option>
                <option value="3-5">3-5m</option>
                <option value=">5">&gt; 5m</option>
              </select>
              <input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="Latitude" />
              <input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="Longitude" />
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option>Ativo</option>
                <option>Monitoramento</option>
                <option>Estabilizado</option>
              </select>
              <textarea value={formData.obs} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} placeholder="Observações" rows="3" />
            </div>

            <div className="notice">
              <strong>Impacto:</strong> {calc.impacto} | <strong>Score:</strong> {calc.score} | <strong>Frequência:</strong> {calc.frequencia}
              <br />
              <strong>Intervenção:</strong> {calc.intervencao}
            </div>

            <div className="row-actions">
              <button type="button" onClick={handleSave}>Salvar</button>
              <button type="button" className="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>Detalhes da Erosão</h3>
            <div className="muted">
              <div><strong>ID:</strong> {detailsModal.id}</div>
              <div><strong>Projeto:</strong> {detailsModal.projetoId || '-'}</div>
              <div><strong>Vistoria:</strong> {detailsModal.vistoriaId || '-'}</div>
              <div><strong>Vistorias vinculadas:</strong> {normalizeErosionInspectionIds(detailsModal).join(', ') || '-'}</div>
              {relatedInspectionsInDetails.length > 0 && (
                <div>
                  <strong>Vistorias que abordaram esta erosão:</strong>
                  {relatedInspectionsInDetails.map((row) => (
                    <div key={`related-ins-${row.id}`}>
                      {row.id}
                      {row.inspection?.dataInicio ? ` | início: ${row.inspection.dataInicio}` : ''}
                      {row.inspection?.dataFim ? ` | fim: ${row.inspection.dataFim}` : ''}
                      {row.inspection?.responsavel ? ` | resp.: ${row.inspection.responsavel}` : ''}
                    </div>
                  ))}
                </div>
              )}
              <div><strong>Torre:</strong> {detailsModal.torreRef || '-'}</div>
              <div><strong>Local:</strong> {detailsModal.localTipo || '-'}</div>
              {detailsModal.localTipo === 'Outros' && <div><strong>Descrição local:</strong> {detailsModal.localDescricao || '-'}</div>}
              <div><strong>Tipo:</strong> {detailsModal.tipo || '-'}</div>
              <div><strong>Estágio:</strong> {detailsModal.estagio || '-'}</div>
              <div><strong>Impacto:</strong> {detailsModal.impacto || '-'}</div>
              <div><strong>Score:</strong> {detailsModal.score || '-'}</div>
              <div><strong>Frequência:</strong> {detailsModal.frequencia || '-'}</div>
              <div><strong>Intervenção:</strong> {detailsModal.intervencao || '-'}</div>
              <div><strong>Status:</strong> <span className={erosionStatusClass(detailsModal.status)}>{normalizeErosionStatus(detailsModal.status)}</span></div>
              <div><strong>Latitude:</strong> {detailsModal.latitude || '-'}</div>
              <div><strong>Longitude:</strong> {detailsModal.longitude || '-'}</div>
              <div><strong>Observações:</strong> {detailsModal.obs || '-'}</div>
            </div>

            <div className="panel nested">
              <h4>Histórico de acompanhamento</h4>
              <div className="row-actions">
                <button type="button" onClick={() => setShowAddEventForm((prev) => !prev)}>{showAddEventForm ? 'Cancelar evento' : 'Adicionar evento'}</button>
              </div>
              {showAddEventForm && (
                <div className="panel nested">
                  <div className="grid-form">
                    <select value={eventForm.tipoEvento} onChange={(e) => setEventForm((prev) => ({ ...prev, tipoEvento: e.target.value }))}>
                      <option value="obra">Obra</option>
                      <option value="autuacao">Autuação por órgão público</option>
                    </select>
                    {eventForm.tipoEvento === 'obra' && (
                      <select value={eventForm.obraEtapa} onChange={(e) => setEventForm((prev) => ({ ...prev, obraEtapa: e.target.value }))}>
                        <option value="Projeto">Projeto</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Concluída">Concluída</option>
                      </select>
                    )}
                    {eventForm.tipoEvento === 'autuacao' && (
                      <select value={eventForm.autuacaoStatus} onChange={(e) => setEventForm((prev) => ({ ...prev, autuacaoStatus: e.target.value }))}>
                        <option value="Aberta">Aberta</option>
                        <option value="Recorrida">Recorrida</option>
                        <option value="Encerrada">Encerrada</option>
                      </select>
                    )}
                  </div>
                  {eventForm.tipoEvento === 'obra' && (
                    <textarea rows="2" value={eventForm.descricao} onChange={(e) => setEventForm((prev) => ({ ...prev, descricao: e.target.value }))} placeholder="Descrição da obra..." />
                  )}
                  {eventForm.tipoEvento === 'autuacao' && (
                    <div className="grid-form">
                      <input value={eventForm.orgao} onChange={(e) => setEventForm((prev) => ({ ...prev, orgao: e.target.value }))} placeholder="Órgão público..." />
                      <input value={eventForm.numeroOuDescricao} onChange={(e) => setEventForm((prev) => ({ ...prev, numeroOuDescricao: e.target.value }))} placeholder="Nº/Descrição..." />
                    </div>
                  )}
                  <div className="row-actions">
                    <button type="button" disabled={savingEvent} onClick={handleAddManualHistoryEvent}>{savingEvent ? 'Salvando...' : 'Salvar evento'}</button>
                  </div>
                </div>
              )}

              {normalizeFollowupHistory(detailsModal.acompanhamentosResumo)
                .slice()
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
                .map((event, idx, arr) => {
                  const type = normalizeFollowupEventType(event);
                  const badge = type === 'obra' ? 'Obra' : (type === 'autuacao' ? 'Autuação' : 'Sistema');
                  const toneClass = type === 'obra' ? 'status-ok' : (type === 'autuacao' ? 'status-warn' : 'status-chip');
                  return (
                    <div key={`${event.timestamp}-${event.resumo || idx}`} className="project-card" style={{ position: 'relative', paddingLeft: 22 }}>
                      {idx < arr.length - 1 && <div style={{ position: 'absolute', left: 10, top: 20, bottom: -14, width: 1, background: '#cbd5e1' }} />}
                      <div style={{ position: 'absolute', left: 5, top: 10, width: 10, height: 10, borderRadius: '50%', background: type === 'obra' ? '#3b82f6' : (type === 'autuacao' ? '#f59e0b' : '#64748b') }} />
                      <div className="inline-row" style={{ justifyContent: 'space-between' }}>
                        <strong>{event.timestamp ? new Date(event.timestamp).toLocaleString('pt-BR') : '-'}</strong>
                        <span className={toneClass} style={{ padding: '2px 8px', borderRadius: 999 }}>{badge}</span>
                      </div>
                      <div>{event.resumo || '-'}</div>
                      {type === 'obra' && <div className="muted">Etapa: {event.obraEtapa || '-'} | Descrição: {event.descricao || '-'}</div>}
                      {type === 'autuacao' && <div className="muted">Órgão: {event.orgao || '-'} | Nº/Descrição: {event.numeroOuDescricao || '-'} | Status: {event.autuacaoStatus || '-'}</div>}
                      <div className="muted">Origem: {event.origem || '-'} | Usuário: {event.usuario || '-'} | Status: {event.statusNovo || '-'}</div>
                    </div>
                  );
                })}
              {normalizeFollowupHistory(detailsModal.acompanhamentosResumo).length === 0 && (
                <p className="muted">Sem histórico de acompanhamento registrado.</p>
              )}
            </div>

            <div className="row-actions">
              <button
                type="button"
                onClick={() => openErosionDetailsPdfWindow({
                  erosion: detailsModal,
                  project: projects.find((p) => p.id === detailsModal.projetoId),
                  history: normalizeFollowupHistory(detailsModal.acompanhamentosResumo)
                    .slice()
                    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))),
                })}
              >
                Gerar PDF
              </button>
              {hasCoordinates(detailsModal) && (
                <button type="button" onClick={() => openGoogleMapsRoute(detailsModal.latitude, detailsModal.longitude)}>
                  Navegar no Google Maps
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setDetailsModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ErosionsView;
