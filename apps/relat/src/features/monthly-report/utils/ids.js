// Ids de cliente para entidades do Relatorio Mensal. Prefixos casam com os do
// backend (monthlyReportRepository.genId); ids enviados sao preservados no
// full-sync, garantindo estabilidade de keys React entre saves.

export function genId(prefix) {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

export const ID_PREFIX = {
  engineer: 'MRE',
  project: 'MRP',
  activity: 'MRA',
  member: 'MEM',
};
