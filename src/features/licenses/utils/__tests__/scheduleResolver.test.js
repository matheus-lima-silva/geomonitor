import { describe, expect, it } from 'vitest';
import { buildEffectiveReportOccurrences, buildEffectiveReportPlan } from '../scheduleResolver';

describe('scheduleResolver', () => {
  it('prioritizes LO and keeps fallback for projects without LO', () => {
    const projects = [
      { id: 'P1', nome: 'Projeto 1', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [1] },
      { id: 'P2', nome: 'Projeto 2', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [1] },
    ];
    const operatingLicenses = [{
      id: 'LO-1',
      numero: '001',
      orgaoAmbiental: 'IBAMA',
      esfera: 'Federal',
      inicioVigencia: '2026-01-01',
      fimVigencia: '',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [1],
      cobertura: [{ projetoId: 'P1', torres: ['1', '2'] }],
    }];

    const rows = buildEffectiveReportOccurrences({
      projects,
      operatingLicenses,
      startYear: 2026,
      endYear: 2026,
    });

    const loRow = rows.find((item) => item.scopeType === 'lo' && item.scopeId === 'LO-1');
    const fallbackP1 = rows.find((item) => item.scopeType === 'project_fallback' && item.scopeId === 'P1');
    const fallbackP2 = rows.find((item) => item.scopeType === 'project_fallback' && item.scopeId === 'P2');

    expect(loRow).toBeTruthy();
    expect(loRow.scopeSummary).toBe('P1: Projeto 1');
    expect(fallbackP1).toBeFalsy();
    expect(fallbackP2).toBeTruthy();
  });

  it('applies LO yearly priority and suppresses project fallback months for covered years', () => {
    const projects = [
      { id: 'P1', nome: 'Projeto 1', periodicidadeRelatorio: 'Semestral', mesesEntregaRelatorio: [1, 7] },
    ];
    const operatingLicenses = [{
      id: 'LO-1',
      numero: '001',
      orgaoAmbiental: 'IBAMA',
      inicioVigencia: '2026-01-01',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [3],
      cobertura: [{ projetoId: 'P1', torres: ['1'] }],
    }];

    const rows = buildEffectiveReportOccurrences({
      projects,
      operatingLicenses,
      startYear: 2026,
      endYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scopeType: 'lo',
      projectId: 'P1',
      monthKey: '2026-03',
    });
  });

  it('supports sourceOverride=PROJECT when both LO and project schedules are available', () => {
    const projects = [
      { id: 'P1', nome: 'Projeto 1', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [3] },
    ];
    const operatingLicenses = [{
      id: 'LO-1',
      numero: '001',
      orgaoAmbiental: 'IBAMA',
      inicioVigencia: '2026-01-01',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [3],
      cobertura: [{ projetoId: 'P1', torres: ['1'] }],
    }];

    const rows = buildEffectiveReportOccurrences({
      projects,
      operatingLicenses,
      startYear: 2026,
      endYear: 2026,
      deliveryTracking: [{
        projectId: 'P1',
        monthKey: '2026-03',
        sourceOverride: 'PROJECT',
      }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scopeType: 'project_fallback',
      sourceApplied: 'PROJECT',
      sourceOverride: 'PROJECT',
      projectId: 'P1',
      monthKey: '2026-03',
    });
  });

  it('reports invalid overrides when forced source is unavailable', () => {
    const plan = buildEffectiveReportPlan({
      projects: [
        { id: 'P1', nome: 'Projeto 1', periodicidadeRelatorio: 'Anual', mesesEntregaRelatorio: [1] },
      ],
      operatingLicenses: [],
      startYear: 2026,
      endYear: 2026,
      deliveryTracking: [{
        projectId: 'P1',
        monthKey: '2026-01',
        sourceOverride: 'LO',
      }],
    });

    expect(plan.selectedOccurrences).toHaveLength(1);
    expect(plan.invalidOverrides).toEqual([{
      projectId: 'P1',
      monthKey: '2026-01',
      sourceOverride: 'LO',
      baseSource: 'PROJECT',
    }]);
  });
});
