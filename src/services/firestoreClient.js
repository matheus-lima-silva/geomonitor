import {
  collection, deleteDoc, doc, getDoc, onSnapshot, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const BASE_PATH = ['shared', 'geomonitor'];

export function collectionRef(colName) {
  return collection(db, ...BASE_PATH, colName);
}

export function docRef(colName, docId) {
  return doc(db, ...BASE_PATH, colName, docId);
}

export function subscribeCollection(colName, onData, onError) {
  return onSnapshot(
    collectionRef(colName),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function saveDoc(colName, docId, payload, meta = {}) {
  const merged = {
    ...payload,
    ultimaAtualizacao: new Date().toISOString(),
    ...(meta.updatedBy ? { atualizadoPor: meta.updatedBy } : {}),
  };
  await setDoc(docRef(colName, docId), merged, { merge: meta.merge ?? false });
}

export async function deleteDocById(colName, docId) {
  await deleteDoc(docRef(colName, docId));
}

export async function loadDoc(colName, docId) {
  const snap = await getDoc(docRef(colName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
