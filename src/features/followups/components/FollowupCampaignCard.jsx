import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card } from '../../../components/ui';
import FollowupPipeline from './FollowupPipeline';
import {
  buildCampaignPendencies,
  campaignHasReportStage,
  followupDue,
  followupMonthLabel,
  formatIsoDate,
} from '../utils/followupCampaigns';

function FollowupDueBadge({ due }) {
  if (due.state === 'entregue') return <Badge tone="ok" className="gap-1"><AppIcon name="check" size={11} />{due.label}</Badge>;
  if (due.state === 'atrasada') return <Badge tone="danger" className="gap-1"><AppIcon name="calendar-clock" size={11} />{due.label}</Badge>;
  if (due.state === 'proxima') return <Badge tone="warning" className="gap-1"><AppIcon name="calendar-clock" size={11} />{due.label}</Badge>;
  return <Badge tone="neutral">{due.label}</Badge>;
}

function FollowupFact({ label, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-2xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-col gap-1 text-sm text-slate-700 min-w-0">{children}</div>
    </div>
  );
}

const STATUS_TONE_CHIP = {
  ok: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-rose-100 text-rose-700',
  danger: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
};

function FollowupCampaignCard({ campaign, agendamento, onSchedule, onNavigate }) {
  const due = followupDue(campaign);
  /* Com campo agendado, o planejamento conta como concluído. */
  const enriched = { ...campaign, agendamento };
  const pendencies = buildCampaignPendencies(enriched, due);
  const hasInspections = (campaign.vistorias?.length || 0) > 0;
  const reportStage = campaignHasReportStage(campaign);

  return (
    <Card className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-800 m-0">{campaign.projeto}</h3>
            <span className="text-xs text-slate-400 tabular-nums">{campaign.projetoId}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{campaign.rotulo}</span>
            <span aria-hidden="true">·</span>
            <span>{campaign.periodicidade}</span>
            <span aria-hidden="true">·</span>
            <span>Entrega {followupMonthLabel(campaign.entregaMes, campaign.entregaAno)}</span>
          </div>
        </div>
        <FollowupDueBadge due={due} />
      </header>

      <div className="px-1 pt-1"><FollowupPipeline campaign={enriched} due={due} /></div>

      {pendencies.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {pendencies.map((pendency, index) => (
            <p
              key={`${pendency.tone}-${index}`}
              className={`flex items-start gap-2 m-0 text-xs font-medium rounded-lg px-3 py-2 ${pendency.tone === 'rose' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}
            >
              <AppIcon name="alert" size={13} className="mt-0.5 shrink-0" />{pendency.texto}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3 border-t border-slate-100 pt-4">
        <FollowupFact label="Vistorias de campo">
          {hasInspections ? campaign.vistorias.map((vistoria) => (
            <span key={vistoria.id} className="flex flex-col">
              <span className="font-semibold text-slate-700 tabular-nums">{vistoria.id}</span>
              <span className="text-xs text-slate-500">{vistoria.periodo}{vistoria.torres ? ` · ${vistoria.torres} torres` : ''}</span>
            </span>
          )) : agendamento ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              <AppIcon name="calendar-check" size={12} />Campo agendado
            </span>
          ) : (
            <span className="text-xs text-slate-400">Nenhuma registrada</span>
          )}
        </FollowupFact>

        <FollowupFact label="Curadoria de fotos">
          {hasInspections ? (
            <span className="text-xs text-slate-500">Curadoria no módulo Relatórios</span>
          ) : (
            <span className="text-xs text-slate-400">Sem vistorias para curar</span>
          )}
        </FollowupFact>

        <FollowupFact label="Relatório">
          {campaign.delivered ? (
            <span className={`self-start inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide ${STATUS_TONE_CHIP.ok}`}>Entregue</span>
          ) : reportStage ? (
            <span className={`self-start inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide ${STATUS_TONE_CHIP[campaign.operationalStatusTone] || STATUS_TONE_CHIP.neutral}`}>
              {campaign.operationalStatusLabel}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Não iniciado</span>
          )}
        </FollowupFact>

        <FollowupFact label="Emissão">
          {campaign.delivered ? (
            <span className="text-xs text-slate-500">{campaign.deliveredAt ? `Entregue em ${formatIsoDate(campaign.deliveredAt)}` : 'Entregue'}</span>
          ) : (
            <span className="text-xs text-slate-400">Aguardando relatório</span>
          )}
        </FollowupFact>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {!campaign.delivered && !hasInspections ? (
          <Button variant="outline" size="sm" onClick={() => onSchedule?.(campaign)}>
            <AppIcon name="calendar-plus" size={13} />{agendamento ? 'Reagendar campo' : 'Agendar campo'}
          </Button>
        ) : null}
        {!hasInspections && !campaign.delivered ? (
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('visit-planning')}>
            <AppIcon name="route" size={13} />Planejar visita
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('inspections')}>
            <AppIcon name="clipboard-check" size={13} />Vistorias
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('georelat')}>
          <AppIcon name="file-text" size={13} />Relatório
        </Button>
      </footer>
    </Card>
  );
}

export default FollowupCampaignCard;
