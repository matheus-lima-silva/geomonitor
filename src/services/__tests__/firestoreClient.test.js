import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({
  db: { name: 'mock-db' },
}));

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  collectionRef,
  deleteDocById,
  docRef,
  loadDoc,
  saveDoc,
  subscribeCollection,
} from '../firestoreClient';

describe('firestoreClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collectionRef monta caminho base shared/geomonitor', () => {
    vi.mocked(collection).mockReturnValue('COLLECTION_REF');

    const ref = collectionRef('projects');

    expect(collection).toHaveBeenCalledWith(db, 'shared', 'geomonitor', 'projects');
    expect(ref).toBe('COLLECTION_REF');
  });

  it('docRef monta caminho base shared/geomonitor', () => {
    vi.mocked(doc).mockReturnValue('DOC_REF');

    const ref = docRef('projects', 'P-001');

    expect(doc).toHaveBeenCalledWith(db, 'shared', 'geomonitor', 'projects', 'P-001');
    expect(ref).toBe('DOC_REF');
  });

  it('subscribeCollection mapeia snapshot para objetos com id', () => {
    vi.mocked(collection).mockReturnValue('COLLECTION_REF');
    vi.mocked(onSnapshot).mockImplementation((_ref, onData) => {
      onData({
        docs: [
          { id: 'A', data: () => ({ nome: 'Projeto A' }) },
          { id: 'B', data: () => ({ nome: 'Projeto B' }) },
        ],
      });
      return 'UNSUB';
    });
    const onData = vi.fn();
    const onError = vi.fn();

    const unsub = subscribeCollection('projects', onData, onError);

    expect(onSnapshot).toHaveBeenCalledWith('COLLECTION_REF', expect.any(Function), onError);
    expect(onData).toHaveBeenCalledWith([
      { id: 'A', nome: 'Projeto A' },
      { id: 'B', nome: 'Projeto B' },
    ]);
    expect(unsub).toBe('UNSUB');
  });

  it('saveDoc injeta metadados e merge padrão falso', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-01T10:20:30.000Z'));
    vi.mocked(doc).mockReturnValue('DOC_REF');
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await saveDoc('projects', 'P-001', { nome: 'Projeto A' });

    expect(setDoc).toHaveBeenCalledWith(
      'DOC_REF',
      {
        nome: 'Projeto A',
        ultimaAtualizacao: '2025-04-01T10:20:30.000Z',
      },
      { merge: false },
    );

    vi.useRealTimers();
  });

  it('saveDoc inclui atualizadoPor quando informado', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-01T10:20:30.000Z'));
    vi.mocked(doc).mockReturnValue('DOC_REF');
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await saveDoc('projects', 'P-001', { nome: 'Projeto A' }, { merge: true, updatedBy: 'dev@empresa.com' });

    expect(setDoc).toHaveBeenCalledWith(
      'DOC_REF',
      {
        nome: 'Projeto A',
        ultimaAtualizacao: '2025-04-01T10:20:30.000Z',
        atualizadoPor: 'dev@empresa.com',
      },
      { merge: true },
    );

    vi.useRealTimers();
  });

  it('deleteDocById remove documento pelo docRef', async () => {
    vi.mocked(doc).mockReturnValue('DOC_REF');
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    await deleteDocById('projects', 'P-001');

    expect(deleteDoc).toHaveBeenCalledWith('DOC_REF');
  });

  it('loadDoc retorna null quando documento não existe', async () => {
    vi.mocked(doc).mockReturnValue('DOC_REF');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    });

    await expect(loadDoc('projects', 'P-001')).resolves.toBeNull();
  });

  it('loadDoc retorna documento com id quando existe', async () => {
    vi.mocked(doc).mockReturnValue('DOC_REF');
    vi.mocked(getDoc).mockResolvedValue({
      id: 'P-001',
      exists: () => true,
      data: () => ({ nome: 'Projeto A' }),
    });

    await expect(loadDoc('projects', 'P-001')).resolves.toEqual({
      id: 'P-001',
      nome: 'Projeto A',
    });
  });
});
