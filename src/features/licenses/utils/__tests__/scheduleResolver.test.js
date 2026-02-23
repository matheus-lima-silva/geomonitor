import { describe, expect, it } from 'vitest';
import { buildEffectiveReportOccurrences } from '../scheduleResolver';

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
    expect(fallbackP1).toBeFalsy();
    expect(fallbackP2).toBeTruthy();
  });
});
