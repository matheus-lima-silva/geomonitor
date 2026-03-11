import { subscribeCollection } from './firestoreClient';
import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'inspections',
  itemName: 'Vistoria'
});

export function subscribeInspections(onData, onError) {
  return subscribeCollection('inspections', onData, onError);
}

export async function saveInspection(inspection, meta = {}) {
  const result = await service.save(inspection.id || '', inspection, meta);
  return result?.data?.id || '';
}

export async function deleteInspection(inspectionOrId) {
  return service.remove(inspectionOrId);
}
