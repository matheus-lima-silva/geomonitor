import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Select, Textarea } from '../../../components/ui';
import { saveErosionManualFollowupEvent } from '../../../services/erosionService';
import { saveReportDeliveryTracking } from '../../../services/reportDeliveryTrackingService';
import {
  REPORT_OPERATIONAL_STATUS_OPTIONS,
  REPORT_OPERATIONAL_STATUS,
  REPORT_SOURCE_OVERRIDE,
} from '../../monitoring/utils/reportTracking';

const WORK_EVENT_FORM_DEFAULT = {
  obraEtapa: 'Projeto',
  descricao: '',
};

function normalizeYear(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function FollowupsView({
  reportRows = [],
  workRows = [],
  erosions = [],
  inspections = [],
  projects = [],
  invalidOverrides = [],
  userActor = '',
  showToast,
}) {
  const [projectFilter, setProjectFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draftRows, setDraftRows] = useState({});
  const [savingRowKey, setSavingRowKey] = useState('');

  const [activeWorkErosionId, setActiveWorkErosionId] = useState('');
  const [workForm, setWorkForm] = useState(WORK_EVENT_FORM_DEFAULT);
  const [savingWorkEvent, setSavingWorkEvent] = useState(false);

  const projectOptions = useMemo(() => (
    (Array.isArray(projects) ? projects : [])
      .map((project) => ({
        id: String(project?.id || '').trim(),
        name: String(project?.nome || '').trim(),
      }))
      .filter((item) => item.id)
      .sort((a, b) => a.id.localeCompare(b.id))
  ), [projects]);

  const reportYearOptions = useMemo(() => (
    [...new Set((Array.isArray(reportRows) ? reportRows : [])
      .map((row) => normalizeYear(row?.year))
      .filter((year) => year !== null))]
      .sort((a, b) => a - b)
  ), [reportRows]);

  const filteredRows = useMemo(() => {
    return (Array.isArray(reportRows) ? reportRows : []).filter((row) => {
      const matchesProject = !projectFilter || String(row?.projectId || '').trim() === projectFilter;
      const matchesYear = !yearFilter || String(row?.year || '') === yearFilter;
      const matchesStatus = !statusFilter || String(row?.operationalStatusValue || '').trim() === statusFilter;
      return matchesProject && matchesYear && matchesStatus;
    });
  }, [reportRows, projectFilter, yearFilter, statusFilter]);

  const filteredWorkRows = useMemo(() => (
    (Array.isArray(workRows) ? workRows : []).filter((row) => (
      !projectFilter || String(row?.projectId || '').trim() === projectFilter
    ))
  ), [workRows, projectFilter]);

  const draftForRow = (row) => {
    const key = String(row?.key || '');
    if (draftRows[key]) return draftRows[key];
    return {
      operationalStatus: String(row?.operationalStatusValue || REPORT_OPERATIONAL_STATUS.NAO_INICIADO),
      sourceOverride: String(row?.sourceOverride || REPORT_SOURCE_OVERRIDE.AUTO),
      notes: String(row?.notes || ''),
      deliveredAt: String(row?.deliveredAt || ''),
    };
  };

  function setDraftValue(rowKey, field, value) {
    setDraftRows((prev) => {
      const next = {
        ...(prev[rowKey] || {}),
        [field]: value,
      };
      if (field === 'operationalStatus' && value !== REPORT_OPERATIONAL_STATUS.ENTREGUE) {
        next.deliveredAt = '';
      }
      return {
        ...prev,
        [rowKey]: next,
      };
    });
  }

  async function handleSaveTracking(row) {
    const key = String(row?.key || '');
    if (!key) return;
    const draft = draftForRow(row);

    if (draft.sourceOverride === REPORT_SOURCE_OVERRIDE.LO && !row?.hasLoOption) {
      showToast?.('Nao existe opcao LO para este projeto/mes.', 'error');
      return;
    }
    if (draft.sourceOverride === REPORT_SOURCE_OVERRIDE.PROJECT && !row?.hasProjectOption) {
      showToast?.('Nao existe cronograma de empreendimento para este projeto/mes.', 'error');
      return;
    }

    setSavingRowKey(key);
    try {
      await saveReportDeliveryTracking(row.projectId, row.monthKey, {
        operationalStatus: draft.operationalStatus,
        sourceOverride: draft.sourceOverride,
        deliveredAt: draft.deliveredAt,
        notes: draft.notes,
      }, {
        updatedBy: userActor,
        merge: true,
      });
      showToast?.('Acompanhamento de entrega atualizado.', 'success');
      setDraftRows((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      showToast?.(err.message || 'Erro ao salvar acompanhamento de entrega.', 'error');
    } finally {
      setSavingRowKey('');
    }
  }

  async function handleSaveWorkEvent() {
    if (!activeWorkErosionId) return;
    const erosion = (Array.isArray(erosions) ? erosions : []).find((item) => String(item?.id || '').trim() === activeWorkErosionId);
    if (!erosion) {
      showToast?.('Erosao nao encontrada para registrar evento.', 'error');
      return;
    }
    const description = String(workForm?.descricao || '').trim();
    if (!description) {
      showToast?.('Preencha a descricao da obra.', 'error');
      return;
    }

    setSavingWorkEvent(true);
    try {
      await saveErosionManualFollowupEvent(erosion, {
        tipoEvento: 'obra',
        obraEtapa: workForm.obraEtapa,
        descricao: description,
      }, {
        updatedBy: userActor,
        inspections,
      });
      showToast?.('Evento de obra registrado.', 'success');
      setActiveWorkErosionId('');
      setWorkForm(WORK_EVENT_FORM_DEFAULT);
    } catch (err) {
      showToast?.(err.message || 'Erro ao registrar evento de obra.', 'error');
    } finally {
      setSavingWorkEvent(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-[0_4px_18px_rgba(15,23,42,0.08)] p-5 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Acompanhamentos</h2>
          <p className="text-sm text-slate-500 mt-1">Gestao operacional de entregas de relatorio e andamento de obras erosivas.</p>
        </div>
      </div>

      <article className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 m-0 mb-4">Acompanhamento de Entregas de Relatorio</h3>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <Select
            id="followup-project"
            label="Projeto"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {projectOptions.map((option) => (
              <option key={`followup-project-${option.id}`} value={option.id}>
                {option.id} - {option.name || option.id}
              </option>
            ))}
          </Select>

          <Select
            id="followup-year"
            label="Ano"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {reportYearOptions.map((year) => (
              <option key={`followup-year-${year}`} value={String(year)}>{year}</option>
            ))}
          </Select>

          <Select
            id="followup-status"
            label="Status operacional"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {REPORT_OPERATIONAL_STATUS_OPTIONS.map((option) => (
              <option key={`status-filter-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto w-full bg-white rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse whitespace-nowrap followups-report-table">
            <thead>
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Projeto</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes/ano</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fonte aplicada</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Override</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status prazo</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status operacional</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Observacoes</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const draft = draftForRow(row);
                const rowKey = String(row.key || '');
                return (
                  <tr key={`followup-row-${rowKey}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700">{row.projectId} - {row.projectName || row.projectId}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatMonitoringMonthLabel(row.month)}/{row.year}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.sourceApplied === 'LO' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-800'}`}>
                        {row.sourceApplied === 'LO' ? 'LO' : 'Empreendimento'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        id={`followup-source-override-${rowKey}`}
                        className="min-w-[140px]"
                        value={draft.sourceOverride}
                        onChange={(event) => setDraftValue(rowKey, 'sourceOverride', event.target.value)}
                      >
                        <option value={REPORT_SOURCE_OVERRIDE.AUTO}>Automatico</option>
                        <option value={REPORT_SOURCE_OVERRIDE.LO} disabled={!row.hasLoOption}>Forcar LO</option>
                        <option value={REPORT_SOURCE_OVERRIDE.PROJECT} disabled={!row.hasProjectOption}>Forcar empreendimento</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.deadlineStatusLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <Select
                          id={`followup-status-edit-${rowKey}`}
                          className="min-w-[140px]"
                          value={draft.operationalStatus}
                          onChange={(event) => setDraftValue(rowKey, 'operationalStatus', event.target.value)}
                        >
                          {REPORT_OPERATIONAL_STATUS_OPTIONS.map((option) => (
                            <option key={`status-edit-${rowKey}-${option.value}`} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        {draft.operationalStatus === REPORT_OPERATIONAL_STATUS.ENTREGUE ? (
                          <Input
                            id={`followup-delivered-at-${rowKey}`}
                            type="date"
                            value={draft.deliveredAt || ''}
                            onChange={(event) => setDraftValue(rowKey, 'deliveredAt', event.target.value)}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Textarea
                        id={`followup-notes-${rowKey}`}
                        rows={2}
                        className="min-w-[200px]"
                        value={draft.notes || ''}
                        onChange={(event) => setDraftValue(rowKey, 'notes', event.target.value)}
                        placeholder="Observacoes..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSaveTracking(row)}
                        disabled={savingRowKey === rowKey}
                      >
                        <AppIcon name="save" />
                        {savingRowKey === rowKey ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">Nenhum item de acompanhamento encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {Array.isArray(invalidOverrides) && invalidOverrides.length > 0 ? (
          <div className="mt-4 flex flex-col gap-1">
            {invalidOverrides.map((item) => (
              <p key={`invalid-override-${item.projectId}-${item.monthKey}`} className="text-sm text-slate-500 m-0">
                Override invalido em {item.projectId} / {item.monthKey}: {item.sourceOverride}.
              </p>
            ))}
          </div>
        ) : null}
      </article>

      <article className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 m-0 mb-4">Acompanhamento de Obras em Erosoes</h3>
        <div className="overflow-x-auto w-full bg-white rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Erosao</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Projeto</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Torre</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Etapa</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descricao</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Atualizacao</th>
                <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkRows.map((row) => (
                <tr key={`work-row-${row.erosionId}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{row.erosionId}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.projectId} - {row.projectName || row.projectId}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.towerRef || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.stage || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.timestamp ? new Date(row.timestamp).toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveWorkErosionId(row.erosionId);
                        setWorkForm((prev) => ({
                          ...prev,
                          obraEtapa: row.stage || 'Em andamento',
                        }));
                      }}
                    >
                      <AppIcon name="edit" />
                      Registrar evento
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredWorkRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">Sem obras ativas para acompanhar.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {activeWorkErosionId ? (
          <div className="mt-6 p-5 bg-white border border-slate-200 rounded-xl shadow-sm followups-work-form">
            <h4 className="text-base font-bold text-slate-800 m-0 mb-4">Novo evento de obra - {activeWorkErosionId}</h4>
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
              <Select
                id="work-etapa"
                label="Etapa"
                value={workForm.obraEtapa}
                onChange={(event) => setWorkForm((prev) => ({ ...prev, obraEtapa: event.target.value }))}
              >
                <option value="Projeto">Projeto</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluida">Concluída</option>
              </Select>
              <div className="w-full max-w-md">
                <Textarea
                  id="work-description"
                  label="Descricao"
                  rows={2}
                  value={workForm.descricao}
                  onChange={(event) => setWorkForm((prev) => ({ ...prev, descricao: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button variant="primary" size="sm" onClick={handleSaveWorkEvent} disabled={savingWorkEvent}>
                <AppIcon name="save" />
                {savingWorkEvent ? 'Salvando...' : 'Salvar evento'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveWorkErosionId('');
                  setWorkForm(WORK_EVENT_FORM_DEFAULT);
                }}
              >
                <AppIcon name="close" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}

function formatMonitoringMonthLabel(monthValue) {
  const month = Number(monthValue);
  const labels = {
    1: 'Jan',
    2: 'Fev',
    3: 'Mar',
    4: 'Abr',
    5: 'Mai',
    6: 'Jun',
    7: 'Jul',
    8: 'Ago',
    9: 'Set',
    10: 'Out',
    11: 'Nov',
    12: 'Dez',
  };
  return labels[month] || String(monthValue || '-');
}

export default FollowupsView;



