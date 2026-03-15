import { describe, expect, it } from 'vitest';
import { buildMonitoringViewModel } from '../monitoringViewModel';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('monitoringViewModel', () => {
  const nowMs = new Date('2026-01-01T00:00:00Z').getTime();
  const projects = [
    {
      id: 'P1',
      nome: 'Projeto 1',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [1],
    },
    {
      id: 'P2',
      nome: 'Projeto 2',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [2],
    },
  ];
  const inspections = [{ id: 'V1' }, { id: 'V2' }];
  const erosions = [
    {
      id: 'ER-001',
      projetoId: 'P1',
      impacto: 'Muito Alto',
      torreRef: '1',
      ultimaAtualizacao: '2026-01-10T00:00:00.000Z',
    },
    {
      id: 'ER-002',
      projetoId: 'P2',
      impacto: 'Medio',
      torreRef: '2',
      ultimaAtualizacao: '2026-01-09T00:00:00.000Z',
    },
    {
      id: 'ER-003',
      projetoId: 'P2',
      impacto: 'Alto',
      torreRef: '3',
      ultimaAtualizacao: '2026-01-08T00:00:00.000Z',
    },
  ];

  it('applies dashboard searchTerm to erosion-based cards', () => {
    const model = buildMonitoringViewModel({
      projects,
      inspections,
      erosions,
      operatingLicenses: [],
      searchTerm: 'P2',
      nowMs,
    });

    expect(model.projectCount).toBe(2);
    expect(model.inspectionCount).toBe(2);
    expect(model.erosionCount).toBe(2);
    expect(model.impactCounts['Muito Alto']).toBe(0);
    expect(model.impactCounts.Alto).toBe(1);
    expect(model.impactCounts.Medio).toBe(1);
    expect(model.criticalCount).toBe(1);
    expect(model.recentErosions.map((item) => item.id)).toEqual(['ER-002', 'ER-003']);
  });

  it('keeps report occurrences and month rows stable regardless of searchTerm', () => {
    const noFilter = buildMonitoringViewModel({
      projects,
      inspections,
      erosions,
      operatingLicenses: [],
      searchTerm: '',
      nowMs,
    });

    const withFilter = buildMonitoringViewModel({
      projects,
      inspections,
      erosions,
      operatingLicenses: [],
      searchTerm: 'SEM-CORRESPONDENCIA',
      nowMs,
    });

    expect(withFilter.erosionCount).toBe(0);
    expect(withFilter.reportOccurrences).toEqual(noFilter.reportOccurrences);
    expect(withFilter.reportMonthRows).toEqual(noFilter.reportMonthRows);
    expect(withFilter.reportMonthDetailsByKey).toEqual(noFilter.reportMonthDetailsByKey);
    expect(withFilter.reportPlanningAlerts).toEqual(noFilter.reportPlanningAlerts);
  });

  it('builds monthly details grouped by project with source and scope summaries', () => {
    const monthlyProjects = [
      {
        id: 'P1',
        nome: 'Projeto 1',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
      },
      {
        id: 'P2',
        nome: 'Projeto 2',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
      },
      {
        id: 'P3',
        nome: 'Projeto 3',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
      },
    ];
    const operatingLicenses = [
      {
        id: 'LO-1',
        numero: '001',
        orgaoAmbiental: 'IBAMA',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
        inicioVigencia: '2020-01-01',
        cobertura: [
          { projetoId: 'P1' },
          { projetoId: 'P2' },
        ],
      },
      {
        id: 'LO-2',
        numero: '002',
        orgaoAmbiental: 'SEMA',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
        inicioVigencia: '2020-01-01',
        cobertura: [
          { projetoId: 'P1' },
        ],
      },
    ];

    const model = buildMonitoringViewModel({
      projects: monthlyProjects,
      inspections: [],
      erosions: [],
      operatingLicenses,
      searchTerm: '',
      nowMs,
    });

    const expectedDueInDays = Math.ceil((new Date(2026, 0, 1).getTime() - nowMs) / DAY_IN_MS);

    expect(model.reportMonthRows).toContainEqual(['2026-01', 3]);
    expect(model.reportMonthDetailsByKey['2026-01']).toEqual([
      {
        projectId: 'P1',
        projectName: 'Projeto 1',
        sourceSummary: 'LO 001 | LO 002',
        scopeSummary: 'P1: Projeto 1',
        dueInDays: expectedDueInDays,
        deadlineStatusLabel: 'Urgente',
        deadlineStatusTone: 'critical',
        operationalStatusLabel: 'Nao iniciado',
        operationalStatusTone: 'neutral',
        sourceApplied: 'LO',
        sourceOverride: 'AUTO',
        sourceOverrideLabel: 'Automatico',
        isOverridden: false,
        notes: '',
        deliveredAt: '',
      },
      {
        projectId: 'P2',
        projectName: 'Projeto 2',
        sourceSummary: 'LO 001',
        scopeSummary: 'P2: Projeto 2',
        dueInDays: expectedDueInDays,
        deadlineStatusLabel: 'Urgente',
        deadlineStatusTone: 'critical',
        operationalStatusLabel: 'Nao iniciado',
        operationalStatusTone: 'neutral',
        sourceApplied: 'LO',
        sourceOverride: 'AUTO',
        sourceOverrideLabel: 'Automatico',
        isOverridden: false,
        notes: '',
        deliveredAt: '',
      },
      {
        projectId: 'P3',
        projectName: 'Projeto 3',
        sourceSummary: 'Empreendimento vinculado',
        scopeSummary: 'P3: Projeto 3',
        dueInDays: expectedDueInDays,
        deadlineStatusLabel: 'Urgente',
        deadlineStatusTone: 'critical',
        operationalStatusLabel: 'Nao iniciado',
        operationalStatusTone: 'neutral',
        sourceApplied: 'PROJECT',
        sourceOverride: 'AUTO',
        sourceOverrideLabel: 'Automatico',
        isOverridden: false,
        notes: '',
        deliveredAt: '',
      },
    ]);
    const january2026 = model.reportOccurrences.find((item) => item.monthKey === '2026-01');
    expect(january2026).toBeTruthy();
    expect(january2026).toMatchObject({
      trackingStatusLabel: 'Urgente',
      trackingStatusTone: 'critical',
    });
    expect(january2026.daysUntilDue).toBeGreaterThanOrEqual(0);
    expect(january2026.daysUntilDue).toBeLessThanOrEqual(1);
    expect(Array.isArray(january2026.projectBreakdown)).toBe(true);
    expect(january2026.operationalStatusLabel).toBeTruthy();
  });

  it('marks report deliveries as overdue when due date is in the past', () => {
    const overdueNowMs = new Date('2026-02-10T00:00:00Z').getTime();
    const model = buildMonitoringViewModel({
      projects: [{
        id: 'P-OVERDUE',
        nome: 'Projeto Atrasado',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [1],
      }],
      inspections: [],
      erosions: [],
      operatingLicenses: [],
      searchTerm: '',
      nowMs: overdueNowMs,
    });

    const expectedOverdueDays = Math.ceil((new Date(2026, 0, 1).getTime() - overdueNowMs) / DAY_IN_MS);
    expect(model.reportOccurrences[0]).toMatchObject({
      daysUntilDue: expectedOverdueDays,
      trackingStatusLabel: 'Atrasado',
      trackingStatusTone: 'danger',
    });
  });

  it('applies operational status and source override from delivery tracking', () => {
    const model = buildMonitoringViewModel({
      projects: [{
        id: 'P1',
        nome: 'Projeto 1',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [3],
      }],
      inspections: [],
      erosions: [],
      operatingLicenses: [{
        id: 'LO-1',
        numero: '001',
        orgaoAmbiental: 'IBAMA',
        periodicidadeRelatorio: 'Anual',
        mesesEntregaRelatorio: [3],
        inicioVigencia: '2020-01-01',
        cobertura: [{ projetoId: 'P1' }],
      }],
      deliveryTracking: [{
        projectId: 'P1',
        monthKey: '2026-03',
        operationalStatus: 'ENTREGUE',
        sourceOverride: 'PROJECT',
        deliveredAt: '2026-03-15',
        notes: 'Entregue ao orgao',
      }],
      searchTerm: '',
      nowMs,
    });

    const trackedRow = model.reportProjectMonthRows.find((row) => row.monthKey === '2026-03' && row.projectId === 'P1');
    expect(trackedRow).toBeTruthy();
    expect(trackedRow).toMatchObject({
      projectId: 'P1',
      monthKey: '2026-03',
      sourceApplied: 'PROJECT',
      sourceOverride: 'PROJECT',
      isOverridden: true,
      operationalStatusLabel: 'Entregue',
      deliveredAt: '2026-03-15',
      notes: 'Entregue ao orgao',
    });
    const trackedOccurrence = model.reportOccurrences.find((row) => row.monthKey === '2026-03');
    expect(trackedOccurrence).toBeTruthy();
    expect(trackedOccurrence).toMatchObject({
      monthKey: '2026-03',
      operationalStatusLabel: 'Entregue',
      isOverridden: true,
    });
  });

  it('builds active work tracking rows from erosion follow-up events', () => {
    const model = buildMonitoringViewModel({
      projects: [{ id: 'P1', nome: 'Projeto 1' }],
      inspections: [],
      erosions: [
        {
          id: 'ER-1',
          projetoId: 'P1',
          torreRef: '12',
          acompanhamentosResumo: [
            { tipoEvento: 'obra', obraEtapa: 'Projeto', descricao: 'Projeto executivo', timestamp: '2026-02-10T12:00:00.000Z' },
          ],
        },
        {
          id: 'ER-2',
          projetoId: 'P1',
          acompanhamentosResumo: [
            { tipoEvento: 'obra', obraEtapa: 'Concluida', descricao: 'Finalizada', timestamp: '2026-02-11T12:00:00.000Z' },
          ],
        },
      ],
      operatingLicenses: [],
      searchTerm: '',
      nowMs,
    });

    expect(model.workTrackingRows).toEqual([
      expect.objectContaining({
        erosionId: 'ER-1',
        projectId: 'P1',
        projectName: 'Projeto 1',
        stage: 'Projeto',
      }),
    ]);
  });

  it('orders recent erosions by last update desc and id desc as tie-breaker', () => {
    const model = buildMonitoringViewModel({
      projects: [],
      inspections: [],
      erosions: [
        { id: 'ER-010', projetoId: 'P1', impacto: 'Baixo', ultimaAtualizacao: '2026-01-01T00:00:00.000Z' },
        { id: 'ER-011', projetoId: 'P1', impacto: 'Baixo', ultimaAtualizacao: '2026-01-01T00:00:00.000Z' },
        { id: 'ER-009', projetoId: 'P1', impacto: 'Baixo', ultimaAtualizacao: '2025-12-31T00:00:00.000Z' },
      ],
      operatingLicenses: [],
      searchTerm: '',
      nowMs,
    });

    expect(model.recentErosions.map((item) => item.id)).toEqual(['ER-011', 'ER-010', 'ER-009']);
  });

  it('deduplicates entities by id before computing KPI counts', () => {
    const model = buildMonitoringViewModel({
      projects: [
        { id: 'P1', nome: 'Projeto 1' },
        { id: 'p1', nome: 'Projeto 1 duplicado' },
      ],
      inspections: [
        { id: 'V1', projetoId: 'P1' },
        { id: 'v1', projetoId: 'P1' },
      ],
      erosions: [
        { id: 'ER-1', projetoId: 'P1', impacto: 'Alto' },
        { id: 'er-1', projetoId: 'P1', impacto: 'Muito Alto' },
      ],
      operatingLicenses: [],
      searchTerm: '',
      nowMs,
    });

    expect(model.projectCount).toBe(1);
    expect(model.inspectionCount).toBe(1);
    expect(model.erosionCount).toBe(1);
    expect(model.recentErosions).toHaveLength(1);
  });

  it('computes criticality distribution, stabilization rate and heat points', () => {
    const model = buildMonitoringViewModel({
      projects: [],
      inspections: [],
      erosions: [
        {
          id: 'ER-C1',
          projetoId: 'P1',
          status: 'Estabilizado',
          criticalidadeV2: { codigo: 'C1', criticidade_score: 6, criticidade_classe: 'Baixo' },
          locationCoordinates: { latitude: '-10.1', longitude: '-50.2' },
        },
        {
          id: 'ER-C4',
          projetoId: 'P1',
          status: 'Ativo',
          criticalidadeV2: { codigo: 'C4', criticidade_score: 25, criticidade_classe: 'Muito Alto' },
          locationCoordinates: { latitude: '-10.2', longitude: '-50.3' },
        },
        {
          id: 'ER-NOCOORD',
          projetoId: 'P1',
          status: 'Ativo',
          criticalidadeV2: { codigo: 'C2', criticidade_score: 10, criticidade_classe: 'Medio' },
        },
      ],
      operatingLicenses: [],
      searchTerm: '',
      nowMs,
    });

    expect(model.criticalityDistributionRows).toEqual([
      { level: 'C1', total: 1 },
      { level: 'C2', total: 1 },
      { level: 'C3', total: 0 },
      { level: 'C4', total: 1 },
    ]);
    expect(model.stabilizationRate).toBeCloseTo((1 / 3) * 100);
    expect(model.heatPoints).toHaveLength(2);
    expect(model.heatPointsWithoutCoordinates).toBe(1);
  });
});
