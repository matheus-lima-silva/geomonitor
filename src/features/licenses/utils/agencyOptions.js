import { ENVIRONMENTAL_AGENCY_CATALOG } from '../constants/agencies';
import { normalizeFollowupEventType, normalizeFollowupHistory } from '../../erosions/utils/erosionUtils';

function cleanAgencyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function upsertAgency(map, value, source) {
  const cleaned = cleanAgencyName(value);
  if (!cleaned) return;
  const key = cleaned.toLocaleLowerCase('pt-BR');
  const current = map.get(key);
  if (!current) {
    map.set(key, { value: cleaned, source });
    return;
  }
  if (current.source === 'history' && source === 'catalog') {
    map.set(key, { value: current.value, source: 'catalog' });
  }
}

export function getAgencyOptions({ licenses, erosions } = {}) {
  const map = new Map();

  (ENVIRONMENTAL_AGENCY_CATALOG || []).forEach((item) => upsertAgency(map, item, 'catalog'));

  (licenses || []).forEach((license) => {
    upsertAgency(map, license?.orgaoAmbiental, 'history');
  });

  (erosions || []).forEach((erosion) => {
    const history = normalizeFollowupHistory(erosion?.acompanhamentosResumo);
    history.forEach((event) => {
      if (normalizeFollowupEventType(event) !== 'autuacao') return;
      upsertAgency(map, event?.orgao, 'history');
    });
  });

  return [...map.values()].sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
}
