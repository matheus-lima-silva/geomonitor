import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { auth } from '../../firebase/config';
import { createProject, removeProject, subscribeProjects, updateProject } from '../projectService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('projectService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('subscribeProjects busca lista via API e entrega itens com HATEOAS', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: 'P-1', nome: 'Projeto A', _links: { self: { href: '/api/projects/P-1', method: 'GET' } } }]
      })
    });

    const unsub = subscribeProjects(onData, onError);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/projects');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'P-1', nome: 'Projeto A', _links: expect.any(Object) })
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('createProject normaliza id, envia POST e retorna id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(
      createProject({ id: ' lt-99 ' }, { updatedBy: 'ops@empresa.com' })
    ).resolves.toEqual({ id: 'LT-99' });

    expect(auth.currentUser.getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/projects');

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(request.body)).toMatchObject({
      data: { id: 'LT-99' },
      meta: expect.objectContaining({ updatedBy: 'ops@empresa.com' })
    });
  });

  it('createProject falha sem id valido', async () => {
    await expect(createProject({ id: '   ' })).rejects.toThrow('Projeto precisa de ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createProject falha sem token de autenticacao', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('')
    };

    await expect(createProject({ id: 'P-1' })).rejects.toThrow(/autenticado/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updateProject envia PUT com payload esperado', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(
      updateProject('P-1', { nome: 'Projeto 1' }, { updatedBy: 'dev@empresa.com' })
    ).resolves.toEqual({ id: 'P-1' });

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body)).toMatchObject({
      data: { nome: 'Projeto 1' },
      meta: expect.objectContaining({ updatedBy: 'dev@empresa.com' })
    });
  });

  it('updateProject usa _links.update quando payload inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'P-1' } })
    });

    await expect(
      updateProject('P-1', {
        nome: 'Projeto por link',
        _links: {
          update: {
            href: 'https://geomonitor-api.fly.dev/api/projects/P-1',
            method: 'PUT'
          }
        }
      }, { updatedBy: 'dev@empresa.com' })
    ).resolves.toEqual({ id: 'P-1' });

    expect(fetchMock.mock.calls[0][0]).toContain('/projects/P-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('removeProject envia DELETE com auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(removeProject('P-1')).resolves.toEqual({});

    const request = fetchMock.mock.calls[0][1];
    expect(request.method).toBe('DELETE');
    expect(request.headers.Authorization).toBe('Bearer token-123');
  });

  it('removeProject usa _links.delete quando recurso inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(removeProject({
      id: 'P-1',
      _links: {
        delete: {
          href: 'https://geomonitor-api.fly.dev/api/projects/P-1',
          method: 'DELETE'
        }
      }
    })).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/projects/P-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('propaga erro de API ao criar projeto', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Falha API' })
    });

    await expect(createProject({ id: 'P-1' })).rejects.toThrow('Falha API');
  });
});
