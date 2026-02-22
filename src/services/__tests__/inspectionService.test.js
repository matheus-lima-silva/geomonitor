import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firestoreClient', () => ({
  deleteDocById: vi.fn(),
  saveDoc: vi.fn(),
  subscribeCollection: vi.fn(),
}));

import { deleteDocById, saveDoc, subscribeCollection } from '../firestoreClient';
import { deleteInspection, saveInspection, subscribeInspections } from '../inspectionService';

describe('inspectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribeInspections delega para a coleção inspections', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeCollection).mockReturnValue('UNSUB');

    const unsub = subscribeInspections(onData, onError);

    expect(subscribeCollection).toHaveBeenCalledWith('inspections', onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('saveInspection gera ID automático, normaliza dataFim e detalhesDias', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    const id = await saveInspection({
      projetoId: 'P-01',
      dataInicio: '2025-06-15',
      detalhesDias: 'invalido',
    }, { updatedBy: 'qa@empresa.com' });

    expect(id).toBe(`VS-${Date.now()}`);
    expect(saveDoc).toHaveBeenCalledWith(
      'inspections',
      id,
      {
        projetoId: 'P-01',
        dataInicio: '2025-06-15',
        detalhesDias: [],
        id,
        dataFim: '2025-06-15',
      },
      { updatedBy: 'qa@empresa.com', merge: true },
    );

    vi.useRealTimers();
  });

  it('saveInspection preserva id informado e detalhesDias em array', async () => {
    vi.mocked(saveDoc).mockResolvedValue(undefined);

    const id = await saveInspection({
      id: ' VS-10 ',
      projetoId: 'P-01',
      dataInicio: '2025-06-15',
      dataFim: '2025-06-16',
      detalhesDias: [{ data: '2025-06-15' }],
    });

    expect(id).toBe('VS-10');
    expect(saveDoc).toHaveBeenCalledWith(
      'inspections',
      'VS-10',
      {
        id: 'VS-10',
        projetoId: 'P-01',
        dataInicio: '2025-06-15',
        dataFim: '2025-06-16',
        detalhesDias: [{ data: '2025-06-15' }],
      },
      { merge: true },
    );
  });

  it('deleteInspection delega exclusão', async () => {
    vi.mocked(deleteDocById).mockResolvedValue(undefined);

    await deleteInspection('VS-1');

    expect(deleteDocById).toHaveBeenCalledWith('inspections', 'VS-1');
  });
});
