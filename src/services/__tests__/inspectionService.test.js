import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firestoreClient', () => ({
  subscribeCollection: vi.fn()
}));

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { subscribeCollection } from '../firestoreClient';
import { auth } from '../../firebase/config';
import { deleteInspection, saveInspection, subscribeInspections } from '../inspectionService';

describe('inspectionService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('subscribeInspections delega para a colecao inspections', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeCollection).mockReturnValue('UNSUB');

    const unsub = subscribeInspections(onData, onError);

    expect(subscribeCollection).toHaveBeenCalledWith('inspections', onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('saveInspection envia POST para API e retorna id de resposta', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'VS-1' } })
    });

    await expect(
      saveInspection({ projetoId: 'P-1' }, { updatedBy: 'qa@empresa.com' })
    ).resolves.toBe('VS-1');

    const call = fetchMock.mock.calls[0];
    const url = call[0];
    const request = call[1];
    expect(url).toContain('/inspections');
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(request.body)).toEqual({
      data: { projetoId: 'P-1' },
      meta: { updatedBy: 'qa@empresa.com' }
    });
  });

  it('saveInspection falha sem autenticacao', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('')
    };

    await expect(saveInspection({ id: 'VS-1' })).rejects.toThrow(/autenticado/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saveInspection converte erro de conexao em mensagem amigavel', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    await expect(saveInspection({ projetoId: 'P-1' })).rejects.toThrow(/conectar ao servidor/i);
  });

  it('deleteInspection envia DELETE e nao retorna payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteInspection('VS-1')).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('DELETE');
    expect(request.headers.Authorization).toBe('Bearer token-123');
  });
});
