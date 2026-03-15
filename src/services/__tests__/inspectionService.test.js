import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { auth } from '../../firebase/config';
import { deleteInspection, saveInspection, subscribeInspections } from '../inspectionService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('inspectionService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('subscribeInspections busca lista via API', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'VS-1', projetoId: 'P-1' }] })
    });

    const unsub = subscribeInspections(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/inspections');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'VS-1' })]);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
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
    expect(JSON.parse(request.body)).toMatchObject({
      data: { projetoId: 'P-1' },
      meta: expect.objectContaining({ updatedBy: 'qa@empresa.com' })
    });
  });

  it('saveInspection usa _links.update quando a vistoria possui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'VS-1' } })
    });

    await expect(
      saveInspection({
        id: 'VS-1',
        projetoId: 'P-1',
        _links: {
          update: {
            href: 'https://geomonitor-api.fly.dev/api/inspections/VS-1',
            method: 'PUT'
          }
        }
      }, { updatedBy: 'qa@empresa.com' })
    ).resolves.toBe('VS-1');

    expect(fetchMock.mock.calls[0][0]).toContain('/inspections/VS-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
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

    await expect(saveInspection({ projetoId: 'P-1' })).rejects.toThrow(/network error|rede/i);
  });

  it('deleteInspection envia DELETE e nao retorna payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteInspection('VS-1')).resolves.toEqual({});

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('DELETE');
    expect(request.headers.Authorization).toBe('Bearer token-123');
  });

  it('deleteInspection usa _links.delete quando a vistoria possui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteInspection({
      id: 'VS-1',
      _links: {
        delete: {
          href: 'https://geomonitor-api.fly.dev/api/inspections/VS-1',
          method: 'DELETE'
        }
      }
    })).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/inspections/VS-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
