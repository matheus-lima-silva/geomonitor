import { describe, expect, it } from 'vitest';
import {
  buildCampaigns,
  buildCampaignKpis,
  countInspectionTowers,
  deriveCampaignStage,
  followupDue,
  followupStageStates,
  formatInspectionPeriod,
  projectsWithoutSchedule,
} from '../followupCampaigns';

const PROJECTS = [
  { id: 'P-102', nome: 'LT 500kV Norte', periodicidadeRelatorio: 'Semestral', mesesEntregaRelatorio: [4, 10] },
  { id: 'P-205', nome: 'LT 230kV Serra Azul', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [6] },
  { id: 'P-310', nome: 'LT 138kV Litoral', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [] },
];

const INSPECTIONS = [
  {
    id: 'VIS-2025-006', projetoId: 'P-102', dataInicio: '2025-02-10', dataFim: '2025-02-14',
    detalhesDias: [{ torresDetalhadas: [{ numero: '10' }, { numero: '11' }] }, { torresDetalhadas: [{ numero: '11' }, { numero: '12' }] }],
  },
  { id: 'VIS-2024-001', projetoId: 'P-102', dataInicio: '2024-03-01', dataFim: '2024-03-02', detalhesDias: [] },
];

function row(over) {
  return {
    key: `${over.projectId}|${over.monthKey}`,
    projectId: 'P-102',
    projectName: 'LT 500kV Norte',
    month: 4,
    year: 2025,
    monthKey: '2025-04',
    daysUntilDue: 30,
    operationalStatusValue: 'NAO_INICIADO',
    operationalStatusLabel: 'Nao iniciado',
    deliveredAt: '',
    ...over,
  };
}

describe('followupCampaigns', () => {
  it('counts distinct towers across inspection days', () => {
    expect(countInspectionTowers(INSPECTIONS[0])).toBe(3);
    expect(countInspectionTowers({ detalhesDias: [{}, {}] })).toBe(2);
    expect(countInspectionTowers({})).toBe(0);
  });

  it('formats inspection period (range and single day)', () => {
    expect(formatInspectionPeriod(INSPECTIONS[0])).toBe('10–14 Fev 2025');
    expect(formatInspectionPeriod({ dataInicio: '2025-03-18', dataFim: '2025-03-18' })).toBe('18 Mar 2025');
  });

  it('builds campaigns from report rows and attaches same-year inspections', () => {
    const campaigns = buildCampaigns({
      reportRows: [row({ projectId: 'P-102', monthKey: '2025-04' })],
      inspections: INSPECTIONS,
      projects: PROJECTS,
    });
    expect(campaigns).toHaveLength(1);
    const [c] = campaigns;
    expect(c.projetoId).toBe('P-102');
    expect(c.periodicidade).toBe('Semestral');
    expect(c.rotulo).toBe('Entrega Abr/2025');
    // only the 2025 inspection is attached (the 2024 one is filtered out)
    expect(c.vistorias.map((v) => v.id)).toEqual(['VIS-2025-006']);
    expect(c.vistorias[0].torres).toBe(3);
    expect(c.delivered).toBe(false);
  });

  it('followupDue maps days/delivery into the 4 kit states', () => {
    expect(followupDue({ delivered: true, deliveredAt: '2025-05-05' })).toMatchObject({ state: 'entregue' });
    expect(followupDue({ daysUntilDue: -3 })).toMatchObject({ state: 'atrasada', label: 'Atrasada há 3d' });
    expect(followupDue({ daysUntilDue: 20 })).toMatchObject({ state: 'proxima' });
    expect(followupDue({ daysUntilDue: 90 })).toMatchObject({ state: 'em_dia' });
    expect(followupDue({ daysUntilDue: NaN })).toMatchObject({ state: 'em_dia', label: 'Sem prazo' });
  });

  it('derives the pipeline stage from status and real signals', () => {
    expect(deriveCampaignStage({ delivered: true })).toBe('concluida');
    expect(deriveCampaignStage({ operationalStatusValue: 'NAO_INICIADO', vistorias: [] })).toBe('planejamento');
    expect(deriveCampaignStage({ operationalStatusValue: 'EM_PLANEJAMENTO', vistorias: [] })).toBe('campo');
    expect(deriveCampaignStage({ operationalStatusValue: 'NAO_INICIADO', vistorias: [{ id: 'V' }] })).toBe('curadoria');
    expect(deriveCampaignStage({ operationalStatusValue: 'EM_REVISAO', vistorias: [{ id: 'V' }] })).toBe('relatorio');
    expect(deriveCampaignStage({ operationalStatusValue: 'NAO_INICIADO', vistorias: [], agendamento: { inicio: '2025-09-15' } })).toBe('campo');
  });

  it('marks stages done/active/late/todo relative to the current stage', () => {
    const campaign = { operationalStatusValue: 'EM_REVISAO', vistorias: [{ id: 'V' }] };
    const states = followupStageStates(campaign, { state: 'proxima' });
    expect(states.map((s) => s.state)).toEqual(['done', 'done', 'done', 'active', 'todo']);
    const lateStates = followupStageStates(campaign, { state: 'atrasada' });
    expect(lateStates[3].state).toBe('late');
  });

  it('aggregates KPIs across campaign rows', () => {
    const rows = [
      { campaign: { delivered: false, operationalStatusValue: 'NAO_INICIADO' }, due: { state: 'atrasada' } },
      { campaign: { delivered: false, operationalStatusValue: 'EM_ELABORACAO' }, due: { state: 'proxima' } },
      { campaign: { delivered: true, operationalStatusValue: 'ENTREGUE' }, due: { state: 'entregue' } },
    ];
    expect(buildCampaignKpis(rows)).toEqual({
      ativas: 2, atrasadas: 1, proximas: 1, elaboracao: 1, emitidas: 1,
    });
  });

  it('lists projects without a configured schedule (no campaign generated)', () => {
    const missing = projectsWithoutSchedule(PROJECTS, [row({ projectId: 'P-102', monthKey: '2025-04' })]);
    expect(missing.map((m) => m.projetoId)).toEqual(['P-310']);
  });
});
