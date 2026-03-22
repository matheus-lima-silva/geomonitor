import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'report-compounds',
  itemName: 'Relatorio Composto',
  defaultIdGenerator: (payload) => String(payload?.id || `RC-${Date.now()}`).trim(),
});

export function subscribeReportCompounds(onData, onError) {
  return service.subscribe(onData, onError);
}

export function createReportCompound(payload, meta = {}) {
  return service.create(payload, meta, (item) => String(item?.id || `RC-${Date.now()}`).trim());
}
