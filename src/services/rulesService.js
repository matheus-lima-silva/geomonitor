import { createSingletonService, API_BASE_URL } from '../utils/serviceFactory';
import { fetchWithHateoas } from '../utils/apiClient';

const service = createSingletonService({
  resourcePath: 'rules',
  itemName: 'Regras'
});

export function subscribeRulesConfig(onData, onError) {
  return service.subscribe(onData, onError);
}

export function saveRulesConfig(rules, meta = {}) {
  return service.save(rules, { ...meta, merge: true });
}

export async function importarFeriadosNacionais(ano, rulesConfig = null) {
  const yearNumber = Number.parseInt(String(ano ?? ''), 10);
  if (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
    throw new Error('Ano invalido para importacao de feriados.');
  }

  // Prefer HATEOAS link exposed pelo GET /api/rules; se indisponivel (config ainda
  // nao criada no banco, resposta antiga em cache), monta via API_BASE_URL como fallback.
  const baseHref = rulesConfig?._links?.importarFeriados?.href
    || `${API_BASE_URL}/rules/feriados/importar`;
  const method = rulesConfig?._links?.importarFeriados?.method || 'GET';

  const separator = baseHref.includes('?') ? '&' : '?';
  const importLink = {
    href: `${baseHref}${separator}ano=${encodeURIComponent(String(yearNumber))}`,
    method,
  };

  const response = await fetchWithHateoas(importLink, null, API_BASE_URL);
  const feriados = Array.isArray(response?.data?.feriados) ? response.data.feriados : [];
  return { ano: yearNumber, feriados };
}
