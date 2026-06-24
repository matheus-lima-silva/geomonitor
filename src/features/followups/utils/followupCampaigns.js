/* Acompanhamentos — montagem client-side das "campanhas" de monitoramento.
   Uma campanha = uma janela de entrega de relatório de um empreendimento
   (project × mês de entrega), derivada das `reportRows` que a tela já recebe
   (ocorrências project×mês com prazo + status operacional). Enriquecida com as
   vistorias do período. Tudo puro/testável — sem chamada de API, sem Date global
   obrigatória (o prazo já vem em `daysUntilDue` na própria reportRow). */

import { REPORT_OPERATIONAL_STATUS } from '../../monitoring/utils/reportTracking';
import { getProjectReportConfig } from '../../projects/utils/reportSchedule';

const MONTH_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const FOLLOWUP_STAGES = [
  { key: 'planejamento', label: 'Planejamento', icon: 'list-filter' },
  { key: 'campo', label: 'Campo', icon: 'clipboard-check' },
  { key: 'curadoria', label: 'Curadoria', icon: 'image' },
  { key: 'relatorio', label: 'Relatório', icon: 'file-text' },
  { key: 'emissao', label: 'Emissão', icon: 'send' },
];

const STAGE_INDEX = Object.fromEntries(FOLLOWUP_STAGES.map((stage, index) => [stage.key, index]));

/* Status operacionais que indicam que a campanha já chegou na etapa de relatório. */
const REPORT_STAGE_STATUSES = new Set([
  REPORT_OPERATIONAL_STATUS.EM_ELABORACAO,
  REPORT_OPERATIONAL_STATUS.EM_REVISAO,
  REPORT_OPERATIONAL_STATUS.AGUARDANDO_APROVACAO,
]);

export function followupMonthLabel(month, year) {
  const idx = Number(month) - 1;
  return `${MONTH_SHORT_PT[idx] || month}/${year}`;
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/* Número de torres distintas registradas na vistoria (a partir de detalhesDias). */
export function countInspectionTowers(inspection) {
  const days = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : [];
  const towers = new Set();
  days.forEach((day) => {
    const detalhadas = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [];
    detalhadas.forEach((tower) => {
      const numero = String(tower?.numero ?? '').trim();
      if (numero) towers.add(numero);
    });
  });
  if (towers.size > 0) return towers.size;
  return days.length;
}

/* Período humanizado de uma vistoria: "10–14 Fev 2025" / "18 Mar 2025". */
export function formatInspectionPeriod(inspection) {
  const start = toDate(inspection?.dataInicio);
  const end = toDate(inspection?.dataFim) || start;
  if (!start) return '';
  const startDay = start.getDate();
  const endDay = end.getDate();
  const monthLabel = MONTH_SHORT_PT[end.getMonth()];
  const year = end.getFullYear();
  if (start.getTime() === end.getTime() || startDay === endDay) {
    return `${startDay} ${monthLabel} ${year}`;
  }
  return `${startDay}–${endDay} ${monthLabel} ${year}`;
}

function buildCampaignInspections(projectId, year, inspections) {
  return (Array.isArray(inspections) ? inspections : [])
    .filter((inspection) => {
      if (String(inspection?.projetoId || '').trim() !== projectId) return false;
      const start = toDate(inspection?.dataInicio);
      return start ? start.getFullYear() === year : false;
    })
    .map((inspection) => ({
      id: String(inspection?.id || '').trim(),
      periodo: formatInspectionPeriod(inspection),
      torres: countInspectionTowers(inspection),
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt-BR'));
}

/* Etapa atual da campanha, derivada do status operacional + sinais reais
   (vistorias registradas, campo agendado, entrega concluída). */
export function deriveCampaignStage(campaign) {
  if (campaign.delivered) return 'concluida';
  const status = campaign.operationalStatusValue;
  const hasInspections = (campaign.vistorias?.length || 0) > 0;
  if (REPORT_STAGE_STATUSES.has(status)) return 'relatorio';
  if (status === REPORT_OPERATIONAL_STATUS.BLOQUEADO) return hasInspections ? 'curadoria' : 'campo';
  if (hasInspections) return 'curadoria';
  if (status === REPORT_OPERATIONAL_STATUS.EM_ANDAMENTO) return 'campo';
  if (campaign.agendamento) return 'campo';
  if (status === REPORT_OPERATIONAL_STATUS.EM_PLANEJAMENTO) return 'campo';
  return 'planejamento';
}

/* Prazo da janela de entrega. Reusa daysUntilDue já calculado na reportRow. */
export function followupDue(campaign) {
  if (campaign.delivered) {
    return { state: 'entregue', days: null, label: campaign.deliveredAt ? `Entregue em ${formatIsoDate(campaign.deliveredAt)}` : 'Entregue' };
  }
  const days = Number(campaign.daysUntilDue);
  if (!Number.isFinite(days)) return { state: 'em_dia', days: null, label: 'Sem prazo' };
  if (days < 0) return { state: 'atrasada', days, label: `Atrasada há ${-days}d` };
  if (days <= 45) return { state: 'proxima', days, label: `Vence em ${days}d` };
  return { state: 'em_dia', days, label: `Vence em ${days}d` };
}

export function formatIsoDate(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso || '');
}

/* Rótulo humano de um agendamento de campo { inicio, fim }. */
export function followupPeriodLabel(agendamento) {
  if (!agendamento || !agendamento.inicio) return '';
  if (!agendamento.fim || agendamento.fim === agendamento.inicio) return formatIsoDate(agendamento.inicio);
  return `${agendamento.inicio.slice(8, 10)}/${agendamento.inicio.slice(5, 7)} – ${formatIsoDate(agendamento.fim)}`;
}

/* Estado de cada etapa do pipeline a partir da etapa efetiva da campanha. */
export function followupStageStates(campaign, due, effectiveStage) {
  const stageKey = effectiveStage || deriveCampaignStage(campaign);
  const current = stageKey === 'concluida' ? FOLLOWUP_STAGES.length : (STAGE_INDEX[stageKey] ?? 0);
  return FOLLOWUP_STAGES.map((stage, index) => {
    if (index < current) return { ...stage, state: 'done' };
    if (index === current) return { ...stage, state: due.state === 'atrasada' ? 'late' : 'active' };
    return { ...stage, state: 'todo' };
  });
}

/* Pendências automáticas da campanha (além das que possam vir externas). */
export function buildCampaignPendencies(campaign, due) {
  const pendencies = [];
  if (campaign.overrideInvalid) {
    pendencies.push({ tone: 'amber', texto: 'Override de fonte inválido para este mês — revisar em Detalhes operacionais.' });
  }
  if (!campaign.delivered && (campaign.vistorias?.length || 0) === 0 && !campaign.agendamento
    && (due.state === 'proxima' || due.state === 'atrasada')) {
    pendencies.unshift({ tone: 'rose', texto: `Nenhuma vistoria registrada e nenhum campo agendado — ${due.label.toLowerCase()}.` });
  }
  return pendencies;
}

/* Monta as campanhas a partir das reportRows (project×mês) + vistorias. */
export function buildCampaigns({ reportRows = [], inspections = [], projects = [] } = {}) {
  const projectsById = new Map(
    (Array.isArray(projects) ? projects : []).map((project) => [String(project?.id || '').trim(), project]),
  );
  return (Array.isArray(reportRows) ? reportRows : []).map((row) => {
    const projectId = String(row?.projectId || '').trim();
    const year = Number(row?.year);
    const project = projectsById.get(projectId);
    const periodicidade = getProjectReportConfig(project || {}).periodicidadeRelatorio;
    const delivered = row?.operationalStatusValue === REPORT_OPERATIONAL_STATUS.ENTREGUE || Boolean(row?.deliveredAt);
    const vistorias = buildCampaignInspections(projectId, year, inspections);
    return {
      id: String(row?.key || `${projectId}|${row?.monthKey || ''}`),
      projetoId: projectId,
      projeto: String(row?.projectName || projectId),
      monthKey: String(row?.monthKey || ''),
      entregaMes: Number(row?.month),
      entregaAno: year,
      periodicidade,
      rotulo: `Entrega ${followupMonthLabel(row?.month, year)}`,
      daysUntilDue: row?.daysUntilDue,
      deadlineStatusLabel: row?.deadlineStatusLabel,
      deadlineStatusTone: row?.deadlineStatusTone,
      operationalStatusValue: row?.operationalStatusValue,
      operationalStatusLabel: row?.operationalStatusLabel,
      operationalStatusTone: row?.operationalStatusTone,
      overrideInvalid: Boolean(row?.overrideInvalid),
      delivered,
      deliveredAt: row?.deliveredAt || '',
      notes: row?.notes || '',
      vistorias,
    };
  });
}

/* Indica se a campanha está na (ou passou pela) etapa de relatório. */
export function campaignHasReportStage(campaign) {
  return campaign.delivered || REPORT_STAGE_STATUSES.has(campaign.operationalStatusValue);
}

/* KPIs do topo. `rows` = [{ campaign, due }]. */
export function buildCampaignKpis(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    ativas: list.filter((r) => !r.campaign.delivered).length,
    atrasadas: list.filter((r) => r.due.state === 'atrasada').length,
    proximas: list.filter((r) => r.due.state === 'proxima').length,
    elaboracao: list.filter((r) => !r.campaign.delivered && campaignHasReportStage(r.campaign)).length,
    emitidas: list.filter((r) => r.campaign.delivered).length,
  };
}

/* Empreendimentos sem cronograma de entrega configurado (não geram campanha). */
export function projectsWithoutSchedule(projects = [], reportRows = []) {
  const projectsWithCampaign = new Set(
    (Array.isArray(reportRows) ? reportRows : []).map((row) => String(row?.projectId || '').trim()),
  );
  return (Array.isArray(projects) ? projects : [])
    .filter((project) => {
      const id = String(project?.id || '').trim();
      if (!id || projectsWithCampaign.has(id)) return false;
      return getProjectReportConfig(project).mesesEntregaRelatorio.length === 0;
    })
    .map((project) => ({
      projetoId: String(project.id).trim(),
      projeto: String(project.nome || project.id).trim(),
      motivo: 'Meses de entrega de relatório não configurados — sem janela de entrega para acompanhar.',
    }));
}
