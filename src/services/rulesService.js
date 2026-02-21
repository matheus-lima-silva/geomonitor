import { docRef, saveDoc } from './firestoreClient';
import { onSnapshot } from 'firebase/firestore';

export function subscribeRulesConfig(onData, onError) {
  return onSnapshot(
    docRef('config', 'rules'),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  );
}

export function saveRulesConfig(rules, meta = {}) {
  return saveDoc('config', 'rules', rules, { ...meta, merge: true });
}
