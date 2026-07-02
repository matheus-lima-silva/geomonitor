import { describe, expect, it } from 'vitest';
import { countFieldPendenciesBySection, groupFieldsBySection, sectionAnchorId } from '../manifestSections';

describe('groupFieldsBySection', () => {
  it('agrupa preservando a ordem de primeira aparicao no manifest', () => {
    const fields = [
      { key: 'a', section: 'Identificação' },
      { key: 'b', section: 'Representante' },
      { key: 'c', section: 'Identificação' },
      { key: 'd', section: null },
    ];
    const groups = groupFieldsBySection(fields);
    expect(groups.map((g) => g.section)).toEqual(['Identificação', 'Representante', 'Outros campos']);
    expect(groups[0].fields.map((f) => f.key)).toEqual(['a', 'c']);
    expect(groups[2].fields.map((f) => f.key)).toEqual(['d']);
  });

  it('retorna lista vazia para manifest sem campos', () => {
    expect(groupFieldsBySection(undefined)).toEqual([]);
    expect(groupFieldsBySection([])).toEqual([]);
  });
});

describe('countFieldPendenciesBySection', () => {
  it('conta so pendencias kind=field, agrupadas por secao', () => {
    const pendencies = [
      { kind: 'field', key: 'cnpj_1', section: 'Identificação' },
      { kind: 'field', key: 'endereco', section: 'Identificação' },
      { kind: 'field', key: 'nome', section: 'Representante' },
      { kind: 'list', key: 'brigadistas', section: null },
      { kind: 'field', key: 'x', section: null },
    ];
    const counts = countFieldPendenciesBySection(pendencies);
    expect(counts.get('Identificação')).toBe(2);
    expect(counts.get('Representante')).toBe(1);
    expect(counts.get('Outros campos')).toBe(1);
    expect(counts.has('brigadistas')).toBe(false);
  });

  it('retorna mapa vazio sem pendencias', () => {
    expect(countFieldPendenciesBySection([]).size).toBe(0);
    expect(countFieldPendenciesBySection(undefined).size).toBe(0);
  });
});

describe('sectionAnchorId', () => {
  it('gera slug estavel sem acentos/espacos', () => {
    expect(sectionAnchorId('Representante legal (Usina)', 2)).toBe('paec-section-2-representante-legal-usina');
  });

  it('usa fallback quando a secao e vazia', () => {
    expect(sectionAnchorId(null, 0)).toBe('paec-section-0-secao');
  });
});
