// Agrupa manifest.fields por secao, preservando a ordem de primeira aparicao
// no manifest (nao ordem alfabetica) — reflete a ordem do documento original.

const FALLBACK_SECTION = 'Outros campos';

export function groupFieldsBySection(fields) {
  const order = [];
  const bySection = new Map();
  for (const field of fields || []) {
    const section = field.section || FALLBACK_SECTION;
    if (!bySection.has(section)) {
      bySection.set(section, []);
      order.push(section);
    }
    bySection.get(section).push(field);
  }
  return order.map((section) => ({ section, fields: bySection.get(section) }));
}

// Conta pendencias de campo (kind='field') por secao — usado nos badges da
// nav lateral. Blocos (list/manual_block) nao pertencem a nenhuma secao.
export function countFieldPendenciesBySection(pendencies) {
  const counts = new Map();
  for (const p of pendencies || []) {
    if (p.kind !== 'field') continue;
    const section = p.section || FALLBACK_SECTION;
    counts.set(section, (counts.get(section) || 0) + 1);
  }
  return counts;
}

export function sectionAnchorId(section, index) {
  const slug = String(section || 'secao')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `paec-section-${index}-${slug || 'secao'}`;
}
