// Helpers de apresentacao de LO (titulo, subtitulo, chips). Puros e testaveis
// em isolamento — PR3 redesign.

export function buildLicenseTitle(license = {}) {
  const numero = String(license.numero || license.id || '').trim();
  const cobertura = Array.isArray(license.cobertura) ? license.cobertura : [];
  const firstScope = cobertura[0] && (cobertura[0].descricaoEscopo || cobertura[0].projetoId);
  if (firstScope) return `LO Nº ${numero} — ${firstScope}`;
  return numero ? `LO Nº ${numero}` : (license.id || '');
}

export function buildLicenseSubtitle(license = {}) {
  const parts = [];
  if (license.orgaoAmbiental) parts.push(license.orgaoAmbiental);
  if (license.esfera) parts.push(license.esfera);
  if (license.esfera === 'Estadual' && license.uf) parts.push(license.uf);
  return parts.join(' · ');
}

/** Dias ate a data (negativo se ja passou). Retorna null se invalida. */
export function daysUntil(dateStr) {
  const raw = String(dateStr || '').trim();
  if (!raw) return null;
  const target = new Date(raw);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - startOfToday.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Produz chips prontos pro header do card:
 * [{ label, tone }] onde tone segue o padrao Badge do projeto:
 *   ok | warning | danger | critical | neutral
 */
export function buildLicenseChips(license = {}) {
  const chips = [];
  if (license.periodicidadeRelatorio) {
    chips.push({ label: license.periodicidadeRelatorio, tone: 'neutral' });
  }
  const days = daysUntil(license.fimVigencia);
  if (days != null) {
    if (days < 0) chips.push({ label: 'Vencida', tone: 'danger' });
    else if (days <= 30) chips.push({ label: `Vence em ${days}d`, tone: 'danger' });
    else if (days <= 90) chips.push({ label: `Vence em ${days}d`, tone: 'warning' });
  }
  if (license.exigeAcompanhamentoErosivo) {
    chips.push({ label: 'Acomp. erosivo', tone: 'critical' });
  }
  if (license.status && license.status !== 'ativa') {
    chips.push({ label: license.status, tone: 'warning' });
  }
  return chips;
}
