import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, Select } from '../../../components/ui';
import FollowupKpiBar from './FollowupKpiBar';
import FollowupCampaignCard from './FollowupCampaignCard';
import FollowupEmissionsPanel from './FollowupEmissionsPanel';
import ScheduleFieldModal from './ScheduleFieldModal';
import { useFollowupCampaignFacets } from '../hooks/useFollowupCampaignFacets';
import {
  buildCampaigns,
  buildCampaignKpis,
  campaignHasReportStage,
  followupDue,
  followupPeriodLabel,
  projectsWithoutSchedule,
} from '../utils/followupCampaigns';

const DUE_RANK = { atrasada: 0, proxima: 1, em_dia: 2, entregue: 3 };

function matchesQuickFilter(quickFilter, campaign, due) {
  switch (quickFilter) {
    case 'ativas': return !campaign.delivered;
    case 'atrasadas': return due.state === 'atrasada';
    case 'proximas': return due.state === 'proxima';
    case 'elaboracao': return !campaign.delivered && campaignHasReportStage(campaign);
    case 'emitidas': return campaign.delivered;
    default: return true;
  }
}

/* Dashboard de campanhas de monitoramento (parte nova de Acompanhamentos),
   montado client-side a partir das reportRows que a tela já recebe. */
function FollowupCampaignsDashboard({ reportRows = [], inspections = [], projects = [], onNavigate, showToast }) {
  const [projetoId, setProjetoId] = useState('');
  const [quickFilter, setQuickFilter] = useState('total');
  const [agendas, setAgendas] = useState({});
  const [schedulingId, setSchedulingId] = useState('');

  const { emissions, loading: emissionsLoading, error: emissionsError } = useFollowupCampaignFacets();

  const campaigns = useMemo(
    () => buildCampaigns({ reportRows, inspections, projects }),
    [reportRows, inspections, projects],
  );

  const rows = useMemo(() => campaigns.map((campaign) => ({ campaign, due: followupDue(campaign) })), [campaigns]);
  const kpiCounts = useMemo(() => buildCampaignKpis(rows), [rows]);
  const missingSchedule = useMemo(() => projectsWithoutSchedule(projects, reportRows), [projects, reportRows]);

  const projectFilterOptions = useMemo(() => {
    const map = new Map();
    campaigns.forEach((campaign) => { if (!map.has(campaign.projetoId)) map.set(campaign.projetoId, campaign.projeto); });
    missingSchedule.forEach((item) => { if (!map.has(item.projetoId)) map.set(item.projetoId, item.projeto); });
    return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
  }, [campaigns, missingSchedule]);

  const visible = useMemo(() => rows
    .filter(({ campaign, due }) => {
      if (projetoId && campaign.projetoId !== projetoId) return false;
      return matchesQuickFilter(quickFilter, campaign, due);
    })
    .sort((a, b) => {
      const rank = (DUE_RANK[a.due.state] ?? 9) - (DUE_RANK[b.due.state] ?? 9);
      if (rank !== 0) return rank;
      return (a.due.days ?? 9e9) - (b.due.days ?? 9e9);
    }), [rows, projetoId, quickFilter]);

  const visibleMissing = missingSchedule.filter((item) => !projetoId || item.projetoId === projetoId);

  const kpis = [
    { key: 'ativas', label: 'Campanhas ativas', value: kpiCounts.ativas, icon: 'followups-nav', tone: 'slate' },
    { key: 'atrasadas', label: 'Entrega atrasada', value: kpiCounts.atrasadas, icon: 'calendar-clock', tone: 'rose' },
    { key: 'proximas', label: 'Entrega em até 45d', value: kpiCounts.proximas, icon: 'timer', tone: 'amber' },
    { key: 'elaboracao', label: 'Relatórios em elaboração', value: kpiCounts.elaboracao, icon: 'file-text', tone: 'blue' },
    { key: 'emitidas', label: 'Relatórios emitidos', value: kpiCounts.emitidas, icon: 'file-check-2', tone: 'emerald' },
  ];

  const schedulingCampaign = campaigns.find((campaign) => campaign.id === schedulingId) || null;

  return (
    <div className="flex flex-col gap-5">
      <FollowupKpiBar
        kpis={kpis}
        activeKey={quickFilter}
        onToggle={(key) => setQuickFilter((prev) => (prev === key ? 'total' : key))}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <Select
                id="followup-campaign-project"
                label="Empreendimento"
                value={projetoId}
                onChange={(e) => setProjetoId(e.target.value)}
              >
                <option value="">Todos</option>
                {projectFilterOptions.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </Select>
            </div>
            <span className="ml-auto text-xs text-slate-500 pb-2 tabular-nums">{visible.length} de {rows.length} campanhas</span>
          </div>

          {visible.map(({ campaign }) => (
            <FollowupCampaignCard
              key={campaign.id}
              campaign={campaign}
              agendamento={agendas[campaign.id] || null}
              onSchedule={(target) => setSchedulingId(target.id)}
              onNavigate={onNavigate}
            />
          ))}

          {visible.length === 0 ? (
            <Card className="px-5 py-10 text-center text-sm text-slate-500">
              Nenhuma campanha corresponde aos filtros selecionados.
            </Card>
          ) : null}

          {quickFilter === 'total' && visibleMissing.map((item) => (
            <div key={item.projetoId} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <AppIcon name="alert" size={17} />
              </span>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 m-0">{item.projeto} <span className="font-normal text-amber-700">({item.projetoId})</span> — sem campanha gerada</p>
                <p className="text-xs text-amber-800 m-0">{item.motivo}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.('projects')}>
                <AppIcon name="edit" size={13} />Configurar cronograma
              </Button>
            </div>
          ))}
        </div>

        <FollowupEmissionsPanel
          emissions={emissions}
          loading={emissionsLoading}
          error={emissionsError}
          onNavigate={onNavigate}
          onToast={showToast}
        />
      </div>

      <ScheduleFieldModal
        open={!!schedulingId}
        campaign={schedulingCampaign}
        value={agendas[schedulingId] || null}
        onClose={() => setSchedulingId('')}
        onSave={(agendamento) => {
          setAgendas((prev) => ({ ...prev, [schedulingId]: agendamento }));
          setSchedulingId('');
          showToast?.(`Campo agendado para ${followupPeriodLabel(agendamento)}.`, 'success');
        }}
      />
    </div>
  );
}

export default FollowupCampaignsDashboard;
