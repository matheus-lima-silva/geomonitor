import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firestoreClient', () => ({
  deleteDocById: vi.fn(),
  subscribeCollection: vi.fn()
}));

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { deleteDocById, subscribeCollection } from '../firestoreClient';
import { auth } from '../../firebase/config';
import {
  deleteErosion,
  saveErosion,
  saveErosionManualFollowupEvent,
  subscribeErosions
} from '../erosionService';

describe('erosionService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('subscribeErosions delega para collection erosions', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    vi.mocked(subscribeCollection).mockReturnValue('UNSUB');

    const unsub = subscribeErosions(onData, onError);

    expect(subscribeCollection).toHaveBeenCalledWith('erosions', onData, onError);
    expect(unsub).toBe('UNSUB');
  });

  it('saveErosion envia POST e retorna id da resposta', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'ERS-77' } })
    });

    await expect(
      saveErosion({ id: 'ERS-77', projetoId: 'P-1' }, { updatedBy: 'eng@empresa.com' })
    ).resolves.toBe('ERS-77');

    const call = fetchMock.mock.calls[0];
    const url = call[0];
    const request = call[1];
    expect(url).toContain('/erosions');
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer token-123');

    const body = JSON.parse(request.body);
    expect(body.data).toEqual({ id: 'ERS-77', projetoId: 'P-1' });
    expect(body.meta).toEqual({ updatedBy: 'eng@empresa.com' });
  });

  it('saveErosion falha quando usuario nao esta autenticado', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('')
    };

    await expect(saveErosion({ id: 'ERS-1' })).rejects.toThrow(/autenticado/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saveErosionManualFollowupEvent falha com erosao invalida', async () => {
    await expect(
      saveErosionManualFollowupEvent(null, { tipoEvento: 'obra' }, {})
    ).rejects.toThrow(/Erosao invalida/i);
  });

  it('saveErosionManualFollowupEvent falha com dados de evento invalidos', async () => {
    await expect(
      saveErosionManualFollowupEvent(
        { id: 'ER-2', status: 'Ativo' },
        { tipoEvento: 'obra' },
        {}
      )
    ).rejects.toThrow('Dados do evento invalidos.');
  });

  it('saveErosionManualFollowupEvent estabiliza status em obra concluida', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'ER-1' } })
    });

    const result = await saveErosionManualFollowupEvent(
      {
        id: 'ER-1',
        status: 'Ativo',
        acompanhamentosResumo: [],
        vistoriaId: 'VS-1',
        vistoriaIds: ['VS-1']
      },
      {
        tipoEvento: 'obra',
        obraEtapa: 'Concluida',
        descricao: 'Execucao finalizada'
      },
      {
        updatedBy: 'analista@empresa.com',
        inspections: [{ id: 'VS-1', dataFim: '2026-02-10' }]
      }
    );

    expect(result.nextStatus).toBe('Estabilizado');
    expect(result.manualEvent).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body.data.status).toBe('Estabilizado');
    expect(Array.isArray(body.data.acompanhamentosResumo)).toBe(true);
    expect(body.data.acompanhamentosResumo).toHaveLength(1);
    expect(body.meta).toEqual(
      expect.objectContaining({
        merge: true,
        skipAutoFollowup: true,
        updatedBy: 'analista@empresa.com'
      })
    );
  });

  it('deleteErosion delega para deleteDocById', async () => {
    vi.mocked(deleteDocById).mockResolvedValue(undefined);

    await expect(deleteErosion('ERS-1')).resolves.toBeUndefined();
    expect(deleteDocById).toHaveBeenCalledWith('erosions', 'ERS-1');
  });
});
