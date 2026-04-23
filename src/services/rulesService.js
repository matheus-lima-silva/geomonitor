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

  const link = rulesConfig?._links?.importarFeriados;
  if (!link?.href) {
    throw new Error('Link HATEOAS de importacao de feriados indisponivel. Recarregue a configuracao de regras.');
  }

  const separator = link.href.includes('?') ? '&' : '?';
  const importLink = {
    ...link,
    href: `${link.href}${separator}ano=${encodeURIComponent(String(yearNumber))}`,
  };

  const response = await fetchWithHateoas(importLink, null, API_BASE_URL);
  const feriados = Array.isArray(response?.data?.feriados) ? response.data.feriados : [];
  return { ano: yearNumber, feriados };
}
