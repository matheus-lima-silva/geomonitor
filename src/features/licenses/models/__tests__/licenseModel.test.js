import { describe, expect, it } from 'vitest';
import {
  createEmptyOperatingLicense,
  normalizeOperatingLicensePayload,
  validateOperatingLicensePayload,
} from '../licenseModel';

describe('licenseModel', () => {
  it('defaults with esfera federal and uf empty', () => {
    const model = createEmptyOperatingLicense();
    expect(model.esfera).toBe('Federal');
    expect(model.uf).toBe('');
    expect(model.exigeAcompanhamentoErosivo).toBe(true);
  });

  it('requires uf for estadual', () => {
    const payload = normalizeOperatingLicensePayload({
      numero: 'LO-1',
      orgaoAmbiental: 'INEA',
      esfera: 'Estadual',
      inicioVigencia: '2026-01-01',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [1],
      cobertura: [{ projetoId: 'P1', torres: ['1'] }],
    });
    const validation = validateOperatingLicensePayload(payload, { projectsById: new Map([['P1', { torres: '10' }]]) });
    expect(validation.ok).toBe(false);
  });

  it('rejects uf when esfera is federal', () => {
    const payload = normalizeOperatingLicensePayload({
      numero: 'LO-2',
      orgaoAmbiental: 'IBAMA',
      esfera: 'Federal',
      uf: 'RJ',
      inicioVigencia: '2026-01-01',
      periodicidadeRelatorio: 'Anual',
      mesesEntregaRelatorio: [1],
      cobertura: [{ projetoId: 'P1', torres: ['1'] }],
    });
    expect(payload.uf).toBe('');
  });
});
