import { createCrudService } from '../utils/serviceFactory';

const service = createCrudService({
  resourcePath: 'users',
  itemName: 'Utilizador'
});

export function subscribeUsers(onData, onError) {
  return service.subscribe(onData, onError);
}

export function saveUser(id, payload, meta = {}) {
  return service.save(id, { ...payload, id }, { ...meta, merge: true });
}

export function deleteUser(id) {
  return service.remove(id);
}
