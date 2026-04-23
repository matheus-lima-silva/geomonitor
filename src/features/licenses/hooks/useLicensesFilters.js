import { useMemo, useState } from 'react';

const INITIAL_FILTERS = {
  searchTerm: '',
  orgaos: [],          // multi-select
  esfera: '',          // Federal | Estadual | ''
  vencimentoAntes: '', // ISO date
  soComErosiva: false,
};

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(license, projectsById, term) {
  if (!term) return true;
  const t = norm(term);
  const haystack = [
    license.numero,
    license.id,
    license.apelido,
    license.orgaoAmbiental,
    license.descricao,
  ].map(norm).join(' | ');
  if (haystack.includes(t)) return true;
  const cobertura = Array.isArray(license.cobertura) ? license.cobertura : [];
  return cobertura.some((c) => {
    const proj = projectsById?.get?.(c.projetoId);
    const projNome = proj ? `${proj.id} ${proj.nome}` : c.projetoId;
    return norm(projNome).includes(t) || norm(c.descricaoEscopo).includes(t);
  });
}

function matchesOrgaos(license, orgaos) {
  if (!Array.isArray(orgaos) || orgaos.length === 0) return true;
  return orgaos.includes(license.orgaoAmbiental);
}

function matchesEsfera(license, esfera) {
  if (!esfera) return true;
  return license.esfera === esfera;
}

function matchesVencimentoAntes(license, isoDate) {
  if (!isoDate) return true;
  const fim = String(license.fimVigencia || '').trim();
  if (!fim) return false; // indeterminada nao qualifica
  return fim <= isoDate;
}

function matchesErosiva(license, soComErosiva) {
  if (!soComErosiva) return true;
  return Boolean(license.exigeAcompanhamentoErosivo);
}

/**
 * Hook que gerencia filtros compostos do grid de LOs.
 * Retorna { filters, setFilter, reset, apply(licenses, projectsById) }.
 */
export default function useLicensesFilters(initial = INITIAL_FILTERS) {
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS, ...initial });

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setFilters({ ...INITIAL_FILTERS });
  }

  function apply(licenses, projectsById) {
    const list = Array.isArray(licenses) ? licenses : [];
    return list.filter((lic) => (
      matchesSearch(lic, projectsById, filters.searchTerm)
      && matchesOrgaos(lic, filters.orgaos)
      && matchesEsfera(lic, filters.esfera)
      && matchesVencimentoAntes(lic, filters.vencimentoAntes)
      && matchesErosiva(lic, filters.soComErosiva)
    ));
  }

  const distinctOrgaos = useMemo(() => ({
    extractFrom(licenses) {
      const set = new Set();
      for (const lic of Array.isArray(licenses) ? licenses : []) {
        if (lic.orgaoAmbiental) set.add(lic.orgaoAmbiental);
      }
      return [...set].sort();
    },
  }), []);

  return {
    filters,
    setFilter,
    reset,
    apply,
    distinctOrgaos,
    isEmpty: JSON.stringify(filters) === JSON.stringify(INITIAL_FILTERS),
  };
}
