import { deleteDocById, saveDoc, subscribeCollection } from './firestoreClient';

export function subscribeUsers(onData, onError) {
  return subscribeCollection('users', onData, onError);
}

export function saveUser(id, payload, meta = {}) {
  return saveDoc('users', id, { ...payload, id }, { ...meta, merge: true });
}

export function deleteUser(id) {
  return deleteDocById('users', id);
}
