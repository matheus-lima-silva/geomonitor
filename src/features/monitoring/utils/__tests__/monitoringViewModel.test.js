import { describe, expect, it } from 'vitest';
import { buildMonitoringViewModel } from '../monitoringViewModel';

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

    expect(model.reportMonthRows).toContainEqual(['2026-01', 3]);
    expect(model.reportMonthDetailsByKey['2026-01']).toEqual([
      {
        projectId: 'P1',
        projectName: 'Projeto 1',
        sourceSummary: 'LO 001 | LO 002',
        scopeSummary: 'P1: Projeto 1 | P2: Projeto 2 | P1: Projeto 1',
      },
      {
        projectId: 'P2',
        projectName: 'Projeto 2',
        sourceSummary: 'LO 001',
        scopeSummary: 'P1: Projeto 1 | P2: Projeto 2',
      },
      {
        projectId: 'P3',
        projectName: 'Projeto 3',
        sourceSummary: 'Empreendimento vinculado',
        scopeSummary: 'P3: Projeto 3',
      },
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
