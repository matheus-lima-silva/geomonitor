import { createSingletonService } from '../utils/serviceFactory';

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
