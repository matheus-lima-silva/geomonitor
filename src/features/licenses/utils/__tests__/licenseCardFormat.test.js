import { describe, expect, it } from 'vitest';
import {
  buildLicenseTitle,
  buildLicenseSubtitle,
  buildLicenseChips,
  daysUntil,
} from '../licenseCardFormat';

describe('buildLicenseTitle', () => {
  it('usa descricaoEscopo da primeira cobertura quando disponivel', () => {
    const title = buildLicenseTitle({
      numero: '1656/2023',
      cobertura: [{ descricaoEscopo: 'Lote 1 Furnas' }],
    });
    expect(title).toBe('LO Nº 1656/2023 — Lote 1 Furnas');
  });

  it('cai para projetoId quando descricaoEscopo ausente', () => {
    expect(buildLicenseTitle({ numero: '2886/2025', cobertura: [{ projetoId: 'IABTPR' }] }))
      .toBe('LO Nº 2886/2025 — IABTPR');
  });

  it('so mostra numero sem sufixo quando nao ha cobertura', () => {
    expect(buildLicenseTitle({ numero: '90/2021' })).toBe('LO Nº 90/2021');
  });
});

describe('buildLicenseSubtitle', () => {
  it('federal mostra apenas orgao + esfera', () => {
    expect(buildLicenseSubtitle({ orgaoAmbiental: 'IBAMA', esfera: 'Federal' }))
      .toBe('IBAMA · Federal');
  });

  it('estadual inclui UF quando presente', () => {
    expect(buildLicenseSubtitle({ orgaoAmbiental: 'CETESB', esfera: 'Estadual', uf: 'SP' }))
      .toBe('CETESB · Estadual · SP');
  });
});

describe('buildLicenseChips', () => {
  it('produz chip de periodicidade neutra', () => {
    const chips = buildLicenseChips({ periodicidadeRelatorio: 'Anual' });
    expect(chips).toContainEqual({ label: 'Anual', tone: 'neutral' });
  });

  it('chip critical quando exigeAcompanhamentoErosivo=true', () => {
    const chips = buildLicenseChips({ exigeAcompanhamentoErosivo: true });
    expect(chips.some((c) => c.tone === 'critical')).toBe(true);
  });

  it('chip danger quando vigencia ja passou', () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const chips = buildLicenseChips({ fimVigencia: past });
    expect(chips.find((c) => /Vencida/i.test(c.label))?.tone).toBe('danger');
  });

  it('chip warning quando vigencia esta entre 31 e 90 dias', () => {
    const near = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const chips = buildLicenseChips({ fimVigencia: near });
    const chip = chips.find((c) => /Vence em/i.test(c.label));
    expect(chip?.tone).toBe('warning');
  });
});

describe('daysUntil', () => {
  it('retorna null quando data invalida', () => {
    expect(daysUntil('abc')).toBeNull();
    expect(daysUntil('')).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });

  it('retorna diferenca em dias', () => {
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
    expect(daysUntil(future.toISOString().slice(0, 10))).toBe(10);
  });
});
