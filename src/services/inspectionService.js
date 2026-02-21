import { deleteDocById, subscribeCollection, saveDoc } from './firestoreClient';

export function subscribeInspections(onData, onError) {
  return subscribeCollection('inspections', onData, onError);
}

export async function saveInspection(inspection, meta = {}) {
  const id = String(inspection.id || '').trim() || `VS-${Date.now()}`;
  await saveDoc('inspections', id, {
    ...inspection,
    id,
    dataFim: inspection.dataFim || inspection.dataInicio,
    detalhesDias: Array.isArray(inspection.detalhesDias) ? inspection.detalhesDias : [],
  }, { ...meta, merge: true });
  return id;
}

export function deleteInspection(id) {
  return deleteDocById('inspections', id);
}
