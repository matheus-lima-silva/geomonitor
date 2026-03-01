import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
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
    <section className="panel followups-panel">
      <div className="topbar">
        <div>
          <h2>Acompanhamentos</h2>
          <p className="muted">Gestao operacional de entregas de relatorio e andamento de obras erosivas.</p>
        </div>
      </div>

      <article className="panel nested followups-report-section">
        <h3>Acompanhamento de Entregas de Relatorio</h3>

        <div className="followups-filters">
          <label>
            <span>Projeto</span>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">Todos</option>
              {projectOptions.map((option) => (
                <option key={`followup-project-${option.id}`} value={option.id}>
                  {option.id} - {option.name || option.id}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Ano</span>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="">Todos</option>
              {reportYearOptions.map((year) => (
                <option key={`followup-year-${year}`} value={String(year)}>{year}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Status operacional</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos</option>
              {REPORT_OPERATIONAL_STATUS_OPTIONS.map((option) => (
                <option key={`status-filter-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="monitor-table followups-report-table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Mes/ano</th>
                <th>Fonte aplicada</th>
                <th>Override</th>
                <th>Status prazo</th>
                <th>Status operacional</th>
                <th>Observacoes</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const draft = draftForRow(row);
                const rowKey = String(row.key || '');
                return (
                  <tr key={`followup-row-${rowKey}`}>
                    <td>{row.projectId} - {row.projectName || row.projectId}</td>
                    <td>{formatMonitoringMonthLabel(row.month)}/{row.year}</td>
                    <td>
                      <span className={`followups-source-chip is-${String(row.sourceApplied || '').toLowerCase()}`}>
                        {row.sourceApplied === 'LO' ? 'LO' : 'Empreendimento'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={draft.sourceOverride}
                        onChange={(event) => setDraftValue(rowKey, 'sourceOverride', event.target.value)}
                      >
                        <option value={REPORT_SOURCE_OVERRIDE.AUTO}>Automatico</option>
                        <option value={REPORT_SOURCE_OVERRIDE.LO} disabled={!row.hasLoOption}>Forcar LO</option>
                        <option value={REPORT_SOURCE_OVERRIDE.PROJECT} disabled={!row.hasProjectOption}>Forcar empreendimento</option>
                      </select>
                    </td>
                    <td>{row.deadlineStatusLabel}</td>
                    <td>
                      <select
                        value={draft.operationalStatus}
                        onChange={(event) => setDraftValue(rowKey, 'operationalStatus', event.target.value)}
                      >
                        {REPORT_OPERATIONAL_STATUS_OPTIONS.map((option) => (
                          <option key={`status-edit-${rowKey}-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {draft.operationalStatus === REPORT_OPERATIONAL_STATUS.ENTREGUE ? (
                        <input
                          type="date"
                          value={draft.deliveredAt || ''}
                          onChange={(event) => setDraftValue(rowKey, 'deliveredAt', event.target.value)}
                        />
                      ) : null}
                    </td>
                    <td>
                      <textarea
                        rows="2"
                        value={draft.notes || ''}
                        onChange={(event) => setDraftValue(rowKey, 'notes', event.target.value)}
                        placeholder="Observacoes..."
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSaveTracking(row)}
                        disabled={savingRowKey === rowKey}
                      >
                        <AppIcon name="save" />
                        {savingRowKey === rowKey ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">Nenhum item de acompanhamento encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {Array.isArray(invalidOverrides) && invalidOverrides.length > 0 ? (
          <div className="followups-warning-list">
            {invalidOverrides.map((item) => (
              <p key={`invalid-override-${item.projectId}-${item.monthKey}`} className="muted">
                Override invalido em {item.projectId} / {item.monthKey}: {item.sourceOverride}.
              </p>
            ))}
          </div>
        ) : null}
      </article>

      <article className="panel nested followups-work-section">
        <h3>Acompanhamento de Obras em Erosoes</h3>
        <div className="table-scroll">
          <table className="monitor-table followups-work-table">
            <thead>
              <tr>
                <th>Erosao</th>
                <th>Projeto</th>
                <th>Torre</th>
                <th>Etapa</th>
                <th>Descricao</th>
                <th>Atualizacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkRows.map((row) => (
                <tr key={`work-row-${row.erosionId}`}>
                  <td>{row.erosionId}</td>
                  <td>{row.projectId} - {row.projectName || row.projectId}</td>
                  <td>{row.towerRef || '-'}</td>
                  <td>{row.stage || '-'}</td>
                  <td>{row.description || '-'}</td>
                  <td>{row.timestamp ? new Date(row.timestamp).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
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
                    </button>
                  </td>
                </tr>
              ))}
              {filteredWorkRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">Sem obras ativas para acompanhar.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {activeWorkErosionId ? (
          <div className="followups-work-form">
            <h4>Novo evento de obra - {activeWorkErosionId}</h4>
            <div className="followups-filters">
              <label>
                <span>Etapa</span>
                <select
                  value={workForm.obraEtapa}
                  onChange={(event) => setWorkForm((prev) => ({ ...prev, obraEtapa: event.target.value }))}
                >
                  <option value="Projeto">Projeto</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Concluida">Concluida</option>
                </select>
              </label>
              <label className="is-wide">
                <span>Descricao</span>
                <textarea
                  rows="2"
                  value={workForm.descricao}
                  onChange={(event) => setWorkForm((prev) => ({ ...prev, descricao: event.target.value }))}
                />
              </label>
            </div>
            <div className="row-actions">
              <button type="button" onClick={handleSaveWorkEvent} disabled={savingWorkEvent}>
                <AppIcon name="save" />
                {savingWorkEvent ? 'Salvando...' : 'Salvar evento'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setActiveWorkErosionId('');
                  setWorkForm(WORK_EVENT_FORM_DEFAULT);
                }}
              >
                <AppIcon name="close" />
                Cancelar
              </button>
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
